#!/bin/php

<?php
$data = parse_ini_file("./www/server-config.ini", true);
$port = $data["quickstart"]["port"] ?? "8080";
$addr = $data["quickstart"]["address"] ?? "0.0.0.0";
chdir("./www");
exec("php -S $addr:$port");
?>
