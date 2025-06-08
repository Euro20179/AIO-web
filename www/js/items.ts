type GlobalsNewUi = {
    entries: Record<string, items_Entry>
    results: items_Entry[]
    selectedEntries: InfoEntry[]
    libraries: Record<string, InfoEntry>
    viewingLibrary: bigint
}

let globalsNewUi: GlobalsNewUi = {
    entries: {},
    results: [],
    selectedEntries: [],
    libraries: {},
    viewingLibrary: 0n,
}

type UserStatus = "" |
    "Viewing" |
    "Finished" |
    "Dropped" |
    "Planned" |
    "ReViewing" |
    "Paused" |
    "Waiting"

type EntryType = "Show" |
    "Movie" |
    "MovieShort" |
    "Game" |
    "BoardGame" |
    "Song" |
    "Book" |
    "Manga" |
    "Collection" |
    "Picture" |
    "Meme" |
    "Library"

type UserEvent = {
    ItemId: bigint
    Event: string
    Timestamp: number
    After: number
    TimeZone: string
    Before: number
}

type InfoEntry = {
    ItemId: bigint
    Collection: string
    Format: number
    ArtStyle: number
    Location: string
    Native_Title: string
    ParentId: bigint
    PurchasePrice: number
    Type: EntryType
    En_Title: string
    CopyOf: bigint
    Library: bigint
    Uid: number

    Tags: string[]
}

type UserEntry = {
    ItemId: bigint
    Status: UserStatus
    ViewCount: number
    UserRating: number
    Notes: string
    CurrentPosition: string
    Extra: string
    Minutes: number
}

type MetadataEntry = {
    ItemId: bigint
    Rating: number
    RatingMax: number
    Description: string
    ReleaseYear: number
    Thumbnail: string
    MediaDependant: string
    Datapoints: string
    Title: string
    Native_Title: string
    Provider: string
    ProviderID: string
}


class items_Entry {
    user: UserEntry
    meta: MetadataEntry
    info: InfoEntry

    events: UserEvent[]

    constructor(info: InfoEntry | bigint, user?: UserEntry, meta?: MetadataEntry, events?: UserEvent[]) {
        this.info = typeof info === 'bigint' ? genericInfo(info, 0) : info
        this.user = user || genericUserEntry(typeof info === 'bigint' ? info : info.ItemId)
        this.meta = meta || genericMetadata(typeof info === 'bigint' ? info : info.ItemId)
        this.events = events || []
    }

    get fixedThumbnail() {
        return fixThumbnailURL(this.meta.Thumbnail)
    }

    get ItemId() {
        return this.info.ItemId
    }
}

function items_setResults(items: bigint[]) {
    globalsNewUi.results = []
    for (let id of items) {
        globalsNewUi.results.push(globalsNewUi.entries[String(id)])
    }
}

function items_setEntries(items: InfoEntry[]) {
    for (let item of items) {
        let stashed = globalsNewUi.entries[String(item.ItemId)]
        if (!stashed) {
            globalsNewUi.entries[String(item.ItemId)] = new items_Entry(item, findUserEntryById(item.ItemId), findMetadataById(item.ItemId), findUserEventsById(item.ItemId))
        }
        else {
            stashed.info = item
        }
    }
}

function items_addItem(item: { meta: MetadataEntry, events: UserEvent[], info: InfoEntry, user: UserEntry }) {
    globalsNewUi.entries[String(item.user.ItemId)] = new items_Entry(item.info, item.user, item.meta, item.events)
}

async function loadMetadataById(id: bigint, uid = 0): Promise<MetadataEntry> {
    let m = await api_getEntryMetadata(id, uid)
    if (m === null) {
        alert(`Failed to load metadata for id: ${id}`)
        return globalsNewUi.entries[String(id)].meta = genericMetadata(id)
    }
    return globalsNewUi.entries[String(id)].meta = m
}

async function findMetadataByIdAtAllCosts(id: bigint): Promise<MetadataEntry> {
    let m = findMetadataById(id)
    if (m.Datapoints.match(/"_AIO_GENERIC":true/)) {
        return await loadMetadataById(id)
    }
    return m
}

