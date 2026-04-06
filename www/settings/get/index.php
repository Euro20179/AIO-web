<?php
include "../../lib/util.php";

if (array_key_exists("auth", $_GET)) {
    $auth = $_GET["auth"];
} else if (array_key_exists("HTTP_AUTHORIZATION", $_SERVER)) {
    $auth = $_SERVER["HTTP_AUTHORIZATION"];
    $auth = substr($auth, 6);
} else {
    http_response_code(401);
    exit();
}

if (!ckauth($auth)) {
    http_response_code(401);
    exit();
}

if (!array_key_exists("uid", $_GET)) {
    echo "Expected a ?uid to look up the settings for";
    http_response_code(400);
    exit();
}

$uid = $_GET["uid"];

header("Content-Type: application/json");

echo get_settings($uid, true);
?>
