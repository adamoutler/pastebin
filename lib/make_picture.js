var exec = require('child_process').exec;

function makePicture(file, key) {
    var pic = "./static/images/" + file + ".png";
    console.log("generating picture:" + pic);
    function puts(error, stdout, stderr) { console.log(stdout) }
    exec("xvfb-run --server-args='-screen 0, 1024x768x24' cutycapt --delay=2000 --min-height=750 --zoom-factor=1.55 --url='http://127.0.0.1:7777/" + key + "' --out='" + pic + "'; convert '" + pic + "' -crop 800x600+20+15  -normalize -size 800x600  -font  URW-Gothic-Demi -pointsize 170 -tile gradient:blue-red -annotate 270x270+777+615 '{' -annotate 270x270+786+556 'CODE' -annotate 270x270+777+72 '}' '" + pic + "';", puts);
}

module.exports = makePicture;
