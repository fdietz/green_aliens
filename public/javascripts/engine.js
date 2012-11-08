var Engine = (function(_, $, Class) {
  "use strict";

  var Engine = function(options) {
    var E = {};

    E.setup = function(options) {
      var id = options.id || "game",
          width = options.width || 320,
          height = options.height || 480;

      this.$el = $("#"+id);
      this.$el.attr("width", width);
      this.$el.attr("height", height);

      this.canvas = this.$el[0];
      this.width = this.canvas.width;
      this.height = this.canvas.height;

      this.context = this.canvas.getContext && this.canvas.getContext("2d");
      if (!this.context) window.alert("your browser does not support canvas!");

      this.screens = [];
      this.keys = {};
      this.loopLogic = [];
      this.assets = {};
      this.sheets = {};
      this.points = 0;

      this.setupInput();
      this.loop();
      return this;
    };

    var KEY_CODES = { 37: "left", 39: "right", 40: "down", 38: "up", 32: "fire", 88: "fire" };

    E.setupInput = function() {
      var that = this;
      window.addEventListener("keydown", function(event) {
        if (KEY_CODES[event.keyCode]) {
          that.keys[KEY_CODES[event.keyCode]] = true;
          event.preventDefault();
        }
      }, false);

      window.addEventListener("keyup", function(event) {
      if (KEY_CODES[event.keyCode]) {
          that.keys[KEY_CODES[event.keyCode]] = false;
          event.preventDefault();
        }
      }, false);
    };

    E.loop = function() {
      var dt  = 20/1000;
      var len = this.screens.length;

      _.each(this.loopLogic, function(loopLogic) {
        loopLogic.step(dt);
      });

      for (var i=0; i<len; i++) {
        if (this.screens[i]) {
          this.screens[i].step(dt);
          this.screens[i].draw(this.context);
        }
      }

      var that = this;
      requestAnimationFrame(function() { that.loop(); });
    };

    E.audio = {
      channels: [],
      channelMax: 10,
      active: {}
    };

    E.enableSound = function() {
      for (var i=0; i<this.audio.channelMax; i++) {
        this.audio.channels[i] = {};
        this.audio.channels[i]['channel'] = new Audio();
        this.audio.channels[i]['finished'] = -1;
      }
    };

    E.playSound = function(s, debounce) {
      if (!this.asset(s)) return;

      var that = this;
      if (this.audio.active[s]) return;

      if (debounce) {
        this.audio.active[s] = true;
        setTimeout(function() {
          delete that.audio.active[s];
        }, debounce);
      }

      for (var i=0; i < this.audio.channels.length;i++) {
        var now = new Date();
        if (this.audio.channels[i]['finished'] < now.getTime()) {
          this.audio.channels[i]['finished'] = now.getTime() + this.asset(s).duration * 1000;
          this.audio.channels[i]['channel'].src = this.asset(s).src;
          this.audio.channels[i]['channel'].load();
          this.audio.channels[i]['channel'].play();
          break;
        }
      }
    };

    E.load = function(assets, callback) {
      var that = this;
      var map = {};
      var total = assets.length,
          remaining = total;
      _.each(assets, function(asset) {
        map[asset] = asset;
      });

      var errorCallback = function(itm) {
        console.log("Error loading asset: " + itm)
      };

      var loadedCallback = function(key, obj) {
        that.assets[key] = obj;
        remaining--;
        if (remaining === 0 && callback) callback();
      };

      _.each(map, function(itm, key) {
        var assetType = that._assetType(itm);
        if (that.assets[key]) {
          loadedCallback(key, that.assets[key]);
        } else {
          that["_loadAsset" + assetType](key, itm, loadedCallback, function() { errorCallback(itm); });
        }
      });
    };

    E.asset = function(name) {
      return this.assets[name];
    };

    E.assetTypes = {
      png: 'Image', jpg: 'Image', gif: 'Image', jpeg: 'Image',
      ogg: 'Audio', wav: 'Audio', m4a: 'Audio', mp3: 'Audio'
    };

    // Determine the type of an asset with a lookup table
    E._assetType = function(filename) {
      var fileExtension = _(filename.split(".")).last().toLowerCase();
      return this.assetTypes[fileExtension] || "Other";
    };

    E._loadAssetImage = function(key, src, callback, errorCallback) {
      var img = new Image();
      $(img).on('load', function() { callback(key,img); });
      $(img).on('error', errorCallback);
      img.src = "images/" + src;
    };

    E._loadAssetOther = function(key, src, callback, errorCallback) {
      $.get("data/" + src, function(data) {
        callback(key, data);
      }).fail(errorCallback);
    };

    E._loadAssetAudio = function(key, src, callback, errorCallback) {
      if (!document.createElement("audio").play) {
        callback(key,null);
        return;
      }

      var snd      = new Audio(),
          baseName = null,
          extension = null,
          filename = null;

      baseName = this._removeExtension(src);

      var audioSupported = [ 'mp3','ogg', 'wav' ];
      var audioMimeTypes = {
        mp3: "audio/mpeg",
        ogg: "audio/ogg; codecs='vorbis'",
        m4a: "audio/m4a",
        wav: "audio/wav"
      };

      extension = _.find(audioSupported, function(type) {
        return snd.canPlayType(audioMimeTypes[type]) !== "" ? type : null;
      });

      if (!extension) {
        callback(key, null);
        return;
      }

      $(snd).on('error', errorCallback);
      $(snd).on('canplaythrough', function() {
        callback(key, snd);
      });
      snd.src = "sound/" + baseName + "." + extension;
      snd.load();
    };

    E._removeExtension = function(filename) {
      return filename.replace(/\.(\w{3,4})$/,"");
    };


    E.addLoopLogic = function(loopLogic) {
      this.loopLogic.push(loopLogic);
    };

    E.setScreen = function(num, screen) {
      this.screens[num] = screen;
    };

    E.createSheets = function(imageAsset, spriteDataId) {
      var that = this;
      console.log(this.assets[spriteDataId])
      var data = this.assets[spriteDataId];
      console.log("data", data)
      _.each(data, function(options, name) {
        that.sheet(name, imageAsset, options);
      });
    };

    E.sheet = function(name, asset, options) {
      if (asset) {
        this.sheets[name] = new E.SpriteSheet(name, asset, options);
      } else {
        return this.sheets[name];
      }
    };


    /************ classes *************/

    E.Screen = Class.extend({
      init: function() {},
      step: function(dt) {
        // implement me
      },
      draw: function(ctx) {
        // implement me
      }
    });

    E.LoopLogic = Class.extend({
      init: function() {},
      step: function(dt) {
        // implement me
      }
    });

    E.SpriteSheet = Class.extend({
      init: function(name, assetId, options) {
        _.extend(this, {
          name: name,
          assetId: assetId,
          w: E.asset(assetId).width,
          h: E.asset(assetId).height,
          tileWidth: 64,
          tileHeight: 64,
          sx: 0,
          sy: 0
        }, options);

        // TODO: remove these
        this.options = options;
        this.width = options.w;
        this.height = options.h;
        this.columns = this.columns || Math.floor(this.w/this.tileWidth);
      },
      fx: function(frame) {
        return (frame % this.columns) * this.tileWidth + this.sx;
      },
      fy: function(frame) {
        return Math.floor(frame / this.columns) * this.tileHeight + this.sy;
      },
      draw: function(context, x, y, frame) {
        if (!frame) frame = 0;
        context.drawImage(E.asset(this.assetId), this.fx(frame), this.fy(frame), this.tileWidth, this.tileHeight, Math.floor(x), Math.floor(y), this.tileWidth, this.tileHeight);
      }
    });

    E.Sprite = Class.extend({
      init: function(options) {
        _.extend(this,{
          frame: 0,
          type: 0
        }, options || {});

        if (!this.w || !this.h) {
          if (E.asset()) {
            this.w = this.w || this.asset().width;
            this.h = this.h || this.asset().height;
          } else if (this.sheet()) {
            this.w = this.w || this.sheet().tileWidth / 2;
            this.h = this.h || this.sheet().tileHeight / 2;
          }
        }
      },
      asset: function() {
        return E.asset(this.assetId);
      },
      sheet: function() {
        return E.sheet(this.sheetId);
      },
      step: function(dt) {
        // implement me
      },
      draw: function(context) {
        if (this.sheet()) {
          this.sheet().draw(context, this.x, this.y, this.frame);
        } else if (this.assetId) {
          console.log("draw with assetId", this.assetId, this.asset())
          context.drawImage(this.asset(), Math.floor(this.x), Math.floor(this.y));
        }

      },
      hit: function(damage) {
      },
      register: function(collection) {
        this.collection = collection;
      }
    });

    E.SpriteCollection = Class.extend({
      init: function() {
        this.objects = [];
        this.removed = [];
        this.cnt = {};
      },

      add: function(obj) {
        obj.register(this);
        this.objects.push(obj);
        this.cnt[obj.type] = (this.cnt[obj.type] || 0) + 1;
        return obj;
      },

      remove: function(obj) {
        var alreadyRemoved = this.removed.indexOf(obj) !== -1;
        if (!alreadyRemoved) { this.removed.push(obj); }
        return !alreadyRemoved;
      },

      resetRemoved: function(obj) {
        this.removed = [];
      },

      finalizeRemoved: function() {
        var that = this;
        _.each(this.removed, function(obj) {
          var index = _.indexOf(that.objects, obj);
          if (index !== -1) {
            that.cnt[obj.type]--;
            that.objects.splice(index, 1);
          }
        });
      },

      step: function(dt) {
        this.resetRemoved();
        _.each(this.objects, function(obj) {
          obj.step(dt);
        });
        this.finalizeRemoved();
      },

      draw: function(context) {
        _.each(this.objects, function(obj) {
          obj.draw(context);
        });
      },

      overlap: function(o1,o2) {
        return !(
          (o1.y+o1.h-1<o2.y) || (o1.y>o2.y+o2.h-1) || (o1.x+o1.w-1<o2.x) || (o1.x>o2.x+o2.w-1)
        );
      },

      collide: function(obj, type) {
        var that = this;
        return _.find(this.objects, function(o) {
          if (obj !== o) {
            // TODO: logical AND here
            var collision = (!type || o.type & type) && that.overlap(obj, o);
            return collision ? o : false;
          }
        });
      }

    });

    return E;
  };

  return Engine;
})(_, jQuery, Util.Class);