function findMetadataById(id: bigint): MetadataEntry {
    console.assert(globalsNewUi.entries[String(id)] !== undefined, `metadata entry for ${id} does not exist`)
    return globalsNewUi.entries[String(id)]?.meta || genericMetadata(id)
}

function findUserEntryById(id: bigint): UserEntry {
    console.assert(globalsNewUi.entries[String(id)] !== undefined, `user entry for ${id} does not exist`)
    return globalsNewUi.entries[String(id)]?.user || genericUserEntry(id)
}

function findUserEventsById(id: bigint): UserEvent[] {
    console.assert(globalsNewUi.entries[String(id)] !== undefined, `user events for ${id} does not exist`)
    return globalsNewUi.entries[String(id)]?.events || []
}

function findInfoEntryById(id: bigint): InfoEntry {
    console.assert(globalsNewUi.entries[String(id)] !== undefined, `info entry for ${id} does not exist`)
    return globalsNewUi.entries[String(id)]?.info || genericInfo(id, 0)
}
function genericInfo(itemId: bigint, uid: number): InfoEntry {
    return {
        Uid: uid,
        ItemId: itemId,
        Collection: "",
        Format: 0,
        ArtStyle: 0,
        Location: "",
        Native_Title: "",
        ParentId: 0n,
        PurchasePrice: 0,
        Type: "Show",
        En_Title: "",
        CopyOf: 0n,
        Library: 0n,

        Tags: []
    }
}


function genericMetadata(itemId: bigint): MetadataEntry {
    return {
        ItemId: itemId,
        Rating: 0,
        RatingMax: 0,
        Description: "",
        ReleaseYear: 0,
        Thumbnail: "",
        MediaDependant: "",
        Datapoints: "{\"_AIO_GENERIC\":true}",
        Title: "",
        Native_Title: "",
        Provider: "",
        ProviderID: ""
    }
}

function genericUserEntry(itemId: bigint): UserEntry {
    return {
        ItemId: itemId,
        Status: "",
        ViewCount: 0,
        UserRating: 0,
        Notes: "",
        CurrentPosition: "",
        Extra: "{}",
        Minutes: 0
    }
}

function items_getAllMeta() {
    let meta: Record<string, MetadataEntry> = {}
    for (let key in globalsNewUi.entries) {
        meta[key] = globalsNewUi.entries[key].meta
    }
    return meta
}

async function items_refreshUserEntries(uid: number) {
    let items = await api_loadList<UserEntry>("engagement/list-entries", uid)
    for (let item of items) {
        globalsNewUi.entries[String(item.ItemId)].user = item
    }
}

async function items_refreshInfoEntries(uid: number) {
    let items = await api_loadList<InfoEntry>("list-entries", uid)

    for (let item of items) {
        let stashed = globalsNewUi.entries[String(item.ItemId)]
        if (!stashed) {
            globalsNewUi.entries[String(item.ItemId)] = new items_Entry(item)
        }
        else {
            stashed.info = item
        }
    }

}

async function items_loadLibraries(uid: number) {
    const items = await api_queryV3(`type = 'Library' . entryInfo.uid = ${uid}`, uid)

    for (let item of items) {
        globalsNewUi.libraries[String(item["ItemId"])] = item
    }
}

async function items_refreshMetadata(uid: number) {
    let items = await api_loadList<MetadataEntry>("metadata/list-entries", uid)
    for (let item of items) {
        globalsNewUi.entries[String(item.ItemId)].meta = item
    }
}

function* findDescendants(itemId: bigint) {
    let entries = Object.values(globalsNewUi.entries)
    yield* entries.values()
        .filter(v => v.info.ParentId === itemId)
}

function* findCopies(itemId: bigint) {
    let entries = Object.values(globalsNewUi.entries)
    yield* entries.values()
        .filter(v => v.info.CopyOf === itemId)
}

async function loadUserEvents(uid: number) {
    let events = await api_loadList<UserEvent>("engagement/list-events", uid)
    const grouped = Object.groupBy(events, k => String(k.ItemId))
    for (let evId in grouped) {
        const events = grouped[evId]
        if (globalsNewUi.entries[evId]) {
            //@ts-ignore
            globalsNewUi.entries[evId].events = events
        }
    }
}

