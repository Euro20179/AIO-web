async function main() {
    setupHintPopovers(document)

    const sortBySelector = dom_getelorthrow(
        '[name="sort-by"]',
        HTMLSelectElement,
    );

    const recommenders = dom_getelorthrow(
        "datalist#recommended-by",
        HTMLDataListElement,
    );

    startupUI({
        scriptSelect: dom_getelorthrow("#script-select", HTMLDialogElement),
        newWindow: document.getElementById("new-view-window"),
        viewToggle: dom_getelorthrow("#view-toggle", HTMLSelectElement),
        viewAllElem: dom_getelorthrow("#view-all", HTMLInputElement),
        statsOutput: document.getElementById("result-stats"),
        searchBox: dom_getelorthrow("[name='search-query']", HTMLInputElement),
        librarySelector: dom_getelorthrow(
            "#library-selector",
            HTMLButtonElement,
        ),
        userSelector: dom_getel('[name="uid"]', HTMLSelectElement),
        sortBySelector,
        errorOut: document.getElementById("error"),
        searchForm: dom_getelorthrow("#sidebar-form", HTMLFormElement),
        recommenders,
        sidebarItems: dom_getelorthrow("#sidebar-items", HTMLElement),
        mainUI: dom_getelorthrow("#main-ui", HTMLElement),
    });

    const urlParams = new URLSearchParams(document.location.search);

    //if the user is logged in, do ui startup script for their user and their user only
    if (
        localStorage.getItem("userUID") &&
        getUserAuth() &&
        !urlParams.has("no-startup")
    ) {
        //prevents error with embeded credentials
        location.hash ||= "#";
        let settings = await settings_load(getUserUID())

        if(!settings) return
        if(settings) settings = settings_all(getUserUID())
        doUserStartupUI(settings);
    }

    if (urlParams.has("display")) {
        setDisplayModeUI(true);
    }


    const onrender = () => {
        //just in case
        removeEventListener("aio-search-performed", onrender);

        const metadataload = () => {
            removeEventListener("aio-metadata-load", metadataload)

            let selected = items_getSelected()[0]
            if(selected) {
                ua_setfavicon(
                    fixThumbnailURL(
                        findMetadataById(
                            selected.ItemId
                        ).Thumbnail
                    )
                )
            }

            //i think this is to reorder everything?:
            if (urlParams.has("view-all")) {
                for (let mode of mode_listOpen()) {
                    selectListUI(getFilteredResultsUI(), true, mode);
                }

                setViewingAllUI(true);
            }
        }

        addEventListener("aio-metadata-loaded", metadataload)

        Promise.all([items_refreshRelations(uid), items_refreshMetadata(uid)]).then(() => {
            for (let item of items_getSelected()) {
                mode_refreshItem(item.ItemId);
            }
        })
    };
    //allow the fetch to happen *after* items are rendered on firefox
    //becasue firefox doesn't render the items until after the fetch for some reason
    addEventListener("aio-search-performed", onrender);

    await fillUserSelectionUI(dom_getel('[name="uid"]', HTMLSelectElement));

    setUIDFromHeuristicsUI();

    fillRecommendedListUI(recommenders, getUidUI());
    loadLibraries(getUidUI());

    let toggle = document.getElementById("view-toggle") as HTMLSelectElement;

    if (!urlParams.get("no-mode")) {
        const mode = urlParams.get("mode") ?? toggle?.value ?? "entry-output";
        mode_setMode(mode);
    }

    const initialSearch =
        urlParams.has("item-id") ?
            urlParams
                .get("item-id")!
                .split(",")
                .map((v) => `metadata.itemid = ${v}`)
                .join(" OR ")
        : urlParams.get("q")

    // mode_setMode(curModeName)

    if (urlParams.has("sort")) {
        sortBySelector.value = String(urlParams.get("sort"))
    }
    const uid = getUidUI();

    //must happen synchronously to make item render properly
    await loadInfoEntries(uid);

    if (initialSearch) {
        ui_search(initialSearch);
    } else if (components.searchBox?.value) {
        //this should be separate because ui_search will add another 3
        // if serachInput.value is something like `3 @hi`
        mkSearchUI({
            "search-query": components.searchBox.value,
        });
    } else {
        let entries = Object.values(items_getAllEntries()).map((v) => v.info);
        entries = sortEntries(entries, sortBySelector.value);
        items_setResults(entries.map((v) => v.ItemId));
        components['sidebarUI']?.render(getFilteredResultsUI(), true);
        //do a fake search-performed event, since that's basically what this is
        dispatchEvent(new CustomEvent("aio-search-performed", {
            detail: {
                results: entries
            }
        }))
    }

    //do this second because events can get really large, and having to wait for it could take a while
    loadUserEvents(uid).then(() => {
        for (let item of items_getSelected()) {
            mode_refreshItem(item.ItemId);
        }
    });

    loadTransactions(uid).then(() => {
        for(let item of items_getSelected()) {
            mode_refreshItem(item.ItemId)
        }
    })
}

