<?php
include "../../lib/util.php";

if($_SERVER['REQUEST_METHOD'] != "POST") {
    http_response_code(405);
    exit();
}


if (array_key_exists("auth", $_GET)) {
    $auth = $_GET["auth"];
} else if (array_key_exists("HTTP_AUTHORIZATION", $_SERVER)) {
    $auth = $_SERVER["HTTP_AUTHORIZATION"];
    $auth = substr($auth, 6);
} else {
    http_response_code(401);
    exit();
}

$uid = ckauth($auth);
if (!$uid) {
    http_response_code(401);
    exit();
}

$params = array("setting", "value");
$fail = false;
parse_str(file_get_contents("php://input"), $qs_data);
foreach ($params as $param) {
    if (!array_key_exists($param, $qs_data)) {
        http_response_code(400);
        header("Content-Type: text/markdown");
        echo "Expected url parameter: `$param`\r\n";
        $fail = true;
    }
}

if ($fail) {
    exit();
}

$val = $qs_data["value"];

$ty = "string";
if (array_key_exists("type", $qs_data)) {
    $ty = $qs_data["type"];
}

if ($ty == "float") {
    $val = (double)$val;
}
if ($ty == "int") {
    $val = (int)$val;
}
if ($ty == "json") {
    $val = json_decode($val);
}

$uid = $_GET["uid"];
set_setting((int)$uid, $qs_data["setting"], $val);
?>
