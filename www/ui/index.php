<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>New ui</title>
    <link rel="stylesheet" href="/css/colors.css">
    <link rel="stylesheet" href="/css/general.css">
    <link rel="stylesheet" href="/ui/styles.css">

    <link rel="prefetch" href="/ui/templates/tierlist.css" defer>
    <link rel="prefetch" href="/ui/templates/calc-entry.css">
    <link rel="prefetch" href="/ui/templates/display-entry.css">
    <link rel="prefetch" href="/ui/css-styles/rating-styles.css">
</head>

<body>
<?php
    include $_SERVER['DOCUMENT_ROOT'] . "/lib/util.php";

    foreach([
        "sidebar-entry",
        "new-entry-dialog",
        "item-identification-form-dialog",
        "edit-transaction",
        "login-dialog",
        "gallery-entry",
        "display-entry",
        "alert-box",
        "tz-datalist",
        "color-scheme-selector",
        "close-button",

        "de-status-menu",
        "de-notes",
        "de-description",
        "de-requirements",
        "de-descendants",
        "de-copies",
        "de-cost-calculation-modifiers",
        "de-template-editor",
        "de-recommender",
        "de-progress",

        "event-template",
        "calendar-template",
        "tierlist-template",
        "calc-template",
        "script-template",
        "graph-template",
        "calc-entry",

        "new-event-dialog",
        "prompt-dialog",
        "confirm-dialog",
    ] as $template_name) {
        tmpl($template_name);
    }

