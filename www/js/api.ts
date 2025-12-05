let formats: { [key: number]: string } = {}
let _api_as_cache: { [key: number]: string } = {}

let _api_types_cache: EntryType[] = []

function setUserAuth(auth: string, into: { setItem(key: string, value: any): any } = localStorage) {
    into.setItem.bind(into)("userAuth", auth)
}

function getUserAuth(from: { getItem(key: string): string | null } = localStorage) {
    return from.getItem.bind(from)("userAuth")
}

function storeUserUID(id: string) {
    localStorage.setItem("userUID", id)
}

function getUserUID() {
    return localStorage.getItem("userUID")
}

function probablyUserItem(item: object): item is UserEntry {
    for (let key of [
        "ItemId",
        "Status",
        "ViewCount",
        "UserRating",
        "Notes",
        "CurrentPosition",
        "Extra"
    ]) {
        if (!(key in item)) {
            return false
        }
    }
    return true
}

function probablyInfoEntry(item: object): item is InfoEntry {
    for (let key of [
        "ItemId",
        "Collection",
        "Format",
        "ArtStyle",
        "Location",
        "Native_Title",
        "PurchasePrice",
        "Type",
        "En_Title",
        "Library",
    ]) {
        if (!(key in item)) {
            return false
        }
    }
    return true
}

function probablyMetaEntry(item: object): item is MetadataEntry {
    for (let key of [
        "ItemId",
        "Rating",
        "RatingMax",
        "Description",
        "ReleaseYear",
        "Thumbnail",
        "MediaDependant",
        "Datapoints",
        "Title",
        "Native_Title",
        "Provider",
        "ProviderID",
    ]) {
        if (!(key in item)) {
            return false
        }
    }
    return true
}

type IdentifyResult = {
    Description: string
    Thumbnail: string
}

type Status = string

function quoteEscape(text: string, stringQuoteType: '"' | "'") {
    let newText = ""
    let escaped = false
    for (let ch of text) {
        if (ch === "\\") {
            escaped = true
        }
        else if (!escaped && ch === stringQuoteType) {
            newText += `\\`
        } else {
            escaped = false
        }
        newText += ch
    }
    return newText
}

function _api_mkStrItemId(jsonl: string) {
    return jsonl
        .replace(/"ItemId":\s*(\d+),/, "\"ItemId\": \"$1\",")
        .replace(/"ParentId":\s*(\d+),/, "\"ParentId\": \"$1\",")
        .replace(/"CopyOf":\s*(\d+)(,)?/, "\"CopyOf\": \"$1\"$2")
        .replace(/"Library":\s*(\d+)(,)?/, "\"Library\": \"$1\"$2")
        .replace(/"Requires":\s*(\d+)(,)?/, "\"Requires\": \"$1\"$2")
}

function _api_mkIntItemId(jsonl: string) {
    return jsonl
        .replace(/"ItemId":"(\d+)",/, "\"ItemId\": $1,")
        .replace(/"ParentId":"(\d+)",/, "\"ParentId\": $1,")
        .replace(/"CopyOf":"(\d+)"(,)?/, "\"CopyOf\": $1$2")
        .replace(/"Library":"(\d+)"(,)?/, "\"Library\": $1$2")
        .replace(/"Requires":"(\d+)"(,)?/, "\"Requires\": $1$2")
}

function _api_parseJsonL(jsonl: string) {
    const bigIntProperties = ["ItemId", "ParentId", "CopyOf", "Library", "Requires"]
    try {
        return JSON.parse(jsonl, (key, v) => {
            return bigIntProperties.includes(key) ? BigInt(v) : v
        })
    }
    catch (err) {
        console.error("Could not parse json", err)
    }
}

function* api_deserializeJsonl<T>(jsonl: string | string[]): Generator<T> {
    if (typeof jsonl === 'string') {
        jsonl = jsonl.split("\n")
    }
    for (let line of jsonl) {
        yield _api_parseJsonL(_api_mkStrItemId(line))
    }
}

function api_serializeEntry(entry: UserEntry | InfoEntry | MetadataEntry | UserEvent) {
    return _api_mkIntItemId(
        JSON.stringify(
            entry, (_, v) => typeof v === "bigint" ? String(v) : v
        )
    )
}

function canBegin(status: Status) {
    return status === "Finished" || status === "Dropped" || status === "Planned" || status === ""
}

function canPause(status: Status) {
    return status === "Viewing" || status === "ReViewing"
}

function canResume(status: Status) {
    return status === "Paused" || status == "Waiting"
}

function canWait(status: Status) {
    return status == "Viewing" || status == "ReViewing"
}

function api_formatsCache() {
    return formats
}

