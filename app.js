var express = require("express"),
    fs      = require("fs"),
    path    = require("path"),
    jade    = require("jade"),
    http    = require("http"),
    routes  = require("./routes");

var app = module.exports = express();

app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('view engine', 'jade');
  // app.set('view options', { layout: false });
  // app.set('view options', { layout: 'layout.ejs' });

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
