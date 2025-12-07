#!/bin/php

<?php
$data = parse_ini_file("./www/server-config.ini", true);
$port = $data["quickstart"]["port"] ?? "8080";
$addr = $data["quickstart"]["address"] ?? "127.0.0.1";
chdir("./www");
exec("php -S $addr:$port");
?>