async function api_listArtStyles() {
    if (Object.keys(_api_as_cache).length > 0) return _api_as_cache

    const res = await fetch(`${apiPath}/type/artstyle`)
    if (res.status !== 200) return _api_as_cache

    const json = await res.json()
    return _api_as_cache = json
}

async function api_listFormats() {
    if (Object.keys(formats).length > 0) return formats

    const res = await fetch(`${apiPath}/type/format`)

    if (res.status !== 200) {
        return formats
    }

    const json = await res.json()
    formats = json
    return formats
}

async function api_listTypes() {
    if (_api_types_cache.length) return _api_types_cache

    const res = await fetch(`${apiPath}/type/type`)
    _api_types_cache = await res.json()
    return _api_types_cache
}

async function api_getRelations(uid: number) {
    const res = await fetch(`${apiPath}/list-relations?uid=${uid}`)

    if(!res) {
        return {}
    }
    const text = await res.text()
    return JSON.parse(text.replace(/(?<!")(\d+)(?=,|\])(?!")/g, '"$1"'))
}

async function api_loadList<T>(endpoint: string, uid: number): Promise<T[]> {
    const res = await fetch(`${apiPath}/${endpoint}?uid=${uid}`)
    if (!res) {
        return []
    }

    const text = await res.text()
    if (!text) {
        return []
    }

    const lines = text.split("\n").filter(Boolean)
    return [...api_deserializeJsonl<T>(lines)]
}

async function api_copyUserInfo(oldid: bigint, newid: bigint) {
    return await authorizedRequest(`${apiPath}/engagement/copy?src-id=${oldid}&dest-id=${newid}`, {
        ["signin-reason"]: "copy user info"
    }).catch(console.error)
}


async function api_identify(title: string, provider: string) {
    return await authorizedRequest(`${apiPath}/metadata/identify?title=${encodeURIComponent(title)}&provider=${provider}`)
}

async function api_finalizeIdentify(identifiedId: string, provider: string, applyTo?: bigint) {
    identifiedId = encodeURIComponent(identifiedId)
    provider = encodeURIComponent(provider)
    if (applyTo)
        return await authorizedRequest(`${apiPath}/metadata/finalize-identify?identified-id=${identifiedId}&provider=${provider}&apply-to=${applyTo}`)
    else
        return await authorizedRequest(`${apiPath}/metadata/finalize-identify?identified-id=${identifiedId}&provider=${provider}`)
}

async function api_setThumbnail(id: bigint, thumbnail: string) {
    return await authorizedRequest(`${apiPath}/metadata/set-thumbnail?id=${id}`, {
        method: "POST",
        body: thumbnail,
        "signin-reason": "update thumbnail"
    })
}

/**
 * Sets the parent of id to parent
 * @param {bigint} id
 * @param {bigint} parent
 */
async function api_setParent(id: bigint, parent: bigint) {
    return await authorizedRequest(`${apiPath}/mod-entry?id=${id}&parent-id=${parent}`)
}

async function api_addChild(uid: number, child: bigint, parent: bigint) {
    return await authorizedRequest(`${apiPath}/add-child?uid=${uid}&child=${child}&parent=${parent}`)
}

async function api_addCopy(uid: number, copy: bigint, copyof: bigint) {
    return await authorizedRequest(`${apiPath}/add-copy?uid=${uid}&copy=${copy}&copyof=${copyof}`)
}

async function api_addRequires(uid: number, itemid: bigint, requires: bigint) {
    return await authorizedRequest(`${apiPath}/add-requires?uid=${uid}&itemid=${itemid}&requires=${requires}`)
}

async function api_delChild(uid: number, child: bigint, parent: bigint) {
    return await authorizedRequest(`${apiPath}/del-child?uid=${uid}&child=${child}&parent=${parent}`)
}

async function api_delCopy(uid: number, copy: bigint, copyof: bigint) {
    return await authorizedRequest(`${apiPath}/del-copy?uid=${uid}&copy=${copy}&copyof=${copyof}`)
}

async function api_delRequires(uid: number, itemid: bigint, requires: bigint) {
    return await authorizedRequest(`${apiPath}/del-requires?uid=${uid}&itemid=${itemid}&requires=${requires}`)
}

async function api_queryV4(searchString: string, uid: number): Promise<InfoEntry[]> {
    let qs = `?search=${encodeURIComponent(searchString)}&uid=${uid}`

    const res = await fetch(`${apiPath}/query-v4${qs}`).catch(console.error)
    if (!res) return []

    let itemsText = await res.text()
    if (res.status !== 200) {
        alert(itemsText)
        return []
    }

    try {
        return [...api_deserializeJsonl<InfoEntry>(itemsText.split("\n").filter(Boolean))]
    } catch (err) {
        console.error(err)
    }

    return []
}

