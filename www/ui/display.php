<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title></title>
    <link href="/css/colors.css" rel="stylesheet">
    <link href="/css/general.css" rel="stylesheet">
</head>

<body>

<?php
    include $_SERVER['DOCUMENT_ROOT'] . "/lib/util.php";
    tmpl("alert-box");
    tmpl("prompt-dialog");
    tmpl("login-dialog");
    tmpl("display-entry");
    tmpl("de-copies");
    tmpl("de-cost-calculation-modifiers");
    tmpl("de-descendants");
    tmpl("de-description");
    tmpl("de-notes");
    tmpl("de-requirements");
    tmpl("de-status-menu");
    tmpl("de-template-editor");
    tmpl("de-recommender");
    tmpl("de-progress");
    tmpl("color-scheme-selector");
    tmpl("confirm-dialog");
    tmpl("new-event-dialog");
    tmpl("close-button");
    tmpl("item-identification-form-dialog");
?>

    <login-dialog></login-dialog>

    <template id="display-entry">
    </template>
    <color-scheme-selector style="display: none;"></color-scheme-selector>
    <alert-box></alert-box>
</body>
<script>
    let mode_curWin = window
    function getAIOWeb(user) {
        return JSON.parse(user.Extra).AIOWeb || {}
    }
</script>
<script src="/config.js"></script>
<script src="/js/items.js"></script>
<script src="/js/api.js"></script>
<script src="/js/notes-parser.js"></script>
<script src="/ui/js_api.js"></script>
<!-- <script src="/ui/calculator.js"></script> -->
<script src="/ui/components.js"></script>
<script src="/ui/globals.js"></script>
<script src="/ui/settings.js"></script>
<script src="/ui/calculator.js"></script>
<script src="/ui/view-modes/modes.js"></script>
<script src="/ui/view-modes/displayEntry.js"></script>
<script src="/ui/ui.js"></script>
<script>
(async() => {
    const settings = await settings_load(getUserUID())
    const urlParams = new URLSearchParams(document.location.search)
    let id = urlParams.get("item-id")
    let uid = urlParams.get("uid")

    doUserStartupUI(settings)

    api_getEntryAll(id, 0).then((e) => {
        items_addItem(e)
        items_setResults([BigInt(id)])
        const m = new DisplayMode(document.body)
        mode_add(m)
        updateInfo2({
            [id]: e
        })
        renderDisplayItem.call(m, e.meta.ItemId)
    })
})()
</script>

</html>
