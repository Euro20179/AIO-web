<?php

function settingsroot() {
    $server_settings = parse_ini_file($_SERVER["DOCUMENT_ROOT"] . "/server-config.ini", true);
    $settings_root = $server_settings["data"]["settings_dir"];

    if (!is_dir($settings_root)) {
        http_response_code(500);
        echo "the administrator has not setup the settings_dir or the directory does not exist";
        exit();
    }

    return $settings_root;
}

function tmpl($name) {
    readfile($_SERVER["DOCUMENT_ROOT"] . "/ui/html-templates/$name.html");
}

function ckauth($auth) {
    $host = get_aio_host();
    $opts = array(
        "http" => array(
            "method" => "GET",
            "header" => "Authorization: Basic $auth"
        )
    );
    $context = stream_context_create($opts);
    $res = file_get_contents("$host/account/authorized", false, $context);
    if ($res == "") {
        return false;
    }
    return $res;
}

function get_aio_host() {
    $server_settings = parse_ini_file($_SERVER["DOCUMENT_ROOT"] . "/server-config.ini", true);
    $host = $server_settings["aio_limas"]["host"];
    return $host;
}

function get_settings($uid, $raw = false) {
    $root = settingsroot();
    $data = file_get_contents("$root/$uid/settings.json");
    if (!$raw) {
        return json_decode($data);
    }
    return $data;
}

function set_setting($uid, $key, $value) {
    $root = settingsroot();
    $settings = get_settings($uid);

    $settings[$key] = $value;

    $data = json_encode($settings);

    file_put_contents("$root/$uid/settings.json", $data);
}
?>
