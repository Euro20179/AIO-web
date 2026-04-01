/**
 * @module items
 * REQUIRES: api.ts
 * DESCRIPTION:
 * contains the global state of all entries, libraries, selected entries, etc..
 * in addition contains functions that interact with the state,
 * such as retrieving and setting entries
 * generally only updates locally
 */

//TODO:
//add a /list-relations which pulls from the relations table
//and from parentId/copyOf/requires
//and sends the results back as a list of relations
//
//there should then be a function here that loads all relations into
//the EntryRelations instance for each Entry

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

type ArtStyle =
    | typeof AS_ANIME
    | typeof AS_CARTOON
    | typeof AS_HANDRAWN
    | typeof AS_DIGITAL
    | typeof AS_CGI
    | typeof AS_LIVE_ACTION

type UserStatus =
    | ""
    | "Viewing"
    | "Finished"
    | "Dropped"
    | "Planned"
    | "ReViewing"
    | "Paused"
    | "Waiting"

type EntryType =
    | "Show"
    | "Movie"
    | "MovieShort"
    | "Game"
    | "BoardGame"
    | "Song"
    | "Book"
    | "Manga"
    | "Collection"
    | "Picture"
    | "Meme"
    | "Library"
    | "Albumn"
    | "Soundtrack"

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
    PurchasePrice: number
    Type: EntryType
    En_Title: string
    Library: bigint
    Uid: number
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
    Country: string
}


class items_Relations {
    children: bigint[]

    constructor(public id: bigint, children: bigint[] | bigint, public copies: bigint[], public requires: bigint[]) {
        //accept a parent for legacy compat
        if (typeof children === 'bigint') {
            this.children = []
        } else {
            this.children = children
        }
    }

    removeRequires(id: bigint) {
        if (this.requires.includes(id)) {
            this.requires = this.requires.filter(v => v !== id)
        }
    }

    removeChild(id: bigint) {
        if (this.children.includes(id)) {
            this.children = this.children.filter(v => v !== id)
        }
    }

    removeAllParents() {
        for (let parent of this.findParents()) {
            items_getEntry(parent).relations.removeChild(this.id)
        }
    }

    removeCopy(id: bigint) {
        const e = items_getEntry(id)

        //prevent infinite recursion
        if (this.copies.includes(id)) {
            this.copies = this.copies.filter(v => v !== id)
            items_getEntry(id).relations.removeCopy(this.id)
        }
    }

    /**
     * Sets `this` to have `id` as a parent
     * Adds `this` as a child of `id`
     */
    setParent(id: bigint) {
        items_getEntry(id).relations.children.push(this.id)
    }

    addChild(id: bigint) {
        items_getEntry(id).relations.setParent(this.id)
    }

    addRequires(id: bigint) {
        this.requires.push(id)
    }

    isChild() {
        for (let k in items_getAllEntries()) {
            if (this.isChildOf(BigInt(k))) {
                return true
            }
        }

        return false
    }

    isCopy() {
        return this.copies.length !== 0
    }

    /**
     * Checks if `this` is a child of `id`
     */
    isChildOf(id: bigint) {
        if (items_getEntry(id).relations.children.includes(this.id)) {
            return true
        }

        return false
    }

    *findCopies(): Generator<items_Entry> {
        yield* this.copies.values().map(v => items_getEntry(v))
    }

    *findRequirements(): Generator<items_Entry> {
        yield* this.requires.values().map(v => items_getEntry(v))
    }

    *findDescendants(): Generator<items_Entry> {
        yield*
            Object.values(items_getAllEntries())
                .values()
                .filter(v => v.relations.isChildOf(this.id))
    }

    *findParents() {
        const entries = items_getAllEntries()
        for (let id in entries) {
            const entry = entries[id]

            for (let child of entry.relations.children) {
                if (child === this.id) {
                    yield child
                }
            }
        }
    }
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
    relations: items_Relations

    events: UserEvent[]

    constructor(info: InfoEntry | bigint, user?: UserEntry, meta?: MetadataEntry, events?: UserEvent[]) {
        this.info = typeof info === 'bigint' ? genericInfo(info, 0) : info
        this.user = user || genericUserEntry(typeof info === 'bigint' ? info : info.ItemId, this.info.Uid)
        this.meta = meta || genericMetadata(typeof info === 'bigint' ? info : info.ItemId, this.info.Uid)
        this.events = events || []

        //items_refreshRelations() must be called to fill all relations
        this.relations = new items_Relations(this.info.ItemId, [], [], [])
    }