/**
 * Performs a search
 * @param {string} searchString - the search query
 * @param {number} uid - can be 0 to allow results from all users
 * @param {string} [orderby=""]
*/
async function api_queryV3(searchString: string, uid: number, orderby: string = ""): Promise<InfoEntry[]> {
    switch (orderby) {
        case "user-title":
            orderby = "En_Title"
            break
        case "native-title":
            orderby = "entryInfo.Native_Title"
            break
        case "rating":
            orderby = "UserRating"
            break
        case "general-rating":
            orderby = "(CAST(Rating as REAL) / CAST(RatingMax AS REAL))"
            break
        case "release-year":
            orderby = "ReleaseYear"
            break
        case "cost":
            orderby = "PurchasePrice"
            break
        case "added":
            orderby = "(SELECT timestamp FROM userEventInfo WHERE event = 'Added' AND ItemId = userViewingInfo.ItemId ORDER BY timestamp LIMIT 1)"
            break
        case "viewing":
            orderby = "(SELECT timestamp FROM userEventInfo WHERE event = 'Viewing' AND ItemId = userViewingInfo.ItemId ORDER BY timestamp DESC LIMIT 1)"
            break
        case "finished":
            orderby = "(SELECT timestamp FROM userEventInfo WHERE event = 'Finished' AND ItemId = userViewingInfo.ItemId ORDER BY timestamp DESC LIMIT 1)"
            break
        case "item-id":
            orderby = "entryInfo.itemId"
            break
        //in case the order by doesnt exist on the server
        default:
            orderby = ""
    }

    let qs = `?search=${encodeURIComponent(searchString)}&uid=${uid}`
    if (orderby != "") {
        qs += `&order-by=${encodeURIComponent(orderby)}`
    }

    const res = await fetch(`${apiPath}/query-v3${qs}`).catch(console.error)
    if (!res) return []

    let itemsText = await res.text()
    if (res.status !== 200) {
        alert(itemsText)
        return []
    }

    try {
        return [...api_deserializeJsonl<InfoEntry>(itemsText.split("\n").filter(Boolean))]
    } catch (err) {
        console.error(err)
    }

    return []
}

async function api_setPos(id: bigint, pos: string) {
    return authorizedRequest(`${apiPath}/engagement/mod-entry?id=${id}&current-position=${pos}`)
}

type NewEntryParams = {
    timezone: string,
    title: string,
    type: EntryType,
    format: number,
    price?: number,
    requires?: bigint,
    "is-digital"?: boolean,
    "is-anime"?: boolean,
    "art-style"?: number,
    "libraryId"?: bigint,
    "copyOf"?: bigint,
    "parentId"?: bigint,
    "native-title": string,
    "tags"?: string,
    "location"?: string,
    "get-metadata"?: boolean,
    "metadata-provider"?: string,
    "user-rating"?: number,
    "user-status"?: UserStatus,
    "user-view-count"?: number,
    "user-notes"?: string
}

async function api_createEntry(params: NewEntryParams) {
    let qs = "?"
    let i = 0
    for (let p in params) {
        let v = params[p as keyof NewEntryParams]
        if (typeof v === 'bigint') {
            v = String(v)
        } else if (typeof v !== 'undefined') {
            v = encodeURIComponent(v)
        } else {
            continue
        }

        if (i !== 0) qs += `&`

        qs += `${p}=${v}`
        i++
    }
    return await authorizedRequest(`${apiPath}/add-entry${qs}`)
}

async function authorizedRequest(url: string | URL, options?: RequestInit & { ["signin-reason"]?: string }): Promise<Response | null> {
    let userAuth = getUserAuth() || ""
    options ||= {}
    options.headers ||= {}
    if (userAuth == "") {
        try {
            userAuth = await signinUI(options?.["signin-reason"] || "")
        } catch (err) {
            console.warn("signinUI is undefined, falling back to shitty solution")
            const username = prompt("username")
            const password = prompt("password")
            setUserAuth(userAuth = btoa(`${username}:${password}`))
        }
    }
    //@ts-ignore
    options.headers["Authorization"] = `Basic ${userAuth}`
    let res = await fetch(url, options)
    if (res.status === 401) {
        localStorage.removeItem("userAuth")
        return await authorizedRequest(url, options)
    }
    return res
}

async function api_deleteEvent(itemId: bigint, ts: number, after: number, before: number) {
    return await authorizedRequest(`${apiPath}/engagement/delete-event?id=${itemId}&after=${after}&timestamp=${ts}&before=${before}`)
}

