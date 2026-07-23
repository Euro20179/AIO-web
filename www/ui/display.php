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
    tmpl("close-button");
    tmpl("item-identification-form-dialog");
?>

    <login-dialog></login-dialog>

    <template id="display-entry">
    </template>
    <color-scheme-selector style="display: none;"></color-scheme-selector>
    <div id="notifications" style="position: absolute;"></div>
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
<script src="/ui/sidebar.js"></script>
<script src="/ui/settings.js"></script>
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

    fetch(`${apiPath}/get-all-for-entry?id=${id}&uid=0`).then(async (res) => {
        const template = document.getElementById("display-entry")

        let info, meta, user
        let events = []
        let transactions = []
        let [text, transactionsText] = (await res.text()).trim().split("TRANSACTIONS")
        for (let line of api_deserializeJsonl(text)) {
            if(!line) continue
            if (probablyMetaEntry(line)) {
                meta = line
            } else if (probablyUserItem(line)) {
                user = line
            } else if (probablyInfoEntry(line)) {
                info = line
            } else {
                events.push(line)
            }
        }
        for(let line of api_deserializeJsonl(transactionsText)) {
            if(!line) continue
            transactions.push(line)
        }
        items_addItem({meta, events, info, user, transactions})
        items_setResults([BigInt(id)])
        const m = new DisplayMode(document.body)
        mode_add(m)
        updateInfo2({
            [id]: {
                info, user, events, meta
            }
        })
        renderDisplayItem.call(m, meta.ItemId)
    })
})()
</script>

</html>