    get fixedThumbnail() {
        return fixThumbnailURL(this.meta.Thumbnail)
    }

    get ItemId() {
        return this.info.ItemId
    }
}

/**
 * normalizes a metadata rating, returns 0 if there is no rating
 */
function items_getNormalizedRating(meta: MetadataEntry): number {
    return (meta.Rating / meta.RatingMax * 100) || 0
}

/**
 * Sets the current library
 * @param {bigint} id The id of the library to set to (can be 0 for no library)
 */
function items_setCurrentLibrary(id: bigint) {
    _globalsNewUi.viewingLibrary = id
}

/**
 * Gets the current library
 * @returns {bigint} the id of the library
 */
function items_getCurrentLibrary(): bigint {
    return _globalsNewUi.viewingLibrary
}

/**
 * Gets a dictionary of all library ids
 * @returns {Record<string, InfoEntry>} id: library
 */
function items_getLibraries(): Record<string, InfoEntry> {
    return _globalsNewUi.libraries
}

/**
 * Adds a library to the list of libraries
 * @param {InfoEntry} info The library to add
 */
function items_setLibrary(info: InfoEntry) {
    _globalsNewUi.libraries[String(info.ItemId)] = info
}

/**
 * Removes a library from the list of libraries
 * @param {string} id The id of the library to remove
 */
function items_deleteLibrary(id: string) {
    delete _globalsNewUi.libraries[id]
}

/**
 * Add a requirement to an item
 * @param {bigint} item The item to add a requirement to
 * @param {bigint} requires The id of the item that is the requirement
 */
function items_addRequires(item: bigint, requires: bigint) {
    items_getEntry(item).relations.addRequires(requires)
}

/**
 * Add a child to an item
 * @param {bigint} child The id of the child
 * @param {bigint} parent The id of the parent
 */
function items_addChild(child: bigint, parent: bigint) {
    items_getEntry(parent).relations.addChild(child)
}

/**
 * Sets 2 items to be copies of each other
 * @param {bigint} copy id of item 1
 * @param {bigint} copyof id of item 2
 */
function items_addCopy(copy: bigint, copyof: bigint) {
    items_getEntry(copy).relations.copies.push(copyof)
    items_getEntry(copyof).relations.copies.push(copy)
}

/**
 * Removes a requirement from an item
 * @param {bigint} item The item to remove the requirement from
 * @param {bigint} requires The id of the requirement to remove.
 */
function items_removeRequires(item: bigint, requires: bigint) {
    items_getEntry(item).relations.removeRequires(requires)
}

/**
 * Remove a child from an item
 * @param {bigint} child The child to remove from the parent
 * @param {bigint} parent The parent to remove the child from
 */
function items_removeChild(child: bigint, parent: bigint) {
    items_getEntry(parent).relations.removeChild(child)
}

/**
 * Make 2 items no longer copies of each other
 * @param {bigint} copy item 1
 * @param {bigint} copyof item 2
 */
