let globalsNewUi: GlobalsNewUi = {
    userEntries: {},
    metadataEntries: {},
    entries: {},
    results: [],
    events: [],
    selectedEntries: [],
    libraries: {},
    viewingLibrary: 0n,
}

function findMetadataById(id: bigint): MetadataEntry | null {
    return globalsNewUi.metadataEntries[String(id)] || defaultMetadata(id)
}

function findUserEntryById(id: bigint): UserEntry | null {
    return globalsNewUi.userEntries[String(id)]
}

function findUserEventsById(id: bigint): UserEvent[] {
    return globalsNewUi.events.filter(v => v.ItemId === id)
}

function findInfoEntryById(id: bigint): InfoEntry | null {
    return globalsNewUi.entries[String(id)]
}


async function items_loadUserEntries(): Promise<Record<string, UserEntry>> {
    let items = await api_loadList<UserEntry>("engagement/list-entries")
    let obj: Record<string, UserEntry> = {}
    for (let item of items) {
        obj[String(item.ItemId)] = item
    }
    return globalsNewUi.userEntries = obj
}

async function items_loadInfoEntries() {
    const items = await api_loadList<InfoEntry>("list-entries")

    let obj: Record<string, InfoEntry> = {}
    for (let item of items) {
        obj[String(item.ItemId)] = item
    }

    return globalsNewUi.entries = obj
}

async function items_loadLibraries() {
    const items = await api_queryV3("type = 'Library'")

    librarySelector.innerHTML = '<option value="0">Library</option>'
    for (let item of items) {
        globalsNewUi.libraries[String(item["ItemId"])] = item
    }
}

async function items_loadMetadata(): Promise<Record<string, MetadataEntry>> {
    let items = await api_loadList<MetadataEntry>("metadata/list-entries")
    let obj: Record<string, MetadataEntry> = {}
    for (let item of items) {
        obj[String(item.ItemId)] = item
    }
    return globalsNewUi.metadataEntries = obj
}

function* findDescendants(itemId: bigint) {
    let entries = Object.values(globalsNewUi.entries)
    yield* entries.values()
        .filter(v => v.ParentId === itemId)
}

function* findCopies(itemId: bigint) {
    let entries = Object.values(globalsNewUi.entries)
    yield* entries.values()
        .filter(v => v.CopyOf === itemId)
}

async function loadUserEvents() {
    return globalsNewUi.events = await api_loadList("engagement/list-events")
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
