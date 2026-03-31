// Require useful stuff
var http = require('http');
var url = require('url');
var fs = require('fs');

var winston = require('winston');
var connect = require('connect');
var connectRoute = require("connect-route");
var serveStatic = require('serve-static');

var DocumentHandler = require('./lib/document_handler.js');

// Load the configuration and set some defaults
var config = JSON.parse(fs.readFileSync('./config.js', 'utf8'));
config.port = process.env.PORT || config.port || 8080;
config.host = process.env.HOST || config.host || 'localhost';

// Set up the logger
winston.configure({
  transports: [
    new winston.transports.Console({
      level: 'verbose',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
winston.info("Welcome to Hastebin Plus!");

// build the store from the config on-demand - so that we don't load it for statics
var Store, preferredStore;
Store = require('./lib/store_file.js');
preferredStore = new Store(config.dataPath);
winston.info('Path to data: ' + config.dataPath);

// Compress the static assets
if (config.compressStaticAssets) {
  // First compress CSS
  var CleanCSS = require('clean-css');  
  var list = fs.readdirSync('./static');
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var orig_code, ast;
    if ((item.indexOf('.css') === item.length - 4) && (item.indexOf('.min.css') === -1)) {
      dest = item.substring(0, item.length - 4) + '.min' + item.substring(item.length - 4);
console.log(item);
      var sourceFile = fs.readFileSync('./static/' + item, 'utf8');
      var minifiedCss = new CleanCSS().minify(sourceFile).styles;
      fs.writeFileSync('./static/' + dest, minifiedCss, 'utf8');
      winston.info('Compressed: ' + item + ' ==> ' + dest);
    }
  }
  
  // Compress JavaScript
  var UglifyJS = require("uglify-js");
  var list = fs.readdirSync('./static');
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var orig_code, ast;
    if ((item.indexOf('.js') === item.length - 3) && (item.indexOf('.min.js') === -1)) {
      dest = item.substring(0, item.length - 3) + '.min' + item.substring(item.length - 3);
      fs.writeFileSync('./static/' + dest, UglifyJS.minify('./static/' + item).code, 'utf8');
      winston.info('Compressed: ' + item + ' ==> ' + dest);
    }
  }
}

// Send the static documents into the preferred store, skipping expirations
var path, data;
for (var name in config.documents) {
  path = config.documents[name];
  data = fs.readFileSync(path, 'utf8');
  winston.info('Loading static document: ' + name + " ==> " + path);
  if (data) {
      preferredStore.set(name, data, function(cb) {}, true);
  } else {
    winston.warn('Failed to load static document: ' + name + " ==> " + path);
  }
}

// Pick up a key generator
var gen = require('./lib/key_generator.js');
var keyGenerator = new gen();

// Configure the document handler
var documentHandler = new DocumentHandler({
  store: preferredStore,
  maxLength: config.maxLength,
  keyLength: config.keyLength,
  keyGenerator: keyGenerator
});

// Set the server up with a static cache
var app = connect();

// Middleware to convert HEAD requests to GET so the router picks them up
app.use(function(request, response, next) {
  if (request.method === 'HEAD') {
    request.method = 'GET';
    request.isHead = true;
  }
  next();
});

// Middleware to intercept missing images and serve fallback
app.use(function(request, response, next) {
  if (request.url.indexOf('/images/') === 0) {
    console.log("Requested image middleware: " + request.url);
    var file = __dirname + '/static' + request.url;
    if (fs.existsSync(file)) {
      console.log("Image exists, passing to static handler");
      return next();
    } else {
      console.log("Image missing, serving fallback codeicon.png");
      var fallback = __dirname + '/static/codeicon.png';
      response.writeHead(200, { 'Content-Type': 'image/png' });
      return fs.createReadStream(fallback).pipe(response);
    }
  }
  next();
});

// First look for api calls
app.use(connectRoute(function(router) {

  // get raw documents
  router.get('/raw/:id', function(request, response, next) {
    console.log("raw");
    return documentHandler.handleRawGet(request.params.id, response, !!config.documents[request.params.id]);
  });
  // add documents
  router.post('/documents', function(request, response, next) {
    console.log("documents");
    return documentHandler.handlePost(request, response);
  });
  // get documents
  router.get('/documents/:id', function(request, response, next) {
          console.log("documents/id");
    var skipExpire = !!config.documents[request.params.id];
    return documentHandler.handleGet(request.params.id, response, skipExpire);
  });
}));

// Otherwise, static
app.use(serveStatic(__dirname + '/static', { 
  maxAge: config.staticMaxAge 
}));

// Then we can loop back - and everything else should be a token, so route it back to /index.html
app.use(connectRoute(function(router) {
    console.log("connectroute");
    
  var serveIndexWithMetadata = function(request, response, next) {
    console.log("id"+request.url);
    var key = request.params.id;
    if (key && key !== 'favicon.ico' && key !== 'index.html') {
      preferredStore.get(key, function(data) {
        var html = fs.readFileSync(__dirname + '/static/index.html', 'utf8');
        var description = "You can modify and share this. Just press CTRL-D";
        
        if (data && typeof data === 'string') {
          var text = data.replace(/<[^>]*>?/gm, '').replace(/(\r\n|\n|\r)/gm, " ");
          if (text.length > 150) {
            description = text.substring(0, 147).trim() + "...";
          } else {
            description = text.trim() || description;
          }
          description = description.replace(/"/g, '&quot;');
        }
        
        var protocol = request.headers['x-forwarded-proto'] || 'http';
        var host = request.headers.host || 'pastebin.adamoutler.com';
        var absoluteImageUrl = protocol + '://' + host + '/images/' + key + '.png';
        var absolutePageUrl = protocol + '://' + host + '/' + key;
        
        html = html.replace(/content="{{URL}}"/g, 'content="' + absolutePageUrl + '"');
        html = html.replace(/content="codeicon\.png"/g, 'content="' + absoluteImageUrl + '"');
        html = html.replace(/content="You can modify and share this\. Just press CTRL-D"/g, 'content="' + description + '"');
        
        response.writeHead(200, { 'Content-Type': 'text/html' });
        if (request.method !== 'HEAD') {
          response.write(html);
        }
        response.end();
      });
      return;
    }
    request.url = request.originalUrl = '/index.html';
console.log(request.url);
    next();
  };

  router.get('/:id', serveIndexWithMetadata);
  if (typeof router.head === 'function') {
    router.head('/:id', serveIndexWithMetadata);
  }
}));
app.use(serveStatic(__dirname + '/static', { maxAge: config.staticMaxAge }));
app.listen(config.port, config.host);

winston.info('Done! Listening on ' + config.host + ':' + config.port);