function items_removeCopy(copy: bigint, copyof: bigint) {
    //relations.removeCopy removes both sides of the copy
    items_getEntry(copy).relations.removeCopy(copyof)
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

/**
 * Get the search results list
 * @returns {items_Entry[]}
 */
function items_getResults(): items_Entry[] {
    return _globalsNewUi.results
}

/**
 * Get the list of selected items
 * @returns {InfoEntry[]}
 */
function items_getSelected(): InfoEntry[] {
    return _globalsNewUi.selectedEntries
}

/**
 * Clears the selected items
 * (You probably want mode_clearItems() instead, as this function only clears the state, not the visual)
 */
function items_clearSelected() {
    _globalsNewUi.selectedEntries = []
}

/**
 * Select an item by id
 * (You probably want mode_selectItem() insted)
 * @param {bigint} id The id to select
 */
function items_selectById(id: bigint): void {
    _globalsNewUi.selectedEntries.push(_globalsNewUi.entries[String(id)].info)
}

/**
 * Sets the list of selected items
 * (you probably want mode_selectItemList() instead)
 * @param {InfoEntry[]} items The list of items to select
 */
function items_setSelected(items: InfoEntry[]) {
    _globalsNewUi.selectedEntries = items
}

/**
 * Deselects an item by id
 * (You probably want mode_deselectItem() instead)
 * @param {bigint} id The id to deselect
 */
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

/**
 * Updates an entry by id in the global entries map
 * Keep in mind this is client side only, and only updates state not visually
 * @see updateInfo2()
 * @see api_setItem()
 * @param {string} id The id to update
 * @param {{user: UserEntry, events: UserEvent[], meta: MetadataEntry, info: InfoEntry}} with Update the id with this information
 */
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

/**
 * Delete an entry from the global entries map
 * @see aio_delete()
 * @param {bigint} item The id of the item to delete
 */
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

function items_getEntry(id: bigint) {
    const val = _globalsNewUi.entries[String(id)]
    if (!(val)) {
        console.error(`${id} is not an entry or is not loaded`)
        const info = genericInfo(id, 0)
        info.En_Title = `UNKNOWN <id:${id}>`
        return _globalsNewUi.entries[String(id)] = new items_Entry(info)
    }
    return val
}

/**
    * Gets an entry based on an item id
    * if the entry is not loaded, load it
    * ignores current user
*/
async function items_getEntryAny(id: bigint) {
    let val = _globalsNewUi.entries[String(id)]
    if (!(val)) {
        const stuff = await api_getEntryAll(id, 0)
        if (!stuff) {
            throw new Error(`${id} is not an entry`)
        }
        val = _globalsNewUi.entries[String(id)] = new items_Entry(
            stuff.info, stuff.user, stuff.meta, stuff.events
        )
    }
    return val
}

/**
 * Gets the global entries map
 * @returns {Record<string, items_Entry>}
 */
function items_getAllEntries(): Record<string, items_Entry> {
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

/**
 * Create a generic InfoEntry
 * @param {bigint} itemId The item id of this entry
 * @param {number} uid The user id of this entry
 * @returns {InfoEntry}
 */
function genericInfo(itemId: bigint, uid: number): InfoEntry {
    return {
        Uid: uid,
        ItemId: itemId,
        Collection: "",
        Format: 0,
        ArtStyle: 0,
        Location: "",
        Native_Title: "",
        PurchasePrice: 0,
        Type: "Show",
        En_Title: "",
        Library: 0n,
        RecommendedBy: "[]",

        Tags: []
    }
}


/**
 * Create a generic MetadataEntry
 * @param {bigint} itemId The item id of this entry
 * @param {number} uid The user id of this entry
 * @returns {MetadataEntry}
 */
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
        Country: "",
    }
}

/**
 * Create a generic UserEntry
 * @param {bigint} itemId The item id of this entry
 * @param {number} uid The user id of this entry
 * @returns {UserEntry}
 */
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
 * Loads all relations from the api and updates all item's relations
 * in the global entries map accordingly
 * @see api_getRelations()
 * @param {number} uid The uid to refresh relations of
 */
