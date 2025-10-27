/**
 * REQUIRES: api.ts
 * DESCRIPTION:
 * contains the global state of all entries, libraries, selected entries, etc..
 * in addition contains functions that interact with the state,
 * such as retrieving and setting entries
 */

//for format
const DIGI_MOD = 0x1000

const AS_ANIME = 1
const AS_CARTOON = 2
const AS_HANDRAWN = 4
const AS_DIGITAL = 8
const AS_CGI = 16
const AS_LIVE_ACTION = 32
const AS_2D = 64
const AS_3D = 128

type ASName = 
	| "Anime" 
	| "Cartoon" 
	| "Handrawn" 
	| "Digital" 
	| "CGI" 
	| "Liveaction" 
	| "2D" 
	| "3D"

type ArtStyle = typeof AS_ANIME
    | typeof AS_CARTOON
    | typeof AS_HANDRAWN
    | typeof AS_DIGITAL
    | typeof AS_CGI
    | typeof AS_LIVE_ACTION

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
    "Library" |
    "Albumn" |
    "Soundtrack"

type UserEvent = {
    EventId: number
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
    Requires: bigint
    RecommendedBy: string

    Tags: string[]
}

type UserEntry = {
    Uid: number,
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
    Uid: number,
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
    Genres: string
}


type GlobalsNewUi = {
    entries: Record<string, items_Entry>
    results: items_Entry[]
    selectedEntries: InfoEntry[]
    libraries: Record<string, InfoEntry>
    viewingLibrary: bigint
}

let _globalsNewUi: GlobalsNewUi = {
    entries: {},
    results: [],
    selectedEntries: [],
    libraries: {},
    viewingLibrary: 0n,
}

class items_Entry {
    user: UserEntry
    meta: MetadataEntry
    info: InfoEntry

    events: UserEvent[]

    constructor(info: InfoEntry | bigint, user?: UserEntry, meta?: MetadataEntry, events?: UserEvent[]) {
        this.info = typeof info === 'bigint' ? genericInfo(info, 0) : info
        this.user = user || genericUserEntry(typeof info === 'bigint' ? info : info.ItemId, this.info.Uid)
        this.meta = meta || genericMetadata(typeof info === 'bigint' ? info : info.ItemId, this.info.Uid)
        this.events = events || []
    }

    get fixedThumbnail() {
        return fixThumbnailURL(this.meta.Thumbnail)
    }

    get ItemId() {
        return this.info.ItemId
    }
}

function items_setCurrentLibrary(id: bigint) {
    _globalsNewUi.viewingLibrary = id
}

function items_getCurrentLibrary(): bigint {
    return _globalsNewUi.viewingLibrary
}

function items_getLibraries(): Record<string, InfoEntry> {
    return _globalsNewUi.libraries
}

function items_setLibrary(info: InfoEntry) {
    _globalsNewUi.libraries[String(info.ItemId)] = info
}
function items_deleteLibrary(id: string) {
    delete _globalsNewUi.libraries[id]
}

/**
 * Sets the global results list
 * @param {bigint[]} items - the item ids to set as the reults
*/
function items_setResults(items: bigint[]) {
    _globalsNewUi.results = []
    for (let id of items) {
        _globalsNewUi.results.push(_globalsNewUi.entries[String(id)])
    }
}

function items_getResults(): items_Entry[] {
    return _globalsNewUi.results
}

function items_getSelected(): InfoEntry[] {
    return _globalsNewUi.selectedEntries
}

function items_clearSelected() {
    _globalsNewUi.selectedEntries = []
}

function items_selectById(id: bigint): void {
    _globalsNewUi.selectedEntries.push(_globalsNewUi.entries[String(id)].info)
}

function items_setSelected(items: InfoEntry[]) {
    _globalsNewUi.selectedEntries = items
}

function items_deselectById(id: bigint) {
    _globalsNewUi.selectedEntries = _globalsNewUi.selectedEntries.filter(v => v.ItemId !== id)
}

/**
 * Updates or creates entries in the global entries map
 * @param {InfoEntry[]} items - the items to update or create
*/
function items_setEntries(items: InfoEntry[]) {
    for (let item of items) {
        let stashed = _globalsNewUi.entries[String(item.ItemId)]
        if (!stashed) {
            _globalsNewUi.entries[String(item.ItemId)] = new items_Entry(item, findUserEntryById(item.ItemId), findMetadataById(item.ItemId), findUserEventsById(item.ItemId))
        }
        else {
            stashed.info = item
        }
    }
}