function sortEvents(events: UserEvent[]) {
    return events.sort((a, b) => {
        let at = a.Timestamp || a.After
        let bt = b.Timestamp || b.After
        return at - bt
    })
}

const sorts = new Map<string, ((a: InfoEntry, b: InfoEntry) => number)>

sorts.set("rating", (a, b) => {
    let aUInfo = findUserEntryById(a.ItemId)
    let bUInfo = findUserEntryById(b.ItemId)
    if (!aUInfo || !bUInfo) return 0
    return bUInfo?.UserRating - aUInfo?.UserRating
})

sorts.set("added", (a, b) => {
    let ae = findUserEventsById(a.ItemId).find(v => v.Event === "Added")
    let be = findUserEventsById(b.ItemId).find(v => v.Event === "Added")
    let aAdded = ae?.Timestamp || ae?.After || 0
    let bAdded = be?.Timestamp || be?.After || 0
    return bAdded - aAdded
})

sorts.set("general-rating", (a, b) => {
    let am = findMetadataById(a.ItemId)
    let bm = findMetadataById(b.ItemId)
    return bm.Rating / bm.RatingMax - am.Rating / am.RatingMax
})

sorts.set("release-year", (a, b) => {
    let am = findMetadataById(a.ItemId)
    let bm = findMetadataById(b.ItemId)
    return bm.ReleaseYear - am.ReleaseYear
})

sorts.set("cost", (a, b) => {
    return b.PurchasePrice - a.PurchasePrice
})

sorts.set("item-id", (a, b) => Number(b.ItemId - a.ItemId))

sorts.set("rating-disparity", (a, b) => {
    let am = findMetadataById(a.ItemId)
    let au = findUserEntryById(a.ItemId)
    let bm = findMetadataById(b.ItemId)
    let bu = findUserEntryById(b.ItemId)
    if (!bm || !am) return 0
    let bGeneral = normalizeRating(bm.Rating, bm.RatingMax || 100)
    let aGeneral = normalizeRating(am.Rating, am.RatingMax || 100)

    let aUser = Number(au?.UserRating)
    let bUser = Number(bu?.UserRating)


    return (aGeneral - aUser) - (bGeneral - bUser)
})

sorts.set("user-title", (a, b) => {
    return a.En_Title < b.En_Title ? 0 : 1
})

sorts.set("native-title", (a, b) => {
    let am = findMetadataById(a.ItemId)
    let bm = findMetadataById(b.ItemId)
    let at = am.Native_Title || a.Native_Title
    let bt = bm.Native_Title || b.Native_Title
    if (at === "") {
        return bt ? 1 : 0
    }
    if (bt === "") {
        return at ? 0 : 1
    }
    return at < bt ? 0 : 1
})

function items_addSort(name: string, sortFN: ((a: InfoEntry, b: InfoEntry) => number)) {
    sorts.set(name, sortFN)
}

function items_delSort(name: string) {
    sorts.delete(name)
}

function sortEntries(entries: InfoEntry[], sortBy: string) {
    if (sortBy === "") return entries

    let customSort = sorts.get(sortBy)
    if (customSort) {
        entries = entries.sort(customSort)
    }
    return entries
}

function typeToSymbol(type: string) {
    const conversion = {
        "Show": "📺︎",
        "Movie": "📽",
        "MovieShort": "⏯",
        "Book": "📚︎",
        "Manga": "本",
        "Game": "🎮︎",
        "Song": "♫",
        "Collection": "🗄",
        "BoardGame": "🎲︎",
        "Picture": "🖼",
        "Meme": "🃏",
        "Video": "📼",
        "Unowned": "X",
    }
    if (type in conversion) {
        //@ts-ignore
        return conversion[type]
    }
    return type
}

function fixThumbnailURL(url: string) {
    //a / url assumes that the aio server is the same as the web server
    if (url.startsWith("/")) {
        return `${AIO}${url}`
    }
    return url
}

