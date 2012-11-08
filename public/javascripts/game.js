(function(_, $, Engine) {
  "use strict";

  $(function() {

    var E = window.E = new Engine().setup({ id: "game", width: 500 });
    E.enableSound();
    E.load(["sprites.png", "sprites.json", "explosion.png", "explosion.json", "explosion1.mp3", "explosion2.mp3", "laser2.mp3", "alien.png"], function() {
      E.createSheets("sprites.png", "sprites.json");
      E.createSheets("explosion.png", "explosion.json");
      loadGame();
    });

    // http://jsperf.com/prerendered-starfield
    var StarsScreen = E.Screen.extend({
      init: function(speed, opacity, numStars, clear) {
        this.stars = document.createElement("canvas");
        this.stars.width = E.width;
        this.stars.height = E.height;
        this.starCtx = this.stars.getContext("2d");
        this.speed = speed;
        this.offset = 0;

        if (clear) {
          this.starCtx.fillStyle = "#000";
          this.starCtx.fillRect(0, 0, E.width, E.height);
        }

        this.starCtx.fillStyle = "#FFF";
        this.starCtx.globalAlpha = opacity;

        for (var i=0; i<numStars; i++) {
          this.starCtx.fillRect(Math.floor(Math.random() * E.width), Math.floor(Math.random() * E.height), 2, 2);
        }
      },
      step: function(dt) {
        this.offset += dt * this.speed;
        this.offset = this.offset % E.height;
      },
      draw: function(ctx) {
        var intOffset = Math.floor(this.offset);
        var remaining = E.height - intOffset;

        // top half
        if (intOffset > 0) ctx.drawImage(this.stars, 0, remaining, E.width, intOffset, 0, 0, E.width, intOffset);

        // bottom half
        if (remaining > 0) ctx.drawImage(this.stars, 0, 0, E.width, remaining, 0, intOffset, E.width, remaining);
      }
    });

    var TitleScreen = E.Screen.extend({
      init: function(title, subtitle, callback) {
        this.title = title;
        this.subtitle = subtitle;
        this.shadowColor = "#FFF000";
        this.color = "#b5e853";
        this.callback = callback;
        this.up = false;
      },
      step: function(dt) {
        if(!E.keys['fire']) this.up = true;
        if (this.up && E.keys["fire"] && this.callback) this.callback();
      },
      draw: function(ctx) {
        ctx.drawImage(E.asset("alien.png"), E.width/2-20, E.height/2-100);

        ctx.textAlign = "center";
        ctx.font = "bold 50px Unica One";
        this._drawText(ctx, this.title, E.width/2, E.height/2);
        ctx.font = "bold 28px Unica One";
        this._drawText(ctx, this.subtitle, E.width/2, E.height/2 + 40);
      },

      _drawText: function(ctx, text, x, y) {
        ctx.fillStyle = this.shadowColor;
        ctx.fillText(text, x + 1, y + 1);
        ctx.fillStyle = this.color;
        ctx.fillText(text, x, y);
      }
    });

    var TYPES = {
      player: 1,
      player_projectile: 2,
      enemy: 4,
      enemy_projectile: 8
    };

    var PlayerShip = E.Sprite.extend({
      init: function() {
        this._super({
          sheetId: "player",
          reloadTime: 0.25,
          reload: 0.25,
          maxVel: 200,
          type: TYPES["player"]
        });

        this.x = E.width/2 - this.w/2;
        this.y = (E.height-30) - this.h;
      },
      step: function(dt) {
        if (E.keys['left']) {
          this.frame = 1;
          this.vx = -this.maxVel;
        } else if (E.keys['right']) {
          this.vx = this.maxVel;
          this.frame = 2;
        } else {
          this.frame = 0;
          this.vx = 0;
        }

        if (E.keys['up']) {
          this.vy = -this.maxVel;
        } else if (E.keys['down']) {
          this.vy = this.maxVel;
        } else {
          this.vy = 0;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.x < 0) {
          this.x = 0;
        } else if (this.x > E.width - this.w) {
          this.x = E.width - this.w;
        }

        if (this.y < 0) {
          this.y = 0;
        } else if (this.y > (E.height-30) - this.h) {
          this.y = (E.height-30) - this.h;
        }

        this.reload -= dt;

        // e.log(this.x, this.y)
        if (E.keys['fire'] && this.reload < 0) {
          E.keys['fire'] = false;
          this.reload = this.reloadTime;
          E.playSound("laser2.mp3", 1);
          this.collection.add(new PlayerMissile(this.x, this.y+this.h/2));
          this.collection.add(new PlayerMissile(this.x+this.w, this.y+this.h/2));
        }
      },
      hit: function(damage) {
        if (this.collection.remove(this)) {
          E.playSound("explosion2.mp3");
          this.collection.add(new Explosion(this.x, this.y));
          this.collection.add(new Explosion(this.x-20, this.y-20));
          this.collection.add(new Explosion(this.x+10, this.y+10));
          setTimeout(function() { loseGame(); }, 500);
        }
      }
    });

    var PlayerMissile = E.Sprite.extend({
      init: function(x, y) {
        this._super({
          sheetId: "laserRed",
          vy: -700,
          damage: 10,
          type: TYPES["player_projectile"]
        });

        this.x = x - this.w/2;
        this.y = y - this.h;
      },
      step: function(dt) {
        this.y += this.vy * dt;
        var collision = this.collection.collide(this, TYPES["enemy"]);
        if (collision) {
          collision.hit(this.damage);
          this.collection.remove(this);
        } else if (this.y < -this.h) {
          this.collection.remove(this);
        }
      }
    });

    var EnemyMissile = E.Sprite.extend({
      init: function(x, y) {
        this._super({
          sheetId: "laserGreen",
          vy: 200,
          damage: 10,
          type: TYPES["enemy_projectile"]
        });

        this.x = x - this.w/2;
        this.y = y;
      },
      step: function(dt) {
        this.y += this.vy * dt;
        var collision = this.collection.collide(this, TYPES["player"]);
        if (collision) {
          collision.hit(this.damage);
          this.collection.remove(this);
        } else if (this.y > E.height) {
          this.collection.remove(this);
        }
      }
    });

    var Enemy = E.Sprite.extend({
      init: function(blueprint, override) {

        var defaults = {
          A: 0, B: 0, C: 0, D: 0,
          E: 0, F: 0, G: 0, H: 0,
          t: 0, firePercentage: 0.01,
          reloadTime: 0.75, reload: 0
        };

        for (var prop in defaults) {
          this[prop] = defaults[prop];
        }

        for (prop in blueprint) {
          this[prop] = blueprint[prop];
        }

        if (override) {
          for (prop in override) {
            this[prop] = override[prop];
          }
        }

        this._super({
          sheetId: this.sprite,
          type: TYPES["enemy"],
          t: 0
        });
      },
      step: function(dt) {
        this.t += dt;
        this.vx = this.A + this.B * Math.sin(this.C * this.t + this.D);
        this.vy = this.E + this.F * Math.sin(this.G * this.t + this.H);
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        var collision = this.collection.collide(this, TYPES["player"]);
        if (collision) {
          collision.hit(this.damage);
          this.collection.remove(this);
        }

        if (this.reload <= 0 && Math.random() < this.firePercentage) {
          this.reload = this.reloadTime;

          if (this.missiles == 2) {
            this.collection.add(new EnemyMissile(this.x+this.w-2,this.y+this.h/2));
            this.collection.add(new EnemyMissile(this.x+2,this.y+this.h/2));
          } else if (this.missiles == 1) {
            this.collection.add(new EnemyMissile(this.x+this.w/2,this.y+this.h));
          }
        }

        this.reload-=dt;

        if (this.y > E.height || this.x < -this.w || this.x > E.width) {
          this.collection.remove(this);
        }
      },
      hit: function(damage) {
        this.health -= damage;
        if (this.health <= 0) {
          if (this.collection.remove(this)) {
            E.points += this.points || 100;
            E.playSound("explosion1.mp3");
            this.collection.add(
              new Explosion(this.x + this.w/2, this.y + this.h/2)
            );
          }
        }
      }
    });

    var Explosion = E.Sprite.extend({
      init: function(centerX, centerY) {
        this._super({
          sheetId: "explosion",
          subFrame: 0,
          frame: 0
        });
        this.x = centerX - this.w/2;
        this.y = centerY - this.h/2;
      },
      step: function(dt) {
        this.frame = Math.floor(this.subFrame++ / 3);
        if (this.subFrame >= 36) {
          this.collection.remove(this);
        }
      },
      hit: function(damage) {}
    });

    var Level = E.LoopLogic.extend({
      init: function(levelData, callback, spriteCollection) {
        this.levelData = [];
        // TODO: why Object.create
        for(var i =0; i<levelData.length; i++) {
          this.levelData.push(Object.create(levelData[i]));
        }
        this.t = 0;
        this.callback = callback;
        this.collection = spriteCollection;
      },

      step: function(dt) {
        var idx = 0, remove = [], curShip = null;

        // Update the current time offset
        this.t += dt * 1000;

        //   Start, End,  Gap, Type,   Override
        // [ 0,     4000, 500, 'step', { x: 100 } ]
        while((curShip = this.levelData[idx]) &&
              (curShip[0] < this.t + 2000)) {
          // Check if we've passed the end time
          if(this.t > curShip[1]) {
            remove.push(curShip);
          } else if(curShip[0] < this.t) {
            // Get the enemy definition blueprint
            var enemy = enemies[curShip[3]],
                override = curShip[4];

            // Add a new enemy with the blueprint and override
            this.collection.add(new Enemy(enemy,override));

            // Increment the start time by the gap
            curShip[0] += curShip[2];
          }
          idx++;
        }

        // Remove any objects from the levelData that have passed
        for(var i=0,len=remove.length;i<len;i++) {
          var remIdx = this.levelData.indexOf(remove[i]);
          if(remIdx != -1) this.levelData.splice(remIdx,1);
        }

        // If there are no more enemies on the board or in
        // levelData, this level is done
        if(this.levelData.length === 0 && this.collection.cnt[TYPES["enemy"]] === 0) {
          if(this.callback) this.callback();
        }
      }
    });

    var GamePoints = E.Screen.extend({
      init: function() {
        E.points = 0;
        this.pointsLength = 8;
      },
      draw: function(ctx) {
        ctx.save();
        ctx.font = "bold 18px Unica One";
        ctx.fillStyle= "#b5e853";

        var txt = "" + E.points;
        var i = this.pointsLength - txt.length,
            zeros = "";

        while(i-- > 0) { zeros += "0"; }

        ctx.fillText(zeros + txt, 45, 20);
        ctx.restore();
      }
    });

    var enemies = {
      straight: { x: 100,   y: 0, sprite: 'enemyShip', health: 10,
                  E: 100, missiles: 2 },
      leftToRight: { x: 10,   y: 0, sprite: 'meteorSmall', health: 10,
                  B: 200, C: 1, E: 100 },
      circle:   { x: 400,   y: -50, sprite: 'enemyUFO', health: 10, points: 200,
                  A: 0,  B: -200, C: 1, E: 20, F: 200, G: 1, H: Math.PI/2,
                  missiles: 1, firePercentage: 0.01 },
      wiggle:   { x: 100, y: -50, sprite: 'enemyShip', health: 20,
                  B: 100, C: 4, E: 100, firePercentage: 0.001, missiles: 1 },
      step:     { x: 0,   y: -50, sprite: 'enemyShip', health: 10, points: 200,
                  B: 300, C: 1.5, E: 60, firePercentage: 0.001, missiles: 1 }
    };

    var playGame = function() {
      var spriteCollection = new E.SpriteCollection();
      spriteCollection.add(new PlayerShip());
      var level = new Level(level1, winGame, spriteCollection);
      E.addLoopLogic(level);

      E.setScreen(3, spriteCollection);
      E.setScreen(4, new GamePoints());
    };

    var loadGame = function() {
      E.setScreen(0, new StarsScreen(20, 0.4, 100, true));
      E.setScreen(1, new StarsScreen(50, 0.6, 100));
      E.setScreen(2, new StarsScreen(100, 1.0, 50));
      E.setScreen(3, new TitleScreen("Green Aliens","Press space to play", playGame));
    };

    var winGame = function() {
      E.setScreen(3,new TitleScreen("You win!", "Press space to play", playGame));
    };

    var loseGame = function() {
      E.setScreen(3,new TitleScreen("You lose!", "Press space to play", playGame));
    };

    var level1 = [
     // Start,   End, Gap,  Type,   Override
      [ 0,      4000,  500, 'step' ],
      [ 6000,   13000, 800, 'leftToRight' ],
      [ 10000,  16000, 400, 'circle' ],
      [ 17800,  20000, 500, 'straight', { x: 50 } ],
      [ 18200,  20000, 500, 'straight', { x: 100 } ],
      [ 18200,  20000, 500, 'straight', { x: 150 } ],
      [ 22000,  25000, 400, 'wiggle', { x: 150 }],
      [ 22000,  25000, 400, 'wiggle', { x: 250 }]
    ];

  });

})(_, jQuery, Engine);