function items_updateEntryById(id: string, { user, events, meta, info }: Partial<{
    user: UserEntry,
    events: UserEvent[],
    meta: MetadataEntry,
    info: InfoEntry
}>) {
    user && (_globalsNewUi.entries[id].user = user)
    events && (_globalsNewUi.entries[id].events = events)
    meta && (_globalsNewUi.entries[id].meta = meta)
    info && (_globalsNewUi.entries[id].info = info)
}

function items_delEntry(item: bigint) {
    delete _globalsNewUi.entries[String(item)]
}

/**
 * Adds an item to the global entries map
 * @param item - the item to add
*/
function items_addItem(item: { meta: MetadataEntry, events: UserEvent[], info: InfoEntry, user: UserEntry }) {
    _globalsNewUi.entries[String(item.user.ItemId)] = new items_Entry(item.info, item.user, item.meta, item.events)
}

async function loadMetadataById(id: bigint, uid = 0): Promise<MetadataEntry> {
    let m = await api_getEntryMetadata(id, uid)
    if (m === null) {
        alert(`Failed to load metadata for id: ${id}`)
        return _globalsNewUi.entries[String(id)].meta = genericMetadata(id, uid)
    }
    return _globalsNewUi.entries[String(id)].meta = m
}

async function findMetadataByIdAtAllCosts(id: bigint): Promise<MetadataEntry> {
    let m = findMetadataById(id)
    if (m.Datapoints.match(/"_AIO_GENERIC":true/)) {
        return await loadMetadataById(id)
    }
    return m
}

function items_getAllEntries() {
    return _globalsNewUi.entries
}

/**
    * Finds the metadata for an entry by id
    * If it can't find it, a generic metadata object is returned
    * @param {bigint} id - the id to find metadata for
    * @returns {MetadataEntry}
*/
function findMetadataById(id: bigint): MetadataEntry {
    console.assert(_globalsNewUi.entries[String(id)] !== undefined, `metadata entry for ${id} does not exist`)
    return _globalsNewUi.entries[String(id)]?.meta || genericMetadata(id, 0)
}

/**
    * Finds the user info for an entry by id
    * If it can't find it, a generic user info object is returned
    * @param {bigint} id - the id to find user info for
    * @returns {UserEntry}
*/
function findUserEntryById(id: bigint): UserEntry {
    console.assert(_globalsNewUi.entries[String(id)] !== undefined, `user entry for ${id} does not exist`)
    return _globalsNewUi.entries[String(id)]?.user || genericUserEntry(id, 0)
}

/**
    * Finds the event list for an entry by id
    * If it can't find it, an empty list is returned
    * @param {bigint} id - the id to find events for
    * @returns {UserEvent[]}
*/
function findUserEventsById(id: bigint): UserEvent[] {
    console.assert(_globalsNewUi.entries[String(id)] !== undefined, `user events for ${id} does not exist`)
    return _globalsNewUi.entries[String(id)]?.events || []
}

/**
    * Finds the info for an entry by id
    * If it can't find it, a generic info object is returned
    * @param {bigint} id - the id to find info for
    * @returns {InfoEntry}
*/
function findInfoEntryById(id: bigint): InfoEntry {
    console.assert(_globalsNewUi.entries[String(id)] !== undefined, `info entry for ${id} does not exist`)
    return _globalsNewUi.entries[String(id)]?.info || genericInfo(id, 0)
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
        Requires: 0n,
        RecommendedBy: "",

        Tags: []
    }
}


function genericMetadata(itemId: bigint, uid: number): MetadataEntry {
    return {
        Uid: uid,
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
        ProviderID: "",
        Genres: "",
    }
}