main();

addUserScriptUI(
    "Remote -> local thumbnail",
    remote2LocalThumbService,
    "Converts remote (non-data uri) thumbnails to thumbnails hosted on the aio server",
);

addUserScriptUI(
    "Copy Item Id",
    () => {
        const container = fillItemListingUI(items_getAllEntries())
        selectItemUI({
            container
        }).then(id => {
            navigator.clipboard.writeText(id.toString())
                .then(() => alert(`Id coppied (${id})`))
                .catch(() => alert(`Failed to copy id (${id})`))
        })
    },
    "Select an item, and copy its id"
)

addUserScriptUI(
    "Open item",
    () => {
        const container = fillItemListingUI(items_getAllEntries())
        selectItemUI({
            container
        }).then(openDisplayWinUI)
    },
    "Select an item, and open it in a popup window"
)

async function remote2LocalThumbService(this: { servicing: boolean }) {
    if (this.servicing) return;

    this.servicing = true;
    for (let item of items_getResults()) {
        let metadata = item.meta;
        let thumbnail = metadata.Thumbnail;

        let userTitle = item.info.En_Title;
        let userNativeTitle = item.info.Native_Title;

        if (!thumbnail) continue;
        if (
            thumbnail.startsWith(`${apiPath}/resource/thumbnail`) ||
            thumbnail.startsWith(`${apiPath}/resource/get-thumbnail`)
        )
            continue;
        //relative url is local
        if (thumbnail.startsWith("/")) continue;

        //FIXME: this should work, but for some reason just doesn't
        if (thumbnail.startsWith("data:")) continue;
        // if (thumbnail.startsWith(`${location.origin}${apiPath}/resource/thumbnail`)) {
        //     updateThumbnail(metadata.ItemId, `${apiPath}/resource/thumbnail?id=${metadata.ItemId}`)
        //     continue
        // }

        console.log(
            `${userTitle || userNativeTitle || metadata.Title || metadata.Native_Title} Has a remote image url, downloading`,
        );

        authorizedRequest(
            `${apiPath}/resource/download-thumbnail?id=${metadata.ItemId}`,
        )
            .then((res) => {
                if (res == null || res.status !== 200) return "";
                return res.text();
            })
            .then((hash) => {
                if (!hash) return;
                console.log(`THUMBNAIL HASH: ${hash}`);
                api_setThumbnail(
                    metadata.ItemId,
                    `${apiPath}/resource/get-thumbnail?hash=${hash}`,
                )
                    .then((res) => res?.text())
                    .then(console.log);
            });

        await new Promise((res) => setTimeout(res, 200));

        if (!this.servicing) break;
    }

    console.log("ALL IMAGES HAVE BEEN INLINED");

    this.servicing = false;
}

