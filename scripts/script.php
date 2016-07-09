#!/usr/bin/php
<?php

//phpinfo(); // Uncomment to see ALL env variables
$host = $_ENV["HTTP_HOST"]; // www.site.com
$script_name = $_ENV["SCRIPT_NAME"]; // /theme/green/style.css
$pi = pathinfo($script_name);
$type = $pi['extension'];
print "$host $script  $type";

$stdin = fopen('php://stdin', 'r');
$stdout = fopen('php://stdout', 'w');
while($line = fgets($stdin)){
  if (preg_match("/mg itemprop=\"image\" casual=\"woot\" src=/i", $line)) {
    // $line='<img itemprop="image" casual="woot" src="'.codeicon.png." height="0" width="0">'
    $line = '<img itemprop="image" src="//pastebin.adamoutler.com/images'.$_SERVER['REQUEST_URI'].'.png" height="1" width="0">';
  } 


  fwrite($stdout, $line);
}

?>
