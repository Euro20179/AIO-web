type ClientSearchFilters = {
    filterRules: string[]
    newSearch: string
    sortBy: string
}

const displayItems = document.getElementById("entry-output") as HTMLElement

const statsOutput = document.getElementById("result-stats") as HTMLElement

const librarySelector = document.getElementById("library-selector") as HTMLSelectElement
const newEntryLibrarySelector = document.querySelector("[name=\"libraryId\"]") as HTMLSelectElement

const userSelector = document.querySelector('[name="uid"]') as HTMLSelectElement
userSelector.onchange = function() {
    refreshInfo(getUidUI()).then(() => loadSearch())
}

const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement
sortBySelector.onchange = function() {
    let newEntries = sortEntries(globalsNewUi.results.map(v => v.info), sortBySelector.value || "user-title")
    items_setResults(newEntries.map(v => v.ItemId))
    clearItems()
    clearSidebar()
    renderSidebar(newEntries)
}

function getUserExtra(user: UserEntry, prop: string) {
    return JSON.parse(user.Extra).AIOWeb?.[prop] || null
}

function setUserExtra(user: UserEntry, prop: string, value: string) {
    let extra = JSON.parse(user.Extra)
    let AIOWeb = extra.AIOWeb || {}

    //the user can modify this field, but it MUST be an object
    if (typeof AIOWeb !== "object") {
        AIOWeb = {}
    }

    AIOWeb[prop] = value
    extra.AIOWeb = AIOWeb
    user.Extra = JSON.stringify(extra)
}

function resetResultStats() {
    for (let node of statsOutput.querySelectorAll(".stat") || []) {
        node.setAttribute("data-value", "0")
    }
    return {
        totalCost: 0,
        count: 0
    }
}

let resultStatsProxy = new Proxy({
    count: 0,
    totalCost: 0,
    results: 0,
    reset() {
        this.count = 0
        this.totalCost = 0
    }
}, {
    set(_obj, prop, value) {
        //@ts-ignore
        if (!Reflect.set(...arguments)) {
            return false
        }
        let el = statsOutput.querySelector(`[data-stat-name="${String(prop)}"]`) as HTMLElement
        el.setAttribute("data-value", String(value))
        return true
    }
})

type ResultStats = {
    totalCost: number
    count: number
    results: number
}

function setResultStat(key: keyof ResultStats, value: number) {
    resultStatsProxy[key] = value
}

function changeResultStats(key: keyof ResultStats, value: number) {
    resultStatsProxy[key] += value
}

function changeResultStatsWithItem(item: InfoEntry, multiplier: number = 1) {
    if (!item) return
    changeResultStats("totalCost", item.PurchasePrice * multiplier)
    changeResultStats("count", 1 * multiplier)
}

function changeResultStatsWithItemList(items: InfoEntry[], multiplier: number = 1) {
    for (let item of items) {
        changeResultStatsWithItem(item, multiplier)
    }
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
    await items_loadEntries(getUidUI(), false)

    setResultStat("results", Object.keys(globalsNewUi.entries).length)

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
        ProviderID: ""
    }
}


/**
 * @description pulls out relevant filters for the client
 * has the side effect of modifying search-query, removing any parts deemed filters for the client
 * eg: \[start:end\]
 */
function parseClientsideSearchFiltering(searchForm: FormData): ClientSearchFilters {
    // let start = 0
    // let end = -1

    let search = searchForm.get("search-query") as string
    let filters;
    [search, ...filters] = search.split("->")
    filters = filters.map(v => v.trim())

    let sortBy = searchForm.get("sort-by") as string

    return {
        filterRules: filters,
        newSearch: search,
        sortBy,
    }
}

