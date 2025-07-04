type ClientSearchFilters = {
    filterRules: string[]
    newSearch: string
    sortBy: string
}

const newEntryLibrarySelector = document.querySelector("[name=\"libraryId\"]") as HTMLSelectElement
const librarySelector = document.getElementById("library-selector") as HTMLSelectElement
librarySelector.onchange = function() {
    let val = librarySelector.value
    globalsNewUi.viewingLibrary = BigInt(val)

    loadSearchUI()
}

const userSelector = document.querySelector('[name="uid"]') as HTMLSelectElement
userSelector.onchange = function() {
    refreshInfo(getUidUI()).then(() => loadSearchUI())
}

const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement
sortBySelector.onchange = function() {
    sortEntriesUI()
}

function getAIOWeb(user: UserEntry) {
    return JSON.parse(user.Extra).AIOWeb || {}
}

function getUserExtra(user: UserEntry, prop: string) {
    try {
        return getAIOWeb(user)[prop] || null
    }
    catch (err) {
        console.error(err)
        return null
    }
}

function setUserExtra(user: UserEntry, prop: string, value: string) {
    let extra = JSON.parse(user.Extra)
    let AIOWeb = extra.AIOWeb || {}

    //the user can modify this field in the object editor, but it MUST be an object
    if (typeof AIOWeb !== "object") {
        AIOWeb = {}
    }

    AIOWeb[prop] = value
    extra.AIOWeb = AIOWeb
    user.Extra = JSON.stringify(extra)
}

function updateLibraryDropdown() {
    librarySelector.innerHTML = '<option value="0">Library</option>'
    for (let i in globalsNewUi.libraries) {
        let item = globalsNewUi.libraries[i]
        const opt = document.createElement("option")
        opt.value = String(item["ItemId"])
        opt.innerText = item["En_Title"]
        librarySelector.append(opt)
    }
    newEntryLibrarySelector.innerHTML = librarySelector.innerHTML
}

async function loadLibraries() {
    await items_loadLibraries(getUidUI())
    updateLibraryDropdown()
}

async function loadInfoEntries() {
    setError("Loading items")

    await items_refreshInfoEntries(getUidUI())

    setError("")

    items_refreshUserEntries(getUidUI()).then(() => {
        updateInfo2(globalsNewUi.entries)
    })

    return globalsNewUi.entries
}

function defaultMetadata(id: bigint): MetadataEntry {
    return {
        ItemId: id,
        Rating: 0,
        RatingMax: 0,
        Description: "",
        ReleaseYear: 0,
        Thumbnail: "",
        MediaDependant: "{}",
        Datapoints: "{}",
        Native_Title: "",
        Title: "",
        Provider: "",
        Genres: "",
        ProviderID: ""
    }
}


/**
 * pulls out relevant filters for the client
 * has the side effect of modifying search-query, removing any parts deemed filters for the client
 * eg: \[start:end\]
 */
function parseClientsideSearchFiltering(searchForm: FormData): ClientSearchFilters {
    // let start = 0
    // let end = -1

    let search = searchForm.get("search-query") as string
    let inBracket = 0
    let filterStartPos = -1
    for (let i = 0; i < search.length; i++) {
        if (search[i] === "{") inBracket++
        else if (search[i] === "}") inBracket--
        if (i > 2 && search[i - 1] == "-" && search[i] == ">" && inBracket <= 0) {
            filterStartPos = i - 1
            break
        }
    }
    let filters: string[] = []
    if (filterStartPos > -1) {
        filters = search.slice(filterStartPos).split("->").map(v => v.trim())
        search = search.slice(0, filterStartPos)
    }

    let sortBy = searchForm.get("sort-by") as string

    return {
        filterRules: filters,
        newSearch: search,
        sortBy,
    }
}

