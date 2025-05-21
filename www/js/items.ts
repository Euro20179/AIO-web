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
        this.info = typeof info === 'bigint' ? genericInfo(info) : info
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

function findMetadataById(id: bigint): MetadataEntry {
    console.assert(globalsNewUi.entries[String(id)] !== undefined)
    return globalsNewUi.entries[String(id)].meta
}

function findUserEntryById(id: bigint): UserEntry {
    console.assert(globalsNewUi.entries[String(id)] !== undefined)
    return globalsNewUi.entries[String(id)].user
}

function findUserEventsById(id: bigint): UserEvent[] {
    console.assert(globalsNewUi.entries[String(id)] !== undefined)
    return globalsNewUi.entries[String(id)].events
}

function findInfoEntryById(id: bigint): InfoEntry {
    console.assert(globalsNewUi.entries[String(id)] !== undefined)
    return globalsNewUi.entries[String(id)].info
}
function genericInfo(itemId: bigint): InfoEntry {
    return {
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
        Datapoints: "{}",
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

async function items_loadEntries(uid: number, loadMeta: boolean = true) {
    let loading: (Promise<InfoEntry[]> | Promise<UserEntry[]> | Promise<MetadataEntry[]>)[] = [
        api_loadList<InfoEntry>("list-entries", uid),
        api_loadList<UserEntry>("engagement/list-entries", uid),
    ]
    if (loadMeta) {
        loading.push(api_loadList<MetadataEntry>("metadata/list-entries", uid))
    }
    const res = await Promise.all(loading)

    let obj: Record<string, items_Entry> = {}
    for (let tbls of res) {
        for (let tbl of tbls) {
            let item = obj[String(tbl.ItemId)] || new items_Entry(tbl.ItemId)
            if (probablyMetaEntry(tbl)) {
                item.meta = tbl
            }
            else if (probablyInfoEntry(tbl)) {
                item.info = tbl
            } else {
                item.user = tbl
            }
            obj[String(tbl.ItemId)] = item
        }
    }

    return globalsNewUi.entries = obj
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

function sortEntries(entries: InfoEntry[], sortBy: string) {
    if (sortBy != "") {
        if (sortBy == "rating") {
            entries = entries.sort((a, b) => {
                let aUInfo = findUserEntryById(a.ItemId)
                let bUInfo = findUserEntryById(b.ItemId)
                if (!aUInfo || !bUInfo) return 0
                return bUInfo?.UserRating - aUInfo?.UserRating
            })
        } else if(sortBy == "added") {
            entries = entries.sort((a, b) => {
                let ae = findUserEventsById(a.ItemId).find(v => v.Event === "Added")
                let be = findUserEventsById(b.ItemId).find(v => v.Event === "Added")
                let aAdded = ae?.Timestamp || ae?.After || 0
                let bAdded = be?.Timestamp || be?.After || 0
                return bAdded - aAdded
            })
        } else if (sortBy == "cost") {
            entries = entries.sort((a, b) => {
                return b.PurchasePrice - a.PurchasePrice
            })
        } else if (sortBy == "general-rating") {
            entries = entries.sort((a, b) => {
                let am = findMetadataById(a.ItemId)
                let bm = findMetadataById(b.ItemId)
                if (!bm || !am) return 0
                return normalizeRating(bm.Rating, bm.RatingMax || 100) - normalizeRating(am.Rating, am.RatingMax || 100)
            })
        } else if (sortBy == "rating-disparity") {
            entries = entries.sort((a, b) => {
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
        } else if (sortBy == "release-year") {
            entries = entries.sort((a, b) => {
                let am = findMetadataById(a.ItemId)
                let bm = findMetadataById(b.ItemId)
                return (bm?.ReleaseYear || 0) - (am?.ReleaseYear || 0)
            })
        } else if(sortBy === "user-title") {
            entries = entries.sort((a, b) => {
                return a.En_Title < b.En_Title ? 0 : 1
            })
        } else if(sortBy === "auto-title") {
            entries = entries.sort((a, b) => {
                let am = findMetadataById(a.ItemId)
                let bm = findMetadataById(b.ItemId)
                let at = am.Title || am.Native_Title || a.En_Title || a.Native_Title
                let bt = bm.Title || bm.Native_Title || b.En_Title || b.Native_Title
                return at < bt ? 0 : 1
            })
        } else if(sortBy === "native-title") {
            entries = entries.sort((a, b) => {
                let am = findMetadataById(a.ItemId)
                let bm = findMetadataById(b.ItemId)
                let at = am.Native_Title || a.Native_Title
                let bt = bm.Native_Title || b.Native_Title
                if(at === "") {
                    return bt ? 1 : 0
                }
                if(bt === "") {
                    return at ? 0 : 1
                }
                return at < bt ? 0 : 1
            })
        }
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