function genericUserEntry(itemId: bigint, uid: number): UserEntry {
    return {
        Uid: uid,
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

/**
    * Puts the metadata for all entries in the global entries map into an object
    * @returns a record with item ids for keys, and MetadataEntry values
*/
function items_getAllMeta() {
    let meta: Record<string, MetadataEntry> = {}
    for (let key in _globalsNewUi.entries) {
        meta[key] = _globalsNewUi.entries[key].meta
    }
    return meta
}

/**
    * loads all user info, and updates the global entries list
*/
async function items_refreshUserEntries(uid: number) {
    let items = await api_loadList<UserEntry>("engagement/list-entries", uid)
    for (let item of items) {
        try {
            _globalsNewUi.entries[String(item.ItemId)].user = item
        } catch (err) {
            console.error(`${item.ItemId} is an orphaned user entry`)
        }
    }
}

/**
    * loads all info, and updates the global entries list, creating new entries if they dont exist
*/
async function items_refreshInfoEntries(uid: number) {
    let items = await api_loadList<InfoEntry>("list-entries", uid)

    for (let item of items) {
        let stashed = _globalsNewUi.entries[String(item.ItemId)]
        if (!stashed) {
            _globalsNewUi.entries[String(item.ItemId)] = new items_Entry(item)
        }
        else {
            stashed.info = item
        }
    }

}

/**
    * loads all libraries, and puts them in the global libraries map
*/
async function items_loadLibraries(uid: number) {
    const items = await api_queryV3(`type = 'Library' . entryInfo.uid = ${uid}`, uid)

    for (let item of items) {
        _globalsNewUi.libraries[String(item["ItemId"])] = item
    }
}

/**
    * loads all metadata info, and updates the global entries list
*/
async function items_refreshMetadata(uid: number) {
    let items = await api_loadList<MetadataEntry>("metadata/list-entries", uid)
    for (let item of items) {
        _globalsNewUi.entries[String(item.ItemId)].meta = item
    }
}

function* findDescendants(itemId: bigint) {
    let entries = Object.values(_globalsNewUi.entries)
    yield* entries.values()
        .filter(v => v.info.ParentId === itemId)
}

function* findCopies(itemId: bigint) {
    let entries = Object.values(_globalsNewUi.entries)
    yield* entries.values()
        .filter(v => v.info.CopyOf === itemId)
}

async function loadUserEvents(uid: number) {
    let events = await api_loadList<UserEvent>("engagement/list-events", uid)
    const grouped = Object.groupBy(events, k => String(k.ItemId))
    for (let entry in _globalsNewUi.entries) {
        //we must loop through all entries because :
        //if an item had an event, but now has 0 events, if we loop through the new events, it will never hit that item that now has no events
        //therefore it will never be updated
        _globalsNewUi.entries[entry].events = grouped[entry] || []
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
    return ((bm.Rating / bm.RatingMax) || 0) - ((am.Rating / am.RatingMax) || 0)
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

sorts.set("-aiow-numeric-title", (a, b) => {
    let at = a.En_Title || a.Native_Title
    let bt = b.En_Title || b.Native_Title

    const search = /\d+/
    let an = at.match(search)?.[0]
    let bn = bt.match(search)?.[0]
    return (Number(an) - Number(bn)) || 1
})

/**
    * adds a new sort method that sortEntries can use
    * @param {string} name - the name of the sort
    * @param {((a: InfoEntry, b: InfoEntry) => number} sortFN - the function that does the sorting
*/
function items_addSort(name: string, sortFN: ((a: InfoEntry, b: InfoEntry) => number), category = "custom") {
    sorts.set(`-aiow-${name}`, sortFN)
    return `-aiow-${name}`
}

/**
    * deletes a sort method
    * @param {string} name - the sort to delete
*/
function items_delSort(name: string) {
    sorts.delete(name)
}

/**
    * sorts a list of entries
    * @param {InfoEntry[]} entries - the entries to sort
    * @param {string} sortBy - the sorting method to use
*/
function sortEntries(entries: InfoEntry[], sortBy: string) {
    if (sortBy === "") return entries

    let customSort = sorts.get(sortBy)
    if (customSort) {
        entries = entries.sort(customSort)
    }
    return entries
}

/**
    * converts an item type to a symbol
    * @param {string} type - the type to convert
    * @returns {string} - a 1 character symbol
*/
function typeToSymbol(type: string): string {
    const conversion = {
        "Show": "📺︎",
        "Movie": "📽",
        "MovieShort": "⏯",
        "Book": "📚︎",
        "ShortStory": "S📚︎",
        "Manga": "本",
        "Game": "🎮︎",
        "Song": "♫",
        "Collection": "🗄",
        "BoardGame": "🎲︎",
        "Picture": "🖼",
        "Meme": "🃏",
        "Video": "📼",
        "Albumn": "A♫",
        "Soundtrack": "📺︎♫",
        "Unowned": "X",
    }
    if (type in conversion) {
        //@ts-ignore
        return conversion[type]
    }
    return type
}

/**
    * converts an item format to a symbol
    * @param {string} format - the type to convert
    * @returns {string} - a symbol with an optional `+d`
*/
function items_formatToSymbol(format: number): string {
    let out = ""
    if (items_isDigitized(format)) {
        format -= DIGI_MOD
        out = "+d"
    }
    return {
        0: "📼",
        1: "💿︎",
        2: "📀︎",
        3: "<font color='#007fb6'>📀︎</font>",
        4: "4K<font color='#007fb6'>📀︎</font>",
        5: "本",
        6: "📚︎",
        7: "🖥️",
        8: "🎲",
        9: "S",
        10: "NS",
        11: "X1",
        12: "X360",
        13: "🤷",
        14: "V💿︎",
        15: "🖼️",
        16: "🚫"
    }[format] + out
}

function normalizeRating(rating: number, maxRating: number) {
    return rating / maxRating * 100
}

function fixThumbnailURL(url: string) {
    //a / url assumes that the aio server is the same as the web server
    if (url.startsWith("/")) {
        return `${AIO}${url}`
    }
    return url
}

/**
    * converts an item format to a human readable name
    * @param {number} format - the format
    * @returns {Promise<string>}
*/
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

function items_isDigitized(format: number): boolean {
    return (format & DIGI_MOD) === DIGI_MOD
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

/**
 * Like Array.reduce, but the reduction function is called per item related to itemId according to the include* parameters
 * @param {bigint} itemId - the starting item id
 * @param {boolean} includeSelf - whether or not to include the starting item
 * @param {boolean} includeChildren - whether or not to include children
 * @param {boolean} includeCopies - whether or not to include copies
 * @param {boolean} recursive - whether or not to apply this function to copies and children (if include{copies,children} are true)
 * @param {((p: T, c: bigint) => T)} reduction - the reducer function
 * @param {T} initial the starting value
 */
function items_reduce<T>(itemId: bigint, includeSelf: boolean, includeChildren: boolean, includeCopies: boolean, recursive: boolean, reduction: ((p: T, c: bigint) => T), initial: T): T {
    if (includeSelf) {
        initial = reduction(initial, itemId)
    }
    if (includeChildren) {
        for (let child of findDescendants(itemId)) {
            if (recursive) {
                initial = items_reduce(child.ItemId, includeSelf, true, includeCopies, true, reduction, initial)
            } else {
                initial = reduction(initial, child.ItemId)
            }
        }
    }
    if (includeCopies) {
        for (let copy of findCopies(itemId)) {
            if (recursive) {
                initial = items_reduce(copy.ItemId, includeSelf, includeChildren, true, true, reduction, initial)
            } else {
                initial = reduction(initial, copy.ItemId)
            }
        }
    }
    return initial
}

/**
 * Gets a list of all events related to itemid
 * @param {bigint} itemId - the item id to find the events of
 * @param {boolean} includeSelf - whether or not to include it's own events
 * @param {boolean} includeChildren - whether or not to include its children's events
 * @param {boolean} includeCopies - whether or not to include copies' events
 * @param {boolean} recursive - if includeChildren is set, apply this function to all of its children
 * @returns {UserEvent[]}
*/
function items_findAllEvents(itemId: bigint, includeSelf: boolean, includeChildren: boolean, includeCopies: boolean, recursive: boolean): UserEvent[] {
    return items_reduce(itemId, includeSelf, includeChildren, includeCopies, recursive, (p, c) => p.concat(findUserEventsById(c)), [] as UserEvent[])
}

/**
 * Calculate the total cost of an item
 * @param {bigint} itemId - the item id to find the cost of
 * @param {boolean} includeSelf - whether or not to include itself in the cost calculation
 * @param {boolean} includeChildren - whether or not to include its children in the cost calculation
 * @param {boolean} includeCopies - whether or not to include copies in the cost calculation
 * @param {boolean} recursive - if includeChildren is set, apply this function to all of its children
 * @returns {number}
*/
function items_calculateCost(itemId: bigint, includeSelf: boolean, includeChildren: boolean, includeCopies: boolean, recursive: boolean): number {
    return items_reduce(itemId, includeSelf, includeChildren, includeCopies, recursive, (p, c) => p + findInfoEntryById(c).PurchasePrice, 0)
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

/**
 * Compares 2 event's times
 * @param {UserEvent} left
 * @param {UserEvent} right
 * @returns -1 if left occured AFTER right
 * @returns 0 if they occured at the same time
 * @returns 1 if left occured BEFORE right
 */
let options: Intl.ResolvedDateTimeFormatOptions | null = null
function items_compareEventTiming(left: UserEvent | number, right: UserEvent | number): -1 | 0 | 1 {
    let l = typeof left !== 'number' ? items_eventTimeEstimate(left) : left
    let r = typeof right !== 'number' ? items_eventTimeEstimate(right) : right
    if ("Temporal" in window) {
        if (!options) {
            options = Intl.DateTimeFormat().resolvedOptions()
        }
        let leftTime = new Temporal.ZonedDateTime(BigInt(l) * 1000000n, left.TimeZone || options.timeZone)
        let rightTime = new Temporal.ZonedDateTime(BigInt(r) * 1000000n, right.TimeZone || options.timeZone)
        return Temporal.ZonedDateTime.compare(rightTime, leftTime)
    }
    if (l == r) {
        return 0
    }
    return l > r ? -1 : 1
}

function items_eventTSText(event: UserEvent) {
    let ts = event.Timestamp
    const afterts = event.After
    const beforets = event.Before
    const timeZone = event.TimeZone || "UTC"
    let text = ""
    const mktime = (timestamp: number) => {
        let date = new Date(timestamp)
        let time = date.toLocaleTimeString("en", { timeZone: event.TimeZone })
        return timeZone ? `${time} (${event.TimeZone})` : String(time)
    }
    if (afterts) {
        text += mktime(afterts) + " < "
    }

    text += ts
        ? mktime(ts)
        : " ? " //if there is no exact timestamp, put a ? in the middle of afterts and beforets

    if (beforets) {
        text += " < " + mktime(beforets)
    }

    return text
}

function items_eventTSHTML(event: UserEvent) {
    const ts = event.Timestamp
    const afterts = event.After
    const beforets = event.Before
    const timeZone = event.TimeZone || "UTC"
    let innerTD = ""

    const mktime = (timestamp: number) => {
        let date = new Date(timestamp)
        let time = date.toLocaleTimeString("en", { timeZone: event.TimeZone })
        let dd = date.toLocaleDateString("en", { timeZone: event.TimeZone })
        return `<time title="${time} (${timeZone})" datetime="${date.toISOString()}">${dd}</time>`
    }

    if (afterts) {
        innerTD += mktime(afterts) + " &lt; "
    }

    innerTD += ts
        ? mktime(ts)
        : " ? " //if there is no exact timestamp, put a ? in the middle of afterts and beforets

    if (beforets) {
        innerTD += " &lt; " + mktime(beforets)
    }

    return innerTD
}

function _cononicalizeEvent(event: UserEvent) {
    return `${event.ItemId}>>${event.Event}:${event.Before}:${event.Timestamp}:${event.After}Z${event.TimeZone}`
}

/**
    * Checks if 2 events are the same
    * @param {UserEvent} left
    * @param {UserEvent} right
    * @returns {boolean}
*/
function items_eventEQ(left: UserEvent, right: UserEvent): boolean {
    return _cononicalizeEvent(left) == _cononicalizeEvent(right)
}

function items_hasArtStyle(item: InfoEntry, artStyle: ArtStyle) {
    return (item.ArtStyle & artStyle) === artStyle
}

function items_setArtStyle(item: InfoEntry, artStyle: ASName) {
    switch (artStyle) {
        case "Anime":
            item.ArtStyle |= AS_ANIME
            break
        case "Cartoon":
            item.ArtStyle |= AS_CARTOON
            break
        case "Handrawn":
            item.ArtStyle |= AS_HANDRAWN
            break
        case "Digital":
            item.ArtStyle |= AS_DIGITAL
            break
        case "CGI":
            item.ArtStyle |= AS_CGI
            break
        case "Liveaction":
            item.ArtStyle |= AS_LIVE_ACTION
            break
        case "2D":
            item.ArtStyle |= AS_2D
            break
        case "3D":
            item.ArtStyle |= AS_3D
            break
    }
    return item
}

function items_unsetArtStyle(item: InfoEntry, artStyle: ASName) {
    switch (artStyle) {
        case "Anime":
            item.ArtStyle -= AS_ANIME
            break
        case "Cartoon":
            item.ArtStyle -= AS_CARTOON
            break
        case "Handrawn":
            item.ArtStyle -= AS_HANDRAWN
            break
        case "Digital":
            item.ArtStyle -= AS_DIGITAL
            break
        case "CGI":
            item.ArtStyle -= AS_CGI
            break
        case "Liveaction":
            item.ArtStyle -= AS_LIVE_ACTION
            break
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


function* items_getEventsWithinTimeRange(items: InfoEntry[], start: number, end: number): Generator<UserEvent> {
    for(let item of items) {
        const events = findUserEventsById(item.ItemId)
        for(let ev of events) {
            if(items_compareEventTiming(ev, start) <= 0 && items_compareEventTiming(ev, end) >= 0) {
                yield ev
            }
        }
    }
}
