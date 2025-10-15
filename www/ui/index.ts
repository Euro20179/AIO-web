type ClientSearchFilters = {
    filterRules: string[]
    newSearch: string
    sortBy: string
}

async function main() {
    const urlParams = new URLSearchParams(document.location.search)

    if (urlParams.has("display")) {
        setDisplayModeUI(true)
    } else if (urlParams.has("catalog")) {
        openCatalogModeUI()
    }

    const onrender = () => {
        //just in case
        removeEventListener("aio-items-rendered", onrender)
        items_refreshMetadata(uid).then(() => {
            for (let item of items_getSelected()) {
                mode_refreshItem(item.ItemId)
            }

            const ev = new CustomEvent("aio-metadata-loaded")
            dispatchEvent(ev)
        })
    }
    //allow the fetch to happen *after* items are rendered on firefox
    //becasue firefox doesn't render the items until after the fetch for some reason
    addEventListener("aio-items-rendered", onrender)

    //if the user is logged in, do ui startup script for their user and their user only
    if (localStorage.getItem("userUID") && getUserAuth() && !urlParams.has("no-startup")) {
        //prevents error with embeded credentials
        location.hash ||= "#"
        const settings = await getSettings(Number(localStorage.getItem("userUID")))
        doUIStartupScript(settings.UIStartupScript, settings.StartupLang)
    }


    fillFormatSelectionUI()
    fillTypeSelectionUI()
    await fillUserSelectionUI()
    setUIDFromHeuristicsUI()

    loadLibraries(getUidUI())

    let toggle = document.getElementById("view-toggle") as HTMLSelectElement

    if (!urlParams.get("no-mode")) {
        const mode = urlParams.get("mode") || toggle?.value || "entry-output"
        mode_setMode(mode)
    }

    const initialSearch = (
        urlParams.has("item-id")
            ? urlParams.get("item-id")!.split(",")
                .map(v => `metadata.itemid = ${v}`)
                .join(" OR ")
            : urlParams.get("q")
    )

    const searchInput = document.querySelector("[name=\"search-query\"]") as HTMLInputElement

    // mode_setMode(curModeName)

    const uid = getUidUI()

    //must happen synchronously to make item render properly
    await loadInfoEntries(uid)


    if (initialSearch || searchInput.value) {
        ui_search(initialSearch || searchInput.value, () => {
            dispatchEvent(new CustomEvent("aio-items-rendered"))
        })
    } else {
        let entries = Object.values(items_getAllEntries()).map(v => v.info)
        entries = sortEntries(entries, sortBySelector.value)
        items_setResults(entries.map(v => v.ItemId))
        renderSidebar(getFilteredResultsUI(), true)
        dispatchEvent(new CustomEvent("aio-items-rendered"))
    }

    //do this second because events can get really large, and having to wait for it could take a while
    loadUserEvents(uid).then(() => {
        for (let item of items_getSelected()) {
            mode_refreshItem(item.ItemId)
        }
    })
}

main()

addUserScriptUI("Remote -> local thumbnail", remote2LocalThumbService, "Converts remote (non-data uri) thumbnails to thumbnails hosted on the aio server")

let servicing = false
async function remote2LocalThumbService() {
    if (servicing) return

    servicing = true
    for (let item of items_getResults()) {
        let metadata = item.meta
        let thumbnail = metadata.Thumbnail

        let userTitle = item.info.En_Title
        let userNativeTitle = item.info.Native_Title

        if (!thumbnail) continue
        if (thumbnail.startsWith(`${apiPath}/resource/thumbnail`) || thumbnail.startsWith(`${apiPath}/resource/get-thumbnail`)) continue
        //relative url is local
        if (thumbnail.startsWith("/")) continue

        //FIXME: this should work, but for some reason just doesn't
        if (thumbnail.startsWith("data:")) continue
        // if (thumbnail.startsWith(`${location.origin}${apiPath}/resource/thumbnail`)) {
        //     updateThumbnail(metadata.ItemId, `${apiPath}/resource/thumbnail?id=${metadata.ItemId}`)
        //     continue
        // }

        console.log(`${userTitle || userNativeTitle || metadata.Title || metadata.Native_Title} Has a remote image url, downloading`)

        authorizedRequest(`${apiPath}/resource/download-thumbnail?id=${metadata.ItemId}`).then(res => {
            if (res == null || res.status !== 200) return ""
            return res.text()
        }).then(hash => {
            if (!hash) return
            console.log(`THUMBNAIL HASH: ${hash}`)
            api_setThumbnail(metadata.ItemId, `${apiPath}/resource/get-thumbnail?hash=${hash}`).then(res => res?.text()).then(console.log)
        })

        await new Promise(res => setTimeout(res, 200))

        if (!servicing) break
    }

    console.log("ALL IMAGES HAVE BEEN INLINED")

    servicing = false
}