function applyClientsideSearchFiltering(entries: InfoEntry[], filters: ClientSearchFilters) {

    entries = entries.filter(v => v.Library === globalsNewUi.viewingLibrary)

    if (filters.sortBy.startsWith("-aiow")) {
        entries = sortEntries(entries, filters.sortBy)
    }

    for (let filter of filters.filterRules) {
        filter = filter.trim()
        if (filter.startsWith("is")) {
            let ty = filter.split("is")[1]?.trim()
            if (!ty) continue
            ty = ty.replace(/(\w)(\S*)/g, (_, $1, $2) => {
                return $1.toUpperCase() + $2
            })
            entries = entries.filter(v => v.Type == ty)
        }

        let slicematch = filter.match(/\[(\d*):(-?\d*)\]/)
        if (slicematch) {
            let start = +slicematch[1]
            let end = +slicematch[2]
            entries = entries.slice(start, end)
        }

        if (filter.startsWith("/") && filter.endsWith("/")) {
            let re = new RegExp(filter.slice(1, filter.length - 1))
            entries = entries.filter(v => v.En_Title.match(re))
        } else if (filter == "shuffle" || filter == "shuf") {
            entries = entries.sort(() => Math.random() - Math.random())
        } else if (filter.startsWith("head")) {
            const n = filter.slice("head".length).trim() || 1
            entries = entries.slice(0, Number(n))
        } else if (filter.startsWith("tail")) {
            const n = filter.slice("tail".length).trim() || 1
            entries = entries.slice(entries.length - Number(n))
        } else if (filter.startsWith("sort")) {
            let type = filter.slice("sort".length).trim() || "a"
            const reversed = type.startsWith("-") ? -1 : 1
            if (reversed == -1) type = type.slice(1)
            switch (type[0]) {
                case "a":
                    entries.sort((a, b) => (a.En_Title > b.En_Title ? 1 : -1) * reversed)
                    break;
            }
        } else if (filter === "!child") {
            entries = entries.filter(v => v.ParentId === 0n)
        } else if (filter === "!copy") {
            entries = entries.filter(v => v.CopyOf === 0n)
        }
    }

    // if (filters.end < 0) {
    //     filters.end += entries.length + 1
    // }
    return entries
    //
    // return entries.slice(filters.start, filters.end)
}


function normalizeRating(rating: number, maxRating: number) {
    return rating / maxRating * 100
}

function updateInfo2(toUpdate: Record<string, Partial<{ user: UserEntry, events: UserEvent[], meta: MetadataEntry, info: InfoEntry }>>, del: boolean = false) {
    let updatedLibraries = false
    for (let id in toUpdate) {
        if (del) {
            delete globalsNewUi.entries[id]
            continue
        }

        const { user, events, meta, info } = toUpdate[id]

        if (info?.Type === "Library") {
            if (del)
                delete globalsNewUi.libraries[id]
            else
                globalsNewUi.libraries[id] = info

            updatedLibraries = true
        }


        if (user) {
            globalsNewUi.entries[id].user = user
        }
        if (events) {
            globalsNewUi.entries[id].events = events
        }
        if (meta) {
            globalsNewUi.entries[id].meta = meta
        }
        if (info) {
            globalsNewUi.entries[id].info = info
        }

        refreshSidebarItem(BigInt(id))
        mode_refreshItem(BigInt(id))

        const parent = (info || findInfoEntryById(BigInt(id)))?.ParentId
        if (parent && globalsNewUi.entries[String(parent)]) {
            //if the parent is this, or itself, just dont update
            if (![BigInt(id), parent].includes(globalsNewUi.entries[String(parent)].info.ParentId)) {
                updateInfo2({
                    [String(parent)]: {
                        info: findInfoEntryById(parent),
                        user: findUserEntryById(parent),
                        events: findUserEventsById(parent),
                        meta: findMetadataById(parent)
                    }
                })
            }
        }
    }

    if (updatedLibraries) {
        updateLibraryDropdown()
    }
}

async function refreshInfo(uid: number) {
    await Promise.all([
        loadLibraries(),
        loadInfoEntries(),
    ])
    return Promise.all([
        loadUserEvents(uid),
        items_refreshMetadata(uid)
    ])
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
            for (let item of globalsNewUi.selectedEntries) {
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
    fillUserSelectionUI().then(() => {
        setUIDFromHeuristicsUI()
    })

    loadLibraries()

    let toggle = document.getElementById("view-toggle") as HTMLSelectElement

    if (!urlParams.get("no-mode")) {
        const mode = urlParams.get("mode") || toggle.value || "entry-output"
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
    await loadInfoEntries()


    if (initialSearch || searchInput.value) {
        ui_search(initialSearch || searchInput.value, () => {
            dispatchEvent(new CustomEvent("aio-items-rendered"))
        })
    } else {
        let entries = Object.values(globalsNewUi.entries).map(v => v.info)
        entries = sortEntries(entries, sortBySelector.value)
        items_setResults(entries.map(v => v.ItemId))
        renderSidebar(getFilteredResultsUI(), true)
        dispatchEvent(new CustomEvent("aio-items-rendered"))
    }

    //do this second because events can get really large, and having to wait for it could take a while
    loadUserEvents(uid).then(() => {
        for (let item of globalsNewUi.selectedEntries) {
            mode_refreshItem(item.ItemId)
        }
    })
}

main()

let servicing = false
async function remote2LocalThumbService() {
    if (servicing) return

    servicing = true
    for (let item of globalsNewUi.results) {
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
