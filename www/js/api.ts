type UserEntry = {
    ItemId: bigint
    Status: UserStatus
    ViewCount: number
    UserRating: number
    Notes: string
    CurrentPosition: string
    Extra: string
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

type IdentifyResult = {
    Description: string
    Thumbnail: string
}

type Status = string

let formats: { [key: number]: string } = {}

let _api_types_cache: EntryType[] = []

function _api_mkStrItemId(jsonl: string) {
    return jsonl
        .replace(/"ItemId":\s*(\d+),/, "\"ItemId\": \"$1\",")
        .replace(/"ParentId":\s*(\d+),/, "\"ParentId\": \"$1\",")
        .replace(/"CopyOf":\s*(\d+)(,)?/, "\"CopyOf\": \"$1\"$2")
        .replace(/"Library":\s*(\d+)(,)?/, "\"Library\": \"$1\"$2")
}

function _api_mkIntItemId(jsonl: string) {
    return jsonl
        .replace(/"ItemId":"(\d+)",/, "\"ItemId\": $1,")
        .replace(/"ParentId":"(\d+)",/, "\"ParentId\": $1,")
        .replace(/"CopyOf":"(\d+)"(,)?/, "\"CopyOf\": $1$2")
        .replace(/"Library":"(\d+)"(,)?/, "\"Library\": $1$2")
}

function _api_parseJsonL(jsonl: string) {
    const bigIntProperties = ["ItemId", "ParentId", "CopyOf", "Library"]
    try {
        return JSON.parse(jsonl, (key, v) => {
            return bigIntProperties.includes(key) ? BigInt(v) : v
        })
    }
    catch (err) {
        console.error("Could not parse json", err)
    }
}

function* api_deserializeJsonl(jsonl: string | string[]) {
    if(typeof jsonl === 'string') {
        jsonl = jsonl.split("\n")
    }
    for(let line of jsonl) {
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
    if(_api_types_cache.length) return _api_types_cache

    const res = await fetch(`${apiPath}/type/type`)
    _api_types_cache = await res.json()
    return _api_types_cache
}

async function api_loadList<T>(endpoint: string): Promise<T[]> {
    const res = await fetch(`${apiPath}/${endpoint}?uid=${uid}`)
    if (!res) {
        return []
    }

    const text = await res.text()
    if (!text) {
        return []
    }

    const lines = text.split("\n").filter(Boolean)
    return [...api_deserializeJsonl(lines)]
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
    if(applyTo)
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

async function api_setParent(id: bigint, parent: bigint) {
    return await authorizedRequest(`${apiPath}/mod-entry?id=${id}&parent-id=${parent}`)
}

async function api_queryV3(searchString: string) {
    const res = await fetch(`${apiPath}/query-v3?search=${encodeURIComponent(searchString)}&uid=${uid}`).catch(console.error)
    if (!res) return []

    let itemsText = await res.text()
    if (res.status !== 200) {
        alert(itemsText)
        return []
    }

    try {
        return [...api_deserializeJsonl(itemsText.split("\n").filter(Boolean))]
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

        if(i !== 0) qs += `&`

        qs += `${p}=${v}`
        i++
    }
    return await authorizedRequest(`${apiPath}/add-entry${qs}`)
}


let userAuth = sessionStorage.getItem("userAuth") || ""
async function authorizedRequest(url: string | URL, options?: RequestInit & { ["signin-reason"]?: string }): Promise<Response | null> {
    options ||= {}
    options.headers ||= {}
    if (userAuth == "") {
        try {
            userAuth = await signinUI(options?.["signin-reason"] || "")
            sessionStorage.setItem("userAuth", userAuth)
        } catch(err) {
            return null
        }
    }
    options.headers["Authorization"] = `Basic ${userAuth}`
    let res = await fetch(url, options)
    if (res.status === 401) {
        userAuth = ""
        return await authorizedRequest(url, options)
    }
    return res
}

async function api_deleteEvent(itemId: bigint, ts: number, after: number) {
    return await authorizedRequest(`${apiPath}/engagement/delete-event?id=${itemId}&after=${after}&timestamp=${ts}`)
}

async function api_registerEvent(itemId: bigint, name: string, ts: number, after: number, tz?: string) {
    tz ||= Intl.DateTimeFormat().resolvedOptions().timeZone
    return await authorizedRequest(`${apiPath}/engagement/register-event?name=${encodeURIComponent(name)}&id=${itemId}&after=${after}&timestamp=${ts}&timezone=${encodeURIComponent(tz)}`)
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

async function api_getEntryMetadata(itemId: bigint) {
    return await fetch(`${apiPath}/metadata/retrieve?id=${itemId}&uid=${uid}`)
}

async function api_fetchLocation(itemId: bigint, provider?: string, providerId?: string) {
    let qs = `?uid=${uid}&id=${itemId}`
    if(provider) {
        qs += `&provider=${provider}`
    }
    if(providerId) {
        qs += `&provider-id=${providerId}`
    }
    return authorizedRequest(`${apiPath}/metadata/fetch-location${qs}`, {
        "signin-reason": "set location"
    })
}

async function api_setItem(subpath: "engagement/" | "metadata/" | "", item: InfoEntry | MetadataEntry | UserEntry) {
    const serialized = api_serializeEntry(item)
    return authorizedRequest(`${apiPath}/${subpath}set-entry`, {
        body: serialized,
        method: "POST",
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