?>

    <tz-datalist></tz-datalist>

    <datalist id="recommended-by"></datalist>

    <dialog id="transactions-log">
        <div>
        </div>

        <form method="dialog" class="flex j-center small-gap" style="margin-block-start: var(--small-gap)">
            <button value="Purchased" class="good">Buy</button>
            <button value="Sold" class="bad">Sell</button>
        </form>

        <close-button></close-button>
    </dialog>

    <dialog id="items-listing" popover>
        <center>
            <h3>Find Item</h3>
        </center>
        <center>
            <form action="javascript:void(0)" class="flex j-center" id="items-listing-search">
                <input name="items-listing-search" placeholder="new search" type="search">
            </form>
        </center>
        <form method="dialog">
            <div id="put-items-to-select">
            </div>
        </form>

        <close-button></close-button>
    </dialog>

    <edit-transaction></edit-transaction>

    <prompt-dialog></prompt-dialog>
    <confirm-dialog></confirm-dialog>
    <new-event-dialog></new-event-dialog>
    <login-dialog></login-dialog>
    <item-identification-form-dialog></item-identification-form-dialog>
    <new-entry-dialog></new-entry-dialog>

    <dialog id="script-select">
        <form action="javascript:runFirstUserScriptUI()">
            <input oninput="filterUserScriptsUI(this.value)" placeholder="Filter" />
        </form>
    </dialog>

    <div id="main">
        <div id="main-ui" class="overflow">
            <nav id="search-area" aria-label="search and information">

                <div class="flex">
                    <button command="show-modal" commandfor="script-select">☰</button>
                    <button command="show-modal" commandfor="new-entry" type="button" id="new-entry-button">➕︎</button>
                </div>

                <form action="javascript:loadSearchUI()" id="sidebar-form" class="flex row wrap">
                    <input type="search" name="search-query" placeholder="search query">

                    <span id='sort-by-hint' popover='hint'>Sorting method</span>
                    <select name="sort-by" toggle-hint='sort-by-hint' aria-labelledby="sort-by-hint">
                        <optgroup label="Misc">
                            <option value="">No Sort</option>
                            <option value="item-id">Item Id</option>
                            <option value="release-year" title="*requires metadata">Release year*</option>
                            <option value="cost">Cost</option>
                            <option value="priority">Priority</option>
                        </optgroup>
                        <optgroup label="Title">
                            <option value="user-title">User Title</option>
                            <option value="native-title">Native Title</option>
                            <option value="-aiow-numeric-title">Numeric User Title</option>
                        </optgroup>
                        <optgroup label="Rating">
                            <option value="rating">User Rating</option>
                            <option value="general-rating" title="*requires metadata">General rating*</option>
                        </optgroup>
                        <!-- <option value="rating-disparity" -->
                        <!--     title="How different your rating is from the general consensous"> -->
                        <!--     Rating disparity</option> -->
                        <optgroup label="Event">
                            <option value="added">Added</option>
                            <option value="finished">Finished</option>
                            <option value="viewing">Started</option>
                            <option value="planned">Planned</option>
                        </optgroup>
                    </select>

                    <!-- ui relies on this to keep track of the uid -->
                    <select name="uid" aria-label="user">
                        <option value="0">ALL</option>
                    </select>

                    <button type="submit" class="styleless-button">🔎</button>
                </form>
                <!--used for proper overflow-->
                <div class="flex overflow" style="width: 100%;">
                    <div class="result-stats" id="result-stats">
                    </div>
                </div>
                <div style="justify-self: end;">
                    <select name="view-toggle" id="view-toggle" class="view-toggle" style='height: 100%; text-align: center; vertical-align: top;' aria-label="mode">
                        <option value="entry-output" title="Normal mode">🏠︎ Normal</option>
                        <option value="graph-output" title="Graph mode">📊︎ Graph</option>
                        <option value="calendar-output" title="Calendar mode">📅︎ Calendar</option>
                        <option value="event-output" hidden title="Event mode">🗓︎</option>
                        <option value="calc-output" title="Calc mode">🔢︎ Calc</option>
                        <option value="gallery-output" title="Gallery mode">🖼︎ Gallery</option>
                        <option value="script-output" title="Script mode">&lt;> Script</option>
                        <option value="tierlist-output" title="Tierlist mode">S Tierlist</option>
                        <option value="sidebar-items" title="Tierlist mode" hidden>| Sidebar</option>
                    </select><!-- no whitespace --><button id="new-view-window" style='height: 100%;'>🪟</button>
                </div>

                <div class="flex">

                    <div class="flex row" style="grid-template-rows: 1fr 1fr;">
                        <button onclick="openSettingsUI()" style="margin-block-end: var(--inline-widget-margin)">⚙</button>
                        <color-scheme-selector></color-scheme-selector>
                    </div>
                </div>
            </nav>
            <nav class="sidebar overflow" id="sidebar" aria-label="item selection">
                <div class="sidebar--navigation" id="sidebar-navigation">
                    <label class="center block" style="align-content: center;"><input type="checkbox" name="view-all"
                            id="view-all">All</label>

                    <button id="library-selector" value="0">Library</button>
                </div>
                <div class="sidebar--items" id="sidebar-items">
                </div>
            </nav>

            <section id="viewing-area" class="flex column overflow">

                <p id="error"></p>

            </section>

            <alert-box></alert-box>
        </div>
    </div>

    <script src="/ui/components.js" defer></script>
    <script src="/config.js" defer></script>
    <script src="/js/items.js" defer></script>
    <script src="/js/api.js" defer></script>
    <script src="/js/notes-parser.js" defer></script>
    <script src="/js/testing.js" defer></script>
    <script src="/ui/js_api.js" defer></script>
    <script src="/ui/calculator.js" defer></script>
    <script src="/ui/globals.js" defer></script>
    <script src="/ui/sidebar.js" defer></script>
    <script src="/ui/settings.js" defer></script>
    <script src="/ui/view-modes/modes.js" defer></script>
    <script src="/ui/view-modes/tier-list.js" defer></script>
    <script src="/ui/view-modes/calendar.js" defer></script>
    <script src="/ui/view-modes/graph.js" defer></script>
    <script src="/ui/view-modes/displayEntry.js" defer></script>
    <script src="/ui/view-modes/calc.js" defer></script>
    <script src="/ui/view-modes/gallery.js" defer></script>
    <script src="/ui/view-modes/scriptMode.js" defer></script>
    <script src="/ui/view-modes/event-mode.js" defer></script>
    <script src="/ui/shortcuts.js" defer></script>
    <script src="/ui/ui.js" defer></script>
    <!-- defer because document needs to load first -->
    <script src="/ui/index.js" defer></script>
</body>



</html>