async function formatToName(format: number): Promise<string> {
    const DIGI_MOD = 0x1000
    let out = ""
    if ((format & DIGI_MOD) === DIGI_MOD) {
        format -= DIGI_MOD
        out = " +digital"
    }

    const formats = await api_listFormats()

    if (format >= Object.keys(formats).length) {
        return `unknown${out}`
    }
    return `${formats[format].toUpperCase()}${out}`
}

async function nameToFormat(name: string): Promise<number> {
    const DIGI_MOD = 0x1000
    let val = 0
    name = name.toLowerCase()
    if (name.includes("+digital")) {
        name = name.replace("+digital", "")
        val |= DIGI_MOD
    }

    const formats = Object.fromEntries(Object.entries(await api_listFormats()).map(([k, v]) => [v, Number(k)]))

    val |= formats[name as keyof typeof formats]
    return val
}

function items_calculateCost(itemId: bigint, includeSelf: boolean, includeChildren: boolean, includeCopies: boolean, recursive: boolean) {
    const item = findInfoEntryById(itemId)
    let total = includeSelf ? item.PurchasePrice : 0
    if (includeChildren) {
        let children = Object.values(globalsNewUi.entries).filter(v => v.info.ParentId === itemId)
        for (let child of children) {
            if (recursive) {
                //includeChildren in this case will always be true
                total += items_calculateCost(child.ItemId, includeSelf, true, includeCopies, true)
            } else {
                total += child.info.PurchasePrice
            }
        }
    }
    if (includeCopies) {
        let copies = Object.values(globalsNewUi.entries).filter(v => v.info.CopyOf === itemId)
        for (let copy of copies) {
            if (recursive) {
                //includeChildren in this case will always be true
                total += items_calculateCost(copy.ItemId, includeSelf, true, includeCopies, true)
            } else {
                total += copy.info.PurchasePrice
            }
        }
    }
    return total
}

function items_eventTimeEstimate(event: UserEvent) {
    if (event.Timestamp) {
        return event.Timestamp
    }

    if (event.Before && event.After) {
        return (event.Before + event.After) / 2
    }

    if (event.Before) {
        return event.Before - 1
    }
    if (event.After) {
        return event.After - 1
    }
    return 0
}

//FIXME: does not handle timezones
function items_compareEventTiming(left: UserEvent, right: UserEvent): -1 | 0 | 1 {
    let l = items_eventTimeEstimate(left)
    let r = items_eventTimeEstimate(right)
    if (l == r) {
        return 0
    }
    return l > r ? -1 : 1
}

function items_eventTSHTML(event: UserEvent) {
    const ts = event.Timestamp
    const afterts = event.After
    const beforets = event.Before
    const timeZone = event.TimeZone || "UTC"
    let innerTD = ""

    if (afterts) {
        let date = new Date(afterts)
        let time = date.toLocaleTimeString("en", { timeZone })
        let dd = date.toLocaleDateString("en", { timeZone })
        innerTD += `<span title="${time} (${timeZone})">${dd}</span>`
    }

    if (ts) {
        let date = new Date(ts)
        let time = date.toLocaleTimeString("en", { timeZone })
        let dd = date.toLocaleDateString("en", { timeZone })
        if (innerTD) {
            innerTD += " &lt; "
        }
        innerTD += `<span title="${time} (${timeZone})">${dd}</span>`
        //if there is no exact timestamp, put a ? in the middle of afterts and beforets
    } else {
        if (innerTD) {
            innerTD += " &lt; "
        }
        innerTD += " ? "
    }

    if (beforets) {
        let bdate = new Date(beforets)
        let btime = bdate.toLocaleTimeString("en", { timeZone })
        let bdd = bdate.toLocaleDateString("en", { timeZone })
        if (innerTD) {
            innerTD += " &lt; "
        }
        innerTD += `<span title="${btime} (${timeZone})">${bdd}</span>`
    }

    return innerTD
}

function _cononicalizeEvent(event: UserEvent) {
    return `${event.ItemId}>>${event.Event}:${event.Before}:${event.Timestamp}:${event.After}Z${event.TimeZone}`
}

function items_eventEQ(left: UserEvent, right: UserEvent) {
    return _cononicalizeEvent(left) == _cononicalizeEvent(right)
}