async function api_deleteEventV2(eventId: number, uid: number) {
    return await authorizedRequest(`${apiPath}/engagement/delete-event-v2?id=${eventId}&uid=${uid}`)
}

async function api_registerEvent(itemId: bigint, name: string, ts: number, after: number, tz?: string, before: number = 0) {
    tz ||= Intl.DateTimeFormat().resolvedOptions().timeZone
    return await authorizedRequest(`${apiPath}/engagement/register-event?name=${encodeURIComponent(name)}&id=${itemId}&after=${after}&timestamp=${ts}&timezone=${encodeURIComponent(tz)}&before=${before}`)
}

async function api_addEntryTags(itemId: bigint, tags: string[]) {
    return await authorizedRequest(`${apiPath}/add-tags?tags=${encodeURIComponent(tags.join("\x1F"))}&id=${itemId}`)
}

async function api_deleteEntryTags(itemId: bigint, tags: string[]) {
    return await authorizedRequest(`${apiPath}/delete-tags?tags=${encodeURIComponent(tags.join("\x1F"))}&id=${itemId}`)
}

async function api_deleteEntry(itemId: bigint) {
    return await authorizedRequest(`${apiPath}/delete-entry?id=${itemId}`, {
        "signin-reason": "delete this entry"
    })
}

async function api_overwriteMetadataEntry(itemId: bigint) {
    return authorizedRequest(`${apiPath}/metadata/fetch?id=${itemId}`, {
        "signin-reason": "automatically update metadata"
    })
}

async function api_updateInfoTitle(itemId: bigint, newTitle: string) {
    return authorizedRequest(`${apiPath}/mod-entry?id=${itemId}&en-title=${newTitle}`)
}

async function api_getEntryMetadata(itemId: bigint, uid: number) {
    let res = await fetch(`${apiPath}/metadata/retrieve?id=${itemId}&uid=${uid}`)
    if (res.status !== 200) {
        return null
    }
    return api_deserializeJsonl(await res.text()).next().value as MetadataEntry
}

async function api_getEntryAll(itemId: bigint, uid: number) {
    let res = await fetch(`${apiPath}/get-all-for-entry?id=${itemId}&uid=${uid}`)
    if (res.status !== 200) {
        return null
    }
    const text = await res.text()
    const [user, meta, info, ...events] = text.split("\n").filter(Boolean)
    return {
        user: api_deserializeJsonl<UserEntry>(user).next().value,
        meta: api_deserializeJsonl<MetadataEntry>(meta).next().value,
        info: api_deserializeJsonl<InfoEntry>(info).next().value,
        events: [...api_deserializeJsonl<UserEvent>(events)].filter(Boolean),
    }
}

async function api_fetchLocation(itemId: bigint, uid: number, provider?: string, providerId?: string) {
    let qs = `?uid=${uid}&id=${itemId}`
    if (provider) {
        qs += `&provider=${provider}`
    }
    if (providerId) {
        qs += `&provider-id=${providerId}`
    }
    return authorizedRequest(`${apiPath}/metadata/fetch-location${qs}`, {
        "signin-reason": "set location"
    })
}

async function api_setItem(subpath: "engagement/" | "metadata/" | "", item: InfoEntry | MetadataEntry | UserEntry, signinReason?: string) {
    const serialized = api_serializeEntry(item)
    return authorizedRequest(`${apiPath}/${subpath}set-entry`, {
        body: serialized,
        method: "POST",
        "signin-reason": signinReason
    })
}

async function api_username2UID(username: string): Promise<number> {
    let res = await fetch(`${AIO}/account/username2id?username=${encodeURIComponent(username)}`)
    const n = await res.text()
    return Number(n.trim())
}

async function api_setRating(itemId: bigint, rating: string) {
    return await authorizedRequest(`${apiPath}/engagement/mod-entry?id=${itemId}&rating=${rating}`)
}

async function api_listAccounts() {
    const res = await fetch(`${AIO}/account/list`)
    const users = (await res.text()).split("\n").filter(Boolean)
    return users
}


async function api_authorized(auth: string): Promise<false | number> {
    let res = await fetch(`${AIO}/account/authorized`, {
        headers: {
            Authorization: `Basic ${auth}`
        }
    })
    if (res.status === 401) {
        return false
    }

    let text = await res.text()
    return Number(text)
}

async function api_list_recommenders(uid: number): Promise<string[]> {
    let res = await fetch(`${apiPath}/recommenders?uid=${encodeURIComponent(uid)}`)
    if (res.status !== 200) {
        res.text().then(console.error)
        return []
    }

    let r = await res.text()
    return r.split("\x1F")
}
