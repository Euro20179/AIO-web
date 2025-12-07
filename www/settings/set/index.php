<?php
include "../../lib/util.php";

if (array_key_exists("auth", $_GET)) {
    $auth = $_GET["auth"];
} else if (array_key_exists("HTTP_AUTHORIZATION", $_SERVER)) {
    $auth = $_SERVER["HTTP_AUTHORIZATION"];
    error_log($auth);
    $auth = substr($auth, 6);
    error_log($auth);
} else {
    http_response_code(401);
    exit();
}

if (!ckauth($auth)) {
    http_response_code(401);
    exit();
}

if (!array_key_exists("uid", $_GET)) {
    http_response_code(400);
    header("Content-Type: text/plain");
    echo "Expected ?uid\r\n";
    exit();
}

$params = array("setting", "value");
$fail = false;
foreach ($params as $param) {
    if (!array_key_exists($param, $_GET)) {
        http_response_code(400);
        header("Content-Type: text/markdown");
        echo "Expected url parameter: `$param`\r\n";
        $fail = true;
    }
}

if ($fail) {
    exit();
}

set_setting($uid, $_GET["setting"], $_GET["value"]);
?>
