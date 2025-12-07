
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

    tmpl("sidebar-entry");
    tmpl("new-entry-dialog");
    tmpl("login-dialog");
    tmpl("gallery-entry");
    tmpl("display-entry");
    tmpl("alert-box");
    tmpl("tz-datalist");
    tmpl("color-scheme-selector");

    tmpl("de-status-menu");
    tmpl("de-notes");
    tmpl("de-description");
    tmpl("de-requirements");
    tmpl("de-descendants");
    tmpl("de-copies");
    tmpl("de-cost-calculation-modifiers");
    tmpl("de-template-editor");

    tmpl("event-template");
    tmpl("calendar-template");
    tmpl("tierlist-template");
    tmpl("calc-template");
    tmpl("script-template");
    tmpl("graph-template");

    tmpl("calc-entry");
    tmpl("new-event-dialog");
    tmpl("prompt-dialog");
?>

    <tz-datalist></tz-datalist>

    <datalist id="recommended-by"></datalist>

    <dialog id="items-listing" popover>
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
    <new-event-dialog></new-event-dialog>
    <login-dialog></login-dialog>
    <new-entry-dialog></new-entry-dialog>

    <dialog id="script-select">
    </dialog>

    <div id="main">
        <div id="main-ui" class="overflow">
            <nav id="search-area" aria-label="search and information">

                <div class="flex">
                    <div class="grid row">
                        <a href="javascript:openSettingsUI()" id="help-link">⚙</a>
                        <button onclick="openModalUI('script-select')">run</button>
                    </div>

                    <color-scheme-selector></color-scheme-selector>

                    <button onclick="openModalUI('new-entry')" type="button" id="new-entry-button">➕︎</button>
                </div>

                <form action="javascript:loadSearchUI()" id="sidebar-form" class="flex row wrap">
                    <input type="search" name="search-query" placeholder="search query">
                    <select name="sort-by" title="sort by">
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
                            <option value="finished" title="**does not happen clientside">Finished**</option>
                            <option value="viewing" title="**does not happen clientside">Viewing**</option>
                        </optgroup>
                    </select>

                    <!-- ui relies on this to keep track of the uid -->
                    <select name="uid" hidden>
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
                    <select name="view-toggle" id="view-toggle" class="view-toggle" style='padding-inline: 2ch; height: 100%; text-align: center;'>
                        <option value="entry-output" title="Normal mode">🏠︎</option>
                        <option value="graph-output" title="Graph mode">📊︎</option>
                        <option value="calendar-output" title="Calendar mode">📅︎</option>
                        <option value="event-output" hidden title="Event mode">🗓︎</option>
                        <option value="calc-output" title="Calc mode">🔢︎</option>
                        <option value="gallery-output" title="Gallery mode">🖼︎</option>
                        <option value="script-output" title="Script mode">&lt;></option>
                        <option value="tierlist-output" title="Tierlist mode">S</option>
                    </select>
                    <button id="new-view-window" style='height: 100%;'>🪟</button>
                </div>
            </nav>
            <nav class="sidebar overflow" id="sidebar" aria-label="item selection">
                <div class="sidebar--navigation" id="sidebar-navigation">
                    <label class="center block" style="align-content: center;"><input type="checkbox" name="view-all"
                            id="view-all">View all</label>
                    <input type="text" placeholder="filter" aria-label="filter" id="item-filter">
                    <select id="library-selector">
                    </select>
                </div>
                <div class="sidebar--items" id="sidebar-items">
                </div>
            </nav>

            <section id="viewing-area" class="flex column overflow">

                <div id="error-output">
                    <p id="error"></p>
                </div>

                <div id="entry-output" class="overflow">
                </div>

                <script-template></script-template>

                <tierlist-template></tierlist-template>

                <calendar-template></calendar-template>

                <event-template></event-template>

                <calc-template></calc-template>

                <div id="gallery-output" class="overflow">
                    <div id="gallery-items"></div>
                </div>

                <graph-template></graph-template>
            </section>

            <alert-box></alert-box>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
    <script src="/ui/ui.js"></script>
    <!-- defer because document needs to load first -->
    <script src="/ui/index.js" defer></script>
</body>



</html>

