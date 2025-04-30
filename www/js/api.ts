type UserEntry = {
    ItemId: bigint
    Status: string
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
    "Paused"

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
    Type: string
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
}


type IdentifyResult = {
    Description: string
    Thumbnail: string
}

type Status = string

let formats: { [key: number]: string } = {}

function mkStrItemId(jsonl: string) {
    return jsonl
        .replace(/"ItemId":\s*(\d+),/, "\"ItemId\": \"$1\",")
        .replace(/"ParentId":\s*(\d+),/, "\"ParentId\": \"$1\",")
        .replace(/"CopyOf":\s*(\d+)(,)?/, "\"CopyOf\": \"$1\"$2")
        .replace(/"Library":\s*(\d+)(,)?/, "\"Library\": \"$1\"$2")
}

function mkIntItemId(jsonl: string) {
    return jsonl
        .replace(/"ItemId":"(\d+)",/, "\"ItemId\": $1,")
        .replace(/"ParentId":"(\d+)",/, "\"ParentId\": $1,")
        .replace(/"CopyOf":"(\d+)"(,)?/, "\"CopyOf\": $1$2")
        .replace(/"Library":"(\d+)"(,)?/, "\"Library\": $1$2")
}

function serializeEntry(entry: UserEntry | InfoEntry | MetadataEntry | UserEvent) {
    return mkIntItemId(
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
    return status === "Paused"
}

async function listFormats() {
    if (Object.keys(formats).length > 0) return formats

    const res = await fetch(`${apiPath}/type/format`)

    if (res.status !== 200) {
        return formats
    }

    const json = await res.json()
    formats = json
    return formats
}

async function listTypes() {
    const res = await fetch(`${apiPath}/type/type`)
    return await res.json()
}

function parseJsonL(jsonl: string) {
    const bigIntProperties = ["ItemId", "ParentId", "CopyOf", "Library"]
    try {
        return JSON.parse(jsonl, (key, v) => bigIntProperties.includes(key) ? BigInt(v) : v)
    }
    catch (err) {
        console.error("Could not parse json", err)
    }
}

async function loadList<T>(endpoint: string): Promise<T[]> {
    const res = await fetch(`${apiPath}/${endpoint}?uid=${uid}`)
    if (!res) {
        return []
    }

    const text = await res.text()
    if (!text) {
        return []
    }

    const lines = text.split("\n").filter(Boolean)
    return lines
        .map(mkStrItemId)
        .map(parseJsonL)
}

function fixThumbnailURL(url: string) {
    //a / url assumes that the aio server is the same as the web server
    if (url.startsWith("/")) {
        return `${AIO}${url}`
    }
    return url
}

async function copyUserInfo(oldid: bigint, newid: bigint) {
    return await authorizedRequest(`${apiPath}/engagement/copy?src-id=${oldid}&dest-id=${newid}`, {
        ["signin-reason"]: "copy user info"
    }).catch(console.error)
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
        "Unowned": "X"
    }
    if (type in conversion) {
        //@ts-ignore
        return conversion[type]
    }
    return type
}

async function nameToFormat(name: string): Promise<number> {
    const DIGI_MOD = 0x1000
    let val = 0
    name = name.toLowerCase()
    if (name.includes("+digital")) {
        name = name.replace("+digital", "")
        val |= DIGI_MOD
    }

    const formats = Object.fromEntries(Object.entries(await listFormats()).map(([k, v]) => [v, Number(k)]))

    val |= formats[name as keyof typeof formats]
    return val

}

async function formatToName(format: number): Promise<string> {
    const DIGI_MOD = 0x1000
    let out = ""
    if ((format & DIGI_MOD) === DIGI_MOD) {
        format -= DIGI_MOD
        out = " +digital"
    }

    const formats = await listFormats()

    if (format >= Object.keys(formats).length) {
        return `unknown${out}`
    }
    return `${formats[format].toUpperCase()}${out}`
}

async function identify(title: string, provider: string) {
    return await authorizedRequest(`${apiPath}/metadata/identify?title=${encodeURIComponent(title)}&provider=${provider}`)
}

async function finalizeIdentify(identifiedId: string, provider: string, applyTo: bigint) {
    identifiedId = encodeURIComponent(identifiedId)
    provider = encodeURIComponent(provider)
    return await authorizedRequest(`${apiPath}/metadata/finalize-identify?identified-id=${identifiedId}&provider=${provider}&apply-to=${applyTo}`)
}

async function updateThumbnail(id: bigint, thumbnail: string) {
    return await authorizedRequest(`${apiPath}/metadata/set-thumbnail?id=${id}`, {
        method: "POST",
        body: thumbnail,
        "signin-reason": "update thumbnail"
    })
}

async function setParent(id: bigint, parent: bigint) {
    return await authorizedRequest(`${apiPath}/mod-entry?id=${id}&parent-id=${parent}`)
}

