<?php
include "../../lib/util.php";

if (!array_key_exists("uid", $_GET)) {
    echo "Expected a ?uid to look up the settings for";
    http_response_code(400);
    exit();
}

$uid = $_GET["uid"];

header("Content-Type: application/json");

echo get_settings($uid, true);
?>