async function items_refreshRelations(uid: number) {
    const relations = await api_getRelations(uid)
    for (let id in relations) {
        //FIXME: this only throws an error because
        //api_getRelations does not respect uid
        //because the /list-relations endpoint does not respect uid
        try {
            const e = items_getEntry(BigInt(id))
            e.relations.children = relations[id].Children?.map((v: any) => BigInt(v)) || []
            e.relations.requires = relations[id].Requires?.map((v: any) => BigInt(v)) || []
            e.relations.copies = relations[id].Copies?.map((v: any) => BigInt(v)) || []
        } catch (err) {
            continue
        }
    }
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

/**
 * Finds the descendants of an item
 * @param {bigint} itemId The item to find the descendants of
 * @returns {Generator<items_Entry>}
 */
function* findDescendants(itemId: bigint): Generator<items_Entry> {
    const entry = items_getEntry(itemId)
    yield* entry.relations.findDescendants()
}

/**
 * Finds the copies of an item
 * @param {bigint} itemId The item to find the copies of
 * @returns {Generator<items_Entry>}
 */
function* findCopies(itemId: bigint): Generator<items_Entry> {
    const entry = items_getEntry(itemId)
    yield* entry.relations.findCopies()
}

/**
 * Finds the requirements of an item
 * @param {bigint} itemId The item to find the requirements of
 * @returns {Generator<items_Entry>}
 */
function* findRequirements(itemId: bigint): Generator<items_Entry> {
    yield* items_getEntry(itemId).relations.findRequirements()
}

/**
 * Gets a list of recommenders for an item
 * @param {bigint} itemId The item to get the recommenders of
 * @returns {string[]}
 */
function items_getRecommendedBy(itemId: bigint): string[] {
    let entry = items_getEntry(itemId)
    return JSON.parse(entry.info.RecommendedBy)
}

/**
 * Adds a recommender to an item's list of recommenders in the global entries map
 * @see newRecommendedByUI()
 * @param {bigint} itemId The item to add the recommender to
 * @param {string} recommender The recommender
 */
function items_addRecommendedBy(itemId: bigint, recommender: string) {
    let entry = items_getEntry(itemId)
    let r = JSON.parse(entry.info.RecommendedBy)
    r.push(recommender)
    entry.info.RecommendedBy = JSON.stringify(r)
}

/**
 * Loads all events for a user, and updates the global map accordingly
 * @param {number} uid The user to load the events for
 */
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

/**
 * Sorts a list of events by timestamp (does not account for BeforeTs)
 * @param {UserEvent[]} events The list of events to sort
 * @returns {UserEvent[]}
 */
function sortEvents(events: UserEvent[]): UserEvent[] {
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

for(let event of ["Added", "Finished", "Viewing"]) {
    sorts.set(event.toLowerCase(), (a, b) => {
        let ae = findUserEventsById(a.ItemId).findLast(v => v.Event === event)
        let be = findUserEventsById(b.ItemId).findLast(v => v.Event === event)
        return items_compareEventTiming(ae || 0, be || 0)
    })
}

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
        return conversion[type as keyof typeof conversion]
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
        16: "🚫",
        17: "🎞",
    }[format] + out
}

function normalizeRating(rating: number, maxRating: number) {
    return rating / maxRating * 100
}

/**
 * If the url is a relative path, make it an absolute path using this server
 * @param {string} url The url to fix
 * @returns {string}
 */
