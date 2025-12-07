<?php
if (!array_key_exists("HTTP_AUTHORIZATION", $_SERVER)) {
    header("WWW-Authenticate: Basic realm=\"user\"");
    echo "Login";
}
$auth_header = $_SERVER['HTTP_AUTHORIZATION'];

if (str_starts_with($auth_header, "Basic ")) {
    $b64 = substr($auth_header, 6);

    if (array_key_exists("location", $_GET)) {
        $path = $_GET["location"];
    } else {
        $path = "/ui?${_SERVER['QUERY_STRING']}";
    }

    header("Location: $path");
}
?>
