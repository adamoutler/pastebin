var fs = require('fs');
var crypto = require('crypto');

var winston = require('winston');

// For storing in files
// options[type] = file
// options[path] - Where to store

var FileDocumentStore = function(options) {
  this.basePath = options.path || './data';
  this.expire = options.expire;
};

// Generate md5 of a string
FileDocumentStore.md5 = function(str) {
  var md5sum = crypto.createHash('md5');
  md5sum.update(str);
  return md5sum.digest('hex');
};
function replaceAll(find, replace, str) {
  return str.replace(new RegExp(find, 'g'), replace);
}
function makePicture(file,key) {

     var pic="./static/images/"+file+".png";
     console.log("generating picture:"+pic);
     var sys = require('sys')
     var exec = require('child_process').exec;
     function puts(error, stdout, stderr) { sys.puts(stdout) }
     exec("xvfb-run --server-args='-screen 0, 1024x768x24' cutycapt  --min-height=750 --zoom-factor=1.55 --url='http://pastebin.adamoutler.com/"+key+"' --out='"+pic+"'; convert '"+pic+"' -crop 800x600+20+40  -normalize -size 800x600  -font  URW-Gothic-Demi -pointsize 170 -tile gradient:blue-red -annotate 270x270+777+640  '{CODE}'  '"+pic+"';", puts);





} 
// Save data in a file, key as md5 - since we don't know what we could be passed here
FileDocumentStore.prototype.set = function(key, data, callback, skipExpire) {
  try {

    var _this = this;
    fs.mkdir(this.basePath, '700', function() {
      var fn = _this.basePath + '/' + FileDocumentStore.md5(key);
      fs.writeFile(fn, data, 'utf8', function(err) {
        if (err) {
          callback(false);
        } else {
          callback(true);
          if (_this.expire && !skipExpire) {
            winston.warn('File store can not set expirations on keys!');
          }
        }
      });
      makePicture(key,key);
    });
  } catch(err) {
    callback(false);
  }
};

// Get data from a file from key
FileDocumentStore.prototype.get = function(key, callback, skipExpire) {
  var _this = this;
  var fn = this.basePath + '/' + FileDocumentStore.md5(key);
  fs.readFile(fn, 'utf8', function(err, data) {
    if (err) {
      callback(false);
    } else {
      callback(data);
      if (_this.expire && !skipExpire) {
        winston.warn('File store can not set expirations on keys!');
      }
    }
  });
};

module.exports = FileDocumentStore;
