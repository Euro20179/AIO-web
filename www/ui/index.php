<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>New ui</title>
    <link rel="stylesheet" href="/css/colors.css">
    <link rel="stylesheet" href="/css/general.css">
    <link rel="stylesheet" href="/ui/styles.css">
    <link rel="stylesheet" href="/ui/templates/tierlist.css">
</head>

<body>
<?php
    include $_SERVER['DOCUMENT_ROOT'] . "/lib/util.php";

    foreach([
        "sidebar-entry",
        "new-entry-dialog",
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

    <dialog id="items-listing" popover>
        <close-button></close-button>

        <center>
            <h3>Find Item</h3>
        </center>
        <center>
            <form action="javascript:void(0)" class="flex j-center" id="items-listing-search">
                <input name="items-listing-search" placeholder="new search" type="search">
            </form>
        </center>
        <div id="put-items-to-select">
        </div>
    </dialog>

    <prompt-dialog></prompt-dialog>
    <confirm-dialog></confirm-dialog>
    <new-event-dialog></new-event-dialog>
    <login-dialog></login-dialog>
    <new-entry-dialog></new-entry-dialog>

    <dialog id="script-select">
    </dialog>

    <div id="main">
        <div id="main-ui" class="overflow">
            <nav id="search-area" aria-label="search and information">

                <div class="flex">
                    <div class="grid row" style="grid-template-rows: 1fr 1fr;">
                        <button onclick="openSettingsUI()">⚙</button>
                        <button onclick="openModalUI('script-select')">run</button>
                    </div>

                    <color-scheme-selector></color-scheme-selector>

                    <button onclick="openModalUI('new-entry')" type="button" id="new-entry-button">➕︎</button>
                </div>

                <form action="javascript:loadSearchUI()" id="sidebar-form" class="flex row wrap">
                    <input type="search" name="search-query" placeholder="search query">
                    <span id='sort-by-hint' popover='hint'>Sorting method</span>
                    <select name="sort-by" toggle-hint='sort-by-hint'>
                        <optgroup label="Misc">
                            <option value="">No Sort</option>
                            <option value="item-id">Item Id</option>
                            <option value="release-year" title="*requires metadata">Release year*</option>
                            <option value="cost">Cost</option>
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
                            <option value="viewing">Viewing</option>
                        </optgroup>
                    </select>

                    <!-- ui relies on this to keep track of the uid -->
                    <select name="uid">
                        <option value="0">ALL</option>
                    </select>
                    <button type="submit">🔎</button>
                </form>
                <!--used for proper overflow-->
                <div>
                    <div class="result-stats" id="result-stats">
                    </div>
                </div>
                <div style="justify-self: end;">
                    <select name="view-toggle" id="view-toggle" class="view-toggle" style='height: 100%; text-align: center;'>
                        <option value="entry-output" title="Normal mode">🏠︎ Normal</option>
                        <option value="graph-output" title="Graph mode">📊︎ Graph</option>
                        <option value="calendar-output" title="Calendar mode">📅︎ Calendar</option>
                        <option value="event-output" hidden title="Event mode">🗓︎</option>
                        <option value="calc-output" title="Calc mode">🔢︎ Calc</option>
                        <option value="gallery-output" title="Gallery mode">🖼︎ Gallery</option>
                        <option value="script-output" title="Script mode">&lt;> Script</option>
                        <option value="tierlist-output" title="Tierlist mode">S Tierlist</option>
                    </select>
                    <button id="new-view-window" style='height: 100%;'>🪟</button>
                </div>
            </nav>
            <nav class="sidebar overflow" id="sidebar" aria-label="item selection">
                <div class="sidebar--navigation" id="sidebar-navigation">
                    <label class="center block" style="align-content: center;"><input type="checkbox" name="view-all"
                            id="view-all">View all</label>
                    <select id="library-selector">
                    </select>
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

    <script src="/js/chart.js"></script>
    <script src="/ui/components.js"></script>
    <script src="/config.js"></script>
    <script src="/js/items.js"></script>
    <script src="/js/api.js"></script>
    <script src="/js/notes-parser.js"></script>
    <script src="/ui/js_api.js"></script>
    <script src="/ui/calculator.js"></script>
    <script src="/ui/globals.js"></script>
    <script src="/ui/sidebar.js"></script>
    <script src="/ui/settings.js"></script>
    <script src="/ui/view-modes/modes.js"></script>
    <script src="/ui/view-modes/tier-list.js"></script>
    <script src="/ui/view-modes/calendar.js"></script>
    <script src="/ui/view-modes/graph.js"></script>
    <script src="/ui/view-modes/displayEntry.js"></script>
    <script src="/ui/view-modes/calc.js"></script>
    <script src="/ui/view-modes/gallery.js"></script>
    <script src="/ui/view-modes/scriptMode.js"></script>
    <script src="/ui/view-modes/event-mode.js"></script>
    <script src="/ui/shortcuts.js"></script>
    <script src="/ui/ui.js"></script>
    <!-- defer because document needs to load first -->
    <script src="/ui/index.js" defer></script>
</body>



</html>