function applyClientsideSearchFiltering(entries: InfoEntry[], filters: ClientSearchFilters) {

    entries = entries.filter(v => v.Library === globalsNewUi.viewingLibrary)

    if (filters.sortBy !== "") {
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
                case "e": {
                    const fn = type.slice(1)
                    entries.sort(() => eval(fn))
                    break
                }
            }
        } else if (filter.startsWith("filter")) {
            let expr = filter.slice("filter".length).trim()
            entries = entries.filter((item) => eval(expr))
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

//FIXME: onload, sorts that require metadata dont work because the metadata hasn't loaded
async function loadSearch() {
    let form = document.getElementById("sidebar-form") as HTMLFormElement

    let formData = new FormData(form)

    let filters = parseClientsideSearchFiltering(formData)

    let entries = await api_queryV3(String(filters.newSearch) || "#", Number(formData.get("uid")) || 0)

    entries = applyClientsideSearchFiltering(entries, filters)

    setResultStat("results", entries.length)

    items_setResults(entries.map(v => v.ItemId))

    clearItems()
    if (entries.length === 0) {
        setError("No results")
        clearSidebar()
        return
    }
    renderSidebar(entries)
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
        if(mode.refresh) {
            mode.refresh(BigInt(id))
        }
    }

    if(updatedLibraries) {
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

    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement | null
    if (!uidSelector) {
        alert("Failed to 💧H Y D R A T E💧 the user selection list, aborting")
        return
    }

    api_listAccounts().then(accounts => {
        for (let acc of accounts) {
            const opt = document.createElement("option")
            const [id, name] = acc.split(":")

            ACCOUNTS[Number(id)] = name

            opt.value = id
            opt.innerText = name
            uidSelector.append(opt)
        }
    })

    if (urlParams.has("uname")) {
        let uid = Object.entries(ACCOUNTS).filter(([_, name]) => name === urlParams.get("uname") as string)[0]

        if (!uid) {
            setError(`username: ${urlParams.get("uname")} does not exist`)
            return
        }
        uidSelector.value = String(uid)
    } else if (urlParams.has("uid")) {
        uidSelector.value = urlParams.get("uid") as string
    }

    const initialSearch = urlParams.has("item-id") ? `metadata.ItemId = ${urlParams.get("item-id")}` : urlParams.get("q")
    const display_item_only = urlParams.has("display")

    const searchInput = document.querySelector("[name=\"search-query\"]") as HTMLInputElement
    if (searchInput && initialSearch) {
        searchInput.value = decodeURIComponent(initialSearch)
    }

    mode_setMode(curModeName)

    const uid = getUidUI()
    await Promise.all([loadLibraries(), loadInfoEntries()])

    //must happen synchronously to make item render properly
    await loadUserEvents(uid)

    //do this second because metadata can get really large, and having to wait for it could take a while
    items_refreshMetadata(uid).then(() => {
        //clear and rerender sidebar to make thumbnail load when it appears on screen
        //it loads when it appears on screen because of the observation thing, which only happens when the item is first rendered in the sidebar
        clearSidebar()


        const data = getSearchDataUI()
        let newEntries = sortEntries(globalsNewUi.results.map(v => v.info), data.get("sort-by")?.toString() || "user-title")
        items_setResults(newEntries.map(v => v.ItemId))
        for (let item of globalsNewUi.results) {
            mode?.refresh?.(item.ItemId)
            renderSidebarItem(item.info)
        }
    })

    api_listTypes().then(types => {
        const typeDropdown = document.querySelector("#new-item-form [name=\"type\"]")

        if (typeDropdown === null) {
            console.error("type dropdown could not be found")
            return
        }

        for (let type of types.sort()) {
            const option = document.createElement("option")
            option.value = type
            option.innerText = type
            typeDropdown.append(option)
        }
    })

    librarySelector.onchange = function() {
        let val = librarySelector.value
        globalsNewUi.viewingLibrary = BigInt(val)

        loadSearch()
    }

    if (initialSearch) {
        let formData = getSearchDataUI()
        formData.set("search-query", initialSearch)

        let filters = parseClientsideSearchFiltering(formData)
        let entries = await api_queryV3(String(filters.newSearch) || "#", Number(formData.get("uid")) || 0)
        entries = applyClientsideSearchFiltering(entries, filters)

        setResultStat("results", entries.length)

        items_setResults(entries.map(v => v.ItemId))

        if (entries.length === 0) {
            setError("No results")
            return
        }
        renderSidebar(entries)
    } else {
        await loadSearch()
    }

    if (display_item_only) {
        let mainUI = document.getElementById("main-ui")
        mainUI?.classList.add("display-mode")
    }
}

main()

let servicing = false
async function remote2LocalThumbService() {
    if (servicing) return

    servicing = true
    for (let item in globalsNewUi.results) {
        let metadata = globalsNewUi.results[item].meta
        let thumbnail = metadata.Thumbnail

        let userTitle = globalsNewUi.entries[item].info.En_Title
        let userNativeTitle = globalsNewUi.entries[item].info.Native_Title

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