async function doQuery3(searchString: string) {
    const res = await fetch(`${apiPath}/query-v3?search=${encodeURIComponent(searchString)}&uid=${uid}`).catch(console.error)
    if (!res) return []

    let itemsText = await res.text()
    if (res.status !== 200) {
        alert(itemsText)
        return []
    }

    try {
        let jsonL = itemsText.split("\n")
            .filter(Boolean)
            .map(mkStrItemId)
            .map(parseJsonL)
        return jsonL
    } catch (err) {
        console.error(err)
    }

    return []
}

async function setPos(id: bigint, pos: string) {
    return authorizedRequest(`${apiPath}/engagement/mod-entry?id=${id}&current-position=${pos}`)
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
    "tags": string,
    "location": string,
    "get-metadata": boolean,
    "metadata-provider": string,
    "user-rating": number,
    "user-status": UserStatus,
    "user-view-count": number,
    "user-notes": string
}

async function newEntry(params: NewEntryParams) {
    let qs = ""
    for (let p in params) {
        let v = params[p as keyof NewEntryParams]
        if (typeof v === 'bigint') {
            v = String(v)
        } else if (typeof v !== 'undefined') {
            v = encodeURIComponent(v)
        } else {
            continue
        }
        qs += `${p}=${v}`
    }
    return await authorizedRequest(`${apiPath}/add-entry${qs}`)
}

async function signin(reason?: string): Promise<string> {
    const loginPopover = document.getElementById("login") as HTMLDialogElement
    (loginPopover.querySelector("#login-reason") as HTMLParagraphElement)!.innerText = reason || ""

    //if the popover is already open, something already called this function for the user to sign in
    if (loginPopover.matches(":popover-open")) {
        return await new Promise((res, rej) => {
            //wait until the user finally does sign in, and the userAuth is set, when it is set, the user has signed in and this function can return the authorization
            setInterval(() => {
                let auth = sessionStorage.getItem("userAuth")
                if (auth) {
                    res(auth)
                }
            }, 16)
        })
    }

    loginPopover.showPopover()

    return await new Promise((res, rej) => {
        const form = loginPopover.querySelector("form") as HTMLFormElement
        form.onsubmit = function() {
            let data = new FormData(form)
            let username = data.get("username")
            let password = data.get("password")
            loginPopover.hidePopover()
            res(btoa(`${username}:${password}`))
        }
    })
}


let userAuth = sessionStorage.getItem("userAuth") || ""
async function authorizedRequest(url: string | URL, options?: RequestInit & { ["signin-reason"]?: string }): Promise<Response> {
    options ||= {}
    options.headers ||= {}
    if (userAuth == "") {
        userAuth = await signin(options?.["signin-reason"])
        sessionStorage.setItem("userAuth", userAuth)
    }
    options.headers["Authorization"] = `Basic ${userAuth}`
    return await fetch(url, options)
}

async function apiDeleteEvent(itemId: bigint, ts: number, after: number) {
    return await authorizedRequest(`${apiPath}/engagement/delete-event?id=${itemId}&after=${after}&timestamp=${ts}`)
}

async function apiRegisterEvent(itemId: bigint, name: string, ts: number, after: number) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return await authorizedRequest(`${apiPath}/engagement/register-event?name=${encodeURIComponent(name)}&id=${itemId}&after=${after}&timestamp=${ts}&timezone=${encodeURIComponent(tz)}`)
}

async function addEntryTags(itemId: bigint, tags: string[]) {
    return await authorizedRequest(`${apiPath}/add-tags?tags=${encodeURIComponent(tags.join("\x1F"))}&id=${itemId}`)
}

async function deleteEntryTags(itemId: bigint, tags: string[]) {
    return await authorizedRequest(`${apiPath}/delete-tags?tags=${encodeURIComponent(tags.join("\x1F"))}&id=${itemId}`)
}

async function deleteEntry(itemId: bigint) {
    return await authorizedRequest(`${apiPath}/delete-entry?id=${itemId}`, {
        "signin-reason": "delete this entry"
    })
}

async function overwriteMetadataEntry(itemId: bigint) {
    return authorizedRequest(`${apiPath}/metadata/fetch?id=${itemId}`, {
        "signin-reason": "automatically update metadata"
    })
}

async function updateInfoTitle(itemId: bigint, newTitle: string) {
    return authorizedRequest(`${apiPath}/mod-entry?id=${itemId}&en-title=${newTitle}`)
}

async function fetchLocation(itemId: bigint, provider?: string) {
    if (provider) {
        return authorizedRequest(`${apiPath}/metadata/fetch-location?uid=${uid}&id=${itemId}&provider=${provider}`, {
            "signin-reason": "set location"
        })
    }
    return authorizedRequest(`${apiPath}/metadata/fetch-location?uid=${uid}&id=${itemId}`, {
        "signin-reason": "set location"
    })
}