function fixThumbnailURL(url: string): string {
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

/**
 * Checks if an item is marked as digitized
 * @param {number} format The format of the item
 * @returns {boolean}
 */
function items_isDigitized(format: number): boolean {
    return (format & DIGI_MOD) === DIGI_MOD
}

/**
 * Converts a format name to a number format
 * @param {string} name The name to convert
 * @returns {PRomise<number>}
 */
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
function items_reduce<T>(itemId: bigint, includeSelf: boolean, includeChildren: boolean, includeCopies: boolean, includeRequires: boolean, recursive: boolean, reduction: ((p: T, c: bigint) => T), initial: T): T {
    if (includeSelf) {
        initial = reduction(initial, itemId)
    }
    if (includeChildren) {
        for (let child of findDescendants(itemId)) {
            if (recursive) {
                initial = items_reduce(child.ItemId, includeSelf, true, includeCopies, includeRequires, true, reduction, initial)
            } else {
                initial = reduction(initial, child.ItemId)
            }
        }
    }
    if (includeCopies) {
        for (let copy of findCopies(itemId)) {
            if (recursive) {
                initial = items_reduce(copy.ItemId, includeSelf, includeChildren, true, includeRequires, true, reduction, initial)
            } else {
                initial = reduction(initial, copy.ItemId)
            }
        }
    }
    if (includeRequires) {
        for (let requirement of findRequirements(itemId)) {
            if (recursive) {
                initial = items_reduce(requirement.ItemId, includeSelf, includeChildren, includeCopies, true, true, reduction, initial)
            } else {
                initial = reduction(initial, requirement.ItemId)
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
 * @param {boolean} includeRequires - whether or not to include requires' events
 * @param {boolean} recursive - if includeChildren is set, apply this function to all of its children
 * @returns {UserEvent[]}
*/
function items_findAllEvents(itemId: bigint, includeSelf: boolean, includeChildren: boolean, includeCopies: boolean, includeRequires: boolean, recursive: boolean): UserEvent[] {
    return items_reduce(itemId, includeSelf, includeChildren, includeCopies, includeRequires, recursive, (p, c) => p.concat(findUserEventsById(c)), [] as UserEvent[])
}

/**
 * Calculate the total cost of an item
 * @param {bigint} itemId - the item id to find the cost of
 * @param {boolean} includeSelf - whether or not to include itself in the cost calculation
 * @param {boolean} includeChildren - whether or not to include its children in the cost calculation
 * @param {boolean} includeCopies - whether or not to include copies in the cost calculation
 * @param {boolean} includeRequires - whether or not to include requires in the cost calculation
 * @param {boolean} recursive - if includeChildren is set, apply this function to all of its children
 * @returns {number}
*/
function items_calculateCost(itemId: bigint, includeSelf: boolean, includeChildren: boolean, includeCopies: boolean, includeRequires: boolean, recursive: boolean): number {
    return items_reduce(itemId, includeSelf, includeChildren, includeCopies, includeRequires, recursive, (p, c) => p + findInfoEntryById(c).PurchasePrice, 0)
}

/**
 * Estimates a time for an event (not all events have the Timestamp field set)
 * @param {UserEvent} event The event to estimate the time of occurance
 * @returns {number}
 */
function items_eventTimeEstimate(event: UserEvent): number {
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
 * @returns n < 0 if left occured AFTER right
 * @returns 0 if they occured at the same time
 * @returns n > 0 if left occured BEFORE right
 */
function items_compareEventTiming(left: UserEvent | number, right: UserEvent | number): number{
    let l = typeof left !== 'number' ? items_eventTimeEstimate(left) : left
    let r = typeof right !== 'number' ? items_eventTimeEstimate(right) : right
    if ("Temporal" in window) {
        let leftTime = new Temporal.ZonedDateTime(BigInt(l) * 1000000n, (left as UserEvent).TimeZone || INTL_OPTIONS.timeZone)
        let rightTime = new Temporal.ZonedDateTime(BigInt(r) * 1000000n, (right as UserEvent).TimeZone || INTL_OPTIONS.timeZone)
        return Temporal.ZonedDateTime.compare(rightTime, leftTime)
    }
    if (l == r) {
        return 0
    }
    return r - l
}

/**
 * Converts an event into a string representing the event
 * @param {UserEvent} event The event
 * @returns {string}
 */
function items_eventTSText(event: UserEvent): string {
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

/**
 * Converts an event to an HTML string that represents it
 * @param {UserEvent} event The event
 * @returns {string}
 */
function items_eventTSHTML(event: UserEvent): string {
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

/**
 * Checks if an item has a specific art style
 * @param {InfoEntry} item The item to check
 * @param {ArtStyle} artStyle The art style
 */
function items_hasArtStyle(item: InfoEntry, artStyle: ArtStyle) {
    return (item.ArtStyle & artStyle) === artStyle
}

/**
 * Adds an art style by name to an item
 * @param {InfoEntry} item The item to add an art style to
 * @param {ASName} artStyle The art style to add
 * @returns {InfoEntry}
 */
function items_setArtStyle(item: InfoEntry, artStyle: ASName): InfoEntry {
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

/**
 * Removes an art style by name to an item
 * @param {InfoEntry} item The item to remove an art style from
 * @param {ASName} artStyle The art style to remove
 */
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


/**
 * Gets a list of events for items that happened within a time range
 * @param {InfoEntry[]} items The items to pull events from
 * @param {number} start The starting unix time stamp
 * @param {number} end the Ending unix time stamp
 * @returns {Generator<UserEvent>}
 */
function* items_getEventsWithinTimeRange(items: InfoEntry[], start: number, end: number): Generator<UserEvent> {
    for (let item of items) {
        const events = findUserEventsById(item.ItemId)
        for (let ev of events) {
            if (items_compareEventTiming(ev, start) <= 0 && items_compareEventTiming(ev, end) >= 0) {
                yield ev
            }
        }
    }
}

/**
* @description Grabs the sequence number from a string, given a list of all items in the sequence
* @returns {number | null}
*/
function items_sequenceNumberGrabber(text: string, allItems: string[]): number | null {
    //match sequence indicator (non-word character, vol/ova/e/s)
    //followed by sequence number (possibly a float)
    //followed by non-word character
    //eg: S01
    //eg: E6.5
    const regex = /(?:[\W_\-\. EesS]|[Oo][Vv][Aa]|[Vv](?:[Oo][Ll])?\.?)?(\d+(?:\.\d+)?)[\W_\-\. ]?/g

    const matches = text.matchAll(regex).toArray()
    if (matches[0] == null) {
        return null
    }
    return Number(matches.filter(match => {
        for (let item of allItems) {
            if (item === text) continue

            if (item.includes(match[0]))
                return false
            return true
        }
    })[0][1])
}
