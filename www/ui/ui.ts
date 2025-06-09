/*
 * This file is for functions that should be called by the ui to handle api operations
 * with client-side inputs
*/

function setUserAuth(auth: string, into: { setItem(key: string, value: any): any } = localStorage) {
    into.setItem.bind(into)("userAuth", auth)
}

function getUserAuth(from: { getItem(key: string): string | null } = localStorage) {
    return from.getItem.bind(from)("userAuth")
}

function storeUserUID(id: string) {
    localStorage.setItem("userUID", id)
}

const statsOutput = document.getElementById("result-stats") as HTMLElement


const cookies = Object.fromEntries(document.cookie.split(";").map(v => {
    let [k, ...val] = v.trim().split("=")
    let valAll = val.join("=")
    return [k, valAll]
}))

if (cookies['login']) {
    setUserAuth(cookies['login'])
    setUIDUI(cookies['uid'])
}
if (cookies['uid']) {
    storeUserUID(cookies['uid'])
}


// if (document.cookie.match(/login=[A-Za-z0-9=/]+/)) {
//     sessionStorage.setItem("userAuth", document.cookie.slice("login=".length))
// }

type StatCalculator = (item: InfoEntry, multiplier: number) => number
class Statistic {
    name: string
    calculation: StatCalculator
    additive: boolean

    #value: number = 0
    el: HTMLElement
    constructor(name: string, additive: boolean, calculation: StatCalculator) {
        this.name = name
        this.additive = additive
        this.calculation = calculation
        this.el = document.createElement("entries-statistic")
        this.el.setAttribute("data-stat-name", this.name)
        statsOutput.append(this.el)
    }
    set value(v: number) {
        this.#value = v
        this.el.innerText = String(this.#value)
    }
    get value() {
        return this.#value
    }
    set(value: number) {
        this.value = value
    }
    add(value: number) {
        this.value += value
    }
    changeWithItem(item: InfoEntry, mult: number) {
        let value = this.calculation(item, mult)
        if (!this.additive) {
            this.value = value
        } else {
            this.value += value
        }
    }
    changeWithItemList(items: InfoEntry[], mult: number) {
        if (!this.additive) {
            this.value = this.calculation(items[0] || genericInfo(0n, getUidUI()), mult)
        } else {
            for (let item of items) {
                this.value += this.calculation(item, mult)
            }
        }
    }
}

let statistics = [
    new Statistic("results", false, () => globalsNewUi.results.length),
    new Statistic("count", true, (_, mult) => 1 * mult),
    new Statistic("totalCost", true, (item, mult) => item.PurchasePrice * mult)
]

document.addEventListener("keydown", e => {
    if (!e.ctrlKey) return
    switch (e.key) {
        case "/": {
            let form = document.getElementById("sidebar-form") as HTMLFormElement
            (form.querySelector('[name="search-query"]') as HTMLInputElement).focus()
            break
        }
        case "m": {
            e.preventDefault()
            let viewToggle = document.getElementById("view-toggle") as HTMLSelectElement
            viewToggle.focus()
            break
        }
        case "p": {
            openModalUI("script-select")
            e.preventDefault()
            break
        }
    }
})

type UserScript_FN =(selected: InfoEntry[], results: InfoEntry[]) => any
class UserScript {
    exec: UserScript_FN
    desc: string
    constructor(exec: UserScript_FN, desc: string) {
        this.desc = desc
        this.exec = exec
    }
}

const userScripts = new Map<string, UserScript>

/**
 * Runs a user script
 * Side effects:
 * - closes the #script-select modal
 * @param {string} name - the name of the script to run
 */
function runUserScriptUI(name: string) {
    const script = userScripts.get(name)
    if(!script) return
    script.exec(globalsNewUi.selectedEntries, globalsNewUi.results.map(v => v.info))
    closeModalUI("script-select")
}

/**
 * Creates a new user script
 * Side effects
 * - adds a new script element to #script-select
 * @param {string} name - name of the script
 * @param {UserScript_FN} onrun - a function that takes 2 arguments, InfoEntry[] of selected items, and InfoEntry[] of search results
 * @param {string} desc - what the script does
 */
function addUserScriptUI(name: string, onrun: UserScript_FN, desc: string) {
    const scriptSelect = document.getElementById("script-select")
    if(!scriptSelect) return
    const par = document.createElement("div")
    par.classList.add("user-script")
    par.id = `user-script-${name}`
    const title = document.createElement("h3")
    const d = document.createElement("p")
    d.innerHTML = desc
    par.replaceChildren(title, d)
    title.innerText = name
    title.onclick = () => runUserScriptUI(name)
    scriptSelect.append(par)
    userScripts.set(name, new UserScript(onrun, desc))
}

async function promptUI(html?: string, _default?: string): Promise<string | null> {
    const pEl = document.getElementById("prompt") as HTMLDialogElement
    const close = pEl.querySelector("button:first-child") as HTMLButtonElement
    const root = pEl.querySelector("[root]") as HTMLDivElement
    const submission = pEl.querySelector('[name="prompt-value"]') as HTMLInputElement
    submission.value = ""
    root.innerHTML = html || "<p>prompt</p>"
    pEl.showModal()
    return await new Promise((res, rej) => {
        pEl.onclose = () => {
            res(pEl.returnValue ?? _default ?? null)
        }
        close.onclick = () => {
            pEl.close(undefined)
        };
        (submission.form as HTMLFormElement).onsubmit = () => {
            pEl.close(submission.value)
        }
    })
}

function resetStatsUI() {
    for (let stat of statistics) {
        stat.set(0)
    }
}

function openModalUI(modalName: string, root: { getElementById(elementId: string): HTMLElement | null } = document) {
    let dialog = root.getElementById(modalName)
    if (!dialog || !(dialog instanceof HTMLDialogElement)) return
    dialog.showModal()
}

function closeModalUI(modalName: string, root: { getElementById(elementId: string): HTMLElement | null } = document) {
    let dialog = root.getElementById(modalName)
    if (!dialog || !(dialog instanceof HTMLDialogElement)) return
    dialog.close()
}

function toggleModalUI(modalName: string, root: { getElementById(elementId: string): HTMLElement | null } = document) {
    let dialog = root.getElementById(modalName)
    if (!dialog || !(dialog instanceof HTMLDialogElement)) return
    if (dialog.open) {
        dialog.close()
    } else {
        dialog.showModal()
    }
}

function createStatUI(name: string, additive: boolean, calculation: StatCalculator) {
    statistics.push(new Statistic(name, additive, calculation))
    setResultStatUI(name, 0)
}

function deleteStatUI(name: string) {
    statistics = statistics.filter(v => v.name !== name)
    return deleteResultStatUI(name)
}

function setResultStatUI(key: string, value: number) {
    for (let stat of statistics) {
        if (stat.name !== key) continue

        stat.set(value)
        break
    }
}

function changeResultStatsUI(key: string, value: number) {
    for (let stat of statistics) {
        if (stat.name !== key) continue

        stat.add(value)
        break
    }
}

function changeResultStatsWithItemUI(item: InfoEntry, multiplier: number = 1) {
    if (!item) return
    for (let stat of statistics) {
        stat.changeWithItem(item, multiplier)
    }
}

function deleteResultStatUI(key: string) {
    let el = statsOutput.querySelector(`[data-stat-name="${key}"]`)
    if (el) {
        el.remove()
        return true
    }
    return false
}

function changeResultStatsWithItemListUI(items: InfoEntry[], multiplier: number = 1) {
    for (let stat of statistics) {
        stat.changeWithItemList(items, multiplier)
    }
}

function sortEntriesUI() {
    let newEntries = sortEntries(globalsNewUi.results.map(v => v.info), sortBySelector.value)
    let ids = newEntries.map(v => v.ItemId)
    items_setResults(ids)
    clearItems()
    reorderSidebar(ids)
}

function getUidUI() {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement
    if (!uidSelector) return 0
    return Number(uidSelector.value)
}

function getSearchDataUI() {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    let data = new FormData(form)
    return data
}

function mkSearchUI(params: Record<string, string>) {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    for (let param in params) {
        let inp = form.querySelector(`[name="${param}"]`) as HTMLInputElement | null
        if (!inp || inp.tagName !== "INPUT") continue
        inp.value = params[param]
    }
    form.submit()
}

async function loadSearchUI() {
    let form = document.getElementById("sidebar-form") as HTMLFormElement

    let formData = new FormData(form)

    let filters = parseClientsideSearchFiltering(formData)

    let entries = await api_queryV3(String(filters.newSearch) || "#", Number(formData.get("uid")) || 0, filters.sortBy)

    entries = applyClientsideSearchFiltering(entries, filters)

    setResultStatUI("results", entries.length)

    items_setResults(entries.map(v => v.ItemId))

    clearItems()
    clearSidebar()
    if (entries.length === 0) {
        setError("No results")
        return
    }
    renderSidebar(globalsNewUi.results.map(v => v.info), false)
}

function deleteEntryUI(item: InfoEntry) {
    if (!confirm("Are you sure you want to delete this item")) {
        return
    }

    aio_delete(item.ItemId).then(res => {
        if (res === 1) {
            alert("Failed to delete item")
            return
        }
        alert(`Deleted: ${item.En_Title} (${item.Native_Title ? item.Native_Title + " : " : ""}${item.ItemId})`)
    })
}

async function fetchLocationUI(id: bigint, provider?: string) {
    let res = await api_fetchLocation(id, getUidUI(), provider)
    if (res?.status !== 200) {
        alert("Failed to get location")
        return
    }

    let newLocation = await res.text()

    let item = findInfoEntryById(id) as InfoEntry

    item.Location = newLocation

    updateInfo2({
        [String(item.ItemId)]: { info: item }
    })
    alert(`Location set to: ${newLocation}`)
}

function overwriteEntryMetadataUI(_root: ShadowRoot, item: InfoEntry) {
    if (!confirm("Are you sure you want to overwrite the metadata with a refresh")) {
        return
    }

    api_overwriteMetadataEntry(item.ItemId).then(res => {
        if (res?.status !== 200) {
            alert("Failed to get metadata")
            return
        }

        alert("Metadata set")

        res.text().then((newMetaText: string) => {
            let newMeta = api_deserializeJsonl(newMetaText).next().value
            let sId = String(item.ItemId)
            updateInfo2({ [sId]: { meta: newMeta } })

            if (newMeta.Provider === "steam") {
                fetchLocationUI(item.ItemId, "steam")
            }
        })
    })
}

async function newEntryUI(form: HTMLFormElement) {
    document.getElementById("new-entry")?.hidePopover()
    const data = new FormData(form)

    let artStyle = 0

    const styles = ['is-anime-art', 'is-cartoon', 'is-handrawn', 'is-digital-art', 'is-cgi', 'is-live-action']
    for (let i = 0; i < styles.length; i++) {
        let style = styles[i]
        if (data.get(style)) {
            artStyle |= 2 ** i
            data.delete(style)
        }
    }

    let validEntries: Record<string, FormDataEntryValue> = {}
    for (let [name, value] of data.entries()) {
        if (value == "") continue
        validEntries[name] = value
    }

    if (validEntries["libraryId"] && validEntries["libraryId"] == "0") {
        delete validEntries["libraryId"]
    }

    const queryString = "?" + Object.entries(validEntries).map(v => `${v[0]}=${encodeURIComponent(String(v[1]))}`).join("&") + `&art-style=${artStyle}`

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

    let res = await authorizedRequest(`${apiPath}/add-entry${queryString}&timezone=${encodeURIComponent(tz)}`)
    let text = await res?.text()
    if (res?.status !== 200 || !text) {
        alert(text)
        return
    }

    let json = api_deserializeJsonl(text).next().value

    //FIXME: should only load new item's events
    Promise.all([
        api_getEntryMetadata(json.ItemId, getUidUI()),
        api_loadList<UserEvent>("engagement/list-events", getUidUI())
    ]).then(res => {
        let [x, y] = res
        let meta, events
        if (x === null || probablyMetaEntry(x)) {
            if (x === null) {
                alert("Failed to load new item metadata, please reload")
            }
            meta = x || genericMetadata(json.ItemId)
            events = y
        } else {
            events = y
            meta = x
        }

        events = events.filter(v => v.ItemId === json.ItemId)

        items_addItem({
            meta,
            user: genericUserEntry(json.ItemId),
            events: [],
            info: json
        })

        ui_search(`En_Title = '${quoteEscape(json.En_Title, "'")}'`)
    }).catch((err) => {
        console.error(err)
        alert("Failed to load new item metadata, please reload")
    })
}
const newItemForm = document.getElementById("new-item-form") as HTMLFormElement
if (newItemForm) {
    newItemForm.onsubmit = function() {
        newEntryUI(newItemForm)
    }
}

async function fillItemListingWithSearch(search: string): Promise<HTMLDivElement> {
    let results = await api_queryV3(search, getUidUI())
    return fillItemListingUI(Object.fromEntries(
        results.map(v => [
            String(v.ItemId),
            new items_Entry(
                v,
                findUserEntryById(v.ItemId),
                findMetadataById(v.ItemId)
            )
        ])
    ))
}

function fillItemListingUI(entries: Record<string, MetadataEntry | items_Entry>, addCancel = true): HTMLDivElement {
    const itemsFillDiv = document.getElementById("put-items-to-select") as HTMLDivElement
    itemsFillDiv.innerHTML = ""

    const container = itemsFillDiv.querySelector("div") || document.createElement("div")
    container.classList.add("grid")
    container.classList.add("center")
    container.style.gridTemplateColumns = "1fr 1fr 1fr"

    if (addCancel) {
        entries["0"] = new items_Entry(genericInfo(0n, 0))
        entries["0"].info.En_Title = "CANCEL SELECTION"
    }

    for (let id in entries) {
        //no need to re-render the element (thumbnail or title might be different, that's ok)
        if (container.querySelector(`[data-item-id="${id}"]`)) {
            continue
        }

        const entry = entries[id]

        let title
        if (probablyMetaEntry(entry)) {
            title = (entry.Title || entry.Native_Title) || "unknown"
        } else {
            title = entry.info.En_Title || entry.info.Native_Title || entry.meta.Title || entry.meta.Native_Title
        }

        const fig = document.createElement("figure")

        fig.style.cursor = "pointer"

        fig.setAttribute("data-item-id", String(id))

        let thumbnail = probablyMetaEntry(entry) ? fixThumbnailURL(entry.Thumbnail) : entry.fixedThumbnail

        const img = document.createElement("img")
        img.src = fixThumbnailURL(thumbnail)
        img.width = 100
        img.loading = "lazy"
        const caption = document.createElement("figcaption")
        caption.innerText = title

        fig.append(img)
        fig.append(caption)

        container.append(fig)
    }

    itemsFillDiv.append(container)
    return container
}

async function replaceValueWithSelectedItemIdUI(input: HTMLInputElement) {
    let item = await selectItemUI()
    const popover = document.getElementById("items-listing") as HTMLDialogElement
    console.log(popover.returnValue)
    if (item === null) {
        input.value = "0"
        return
    }
    input.value = popover.returnValue
}

type SelectItemOptions = Partial<{
    container: HTMLDivElement | null,
    onsearch: (query: string) => Promise<HTMLDivElement>
}>

/**
 * @description lets the user select an item, be sure to use fillItemListingUI first
*/
async function selectItemUI(options?: SelectItemOptions): Promise<null | bigint> {
    const popover = document.getElementById("items-listing") as HTMLDialogElement

    let f = document.getElementById("items-listing-search") as HTMLFormElement
    let query = f.querySelector('[name="items-listing-search"]') as HTMLInputElement

    let { container, onsearch } = options || {}

    if (!onsearch) {
        onsearch = fillItemListingWithSearch
    }

    if (!container) {
        let cpy = { ...globalsNewUi.entries }
        container = fillItemListingUI(cpy, true)
    }

    popover.showModal()

    return await new Promise((res, rej) => {
        function registerFigClickEvents(container: HTMLElement) {
            for (let fig of container.querySelectorAll("figure")) {
                const id = fig.getAttribute("data-item-id")
                fig.onclick = () => {
                    popover.close(String(id))
                    res(BigInt(id as string))
                }
            }
        }
        f.onsubmit = function() {
            onsearch(query.value).then(registerFigClickEvents)
        }
        registerFigClickEvents(container)

        setTimeout(() => {
            rej(null)
            popover.close("0")
        }, 60000)
    })
}

async function signinUI(reason: string): Promise<string> {
    const loginPopover = document.getElementById("login") as HTMLDialogElement
    (loginPopover.querySelector("#login-reason") as HTMLParagraphElement)!.innerText = reason || ""

    //if the popover is already open, something already called this function for the user to sign in
    if (loginPopover.open) {
        return await new Promise((res, rej) => {
            //wait until the user finally does sign in, and the userAuth is set, when it is set, the user has signed in and this function can return the authorization
            setInterval(() => {
                let auth = getUserAuth()
                if (auth) {
                    res(auth)
                }
            }, 16)
        })
    }

    loginPopover.showModal()
    return await new Promise((res, rej) => {
        const form = loginPopover.querySelector("form") as HTMLFormElement
        form.onsubmit = function() {
            let data = new FormData(form)
            let username = data.get("username")
            let password = data.get("password")
            loginPopover.close()

            api_username2UID(username!.toString()).then(uid => storeUserUID(String(uid)))

            res(btoa(`${username}:${password}`))
        }

        setTimeout(() => {
            loginPopover.close()
            rej(null)
        }, 60000)
    })
}

async function fillFormatSelectionUI() {
    const formatSelector = document.querySelector('[name="format"]') as HTMLSelectElement

    const formats = await api_listFormats()
    let opts = []
    for (let fNo in formats) {
        let name = formats[fNo]
        if (name === "MOD_DIGITAL") continue

        let opt = document.createElement("option")
        opt.value = fNo
        opt.innerText = formats[fNo]
        opts.push(opt)
    }

    formatSelector.replaceChildren(...opts)
}

async function fillTypeSelectionUI() {
    const typeDropdown = document.querySelector("#new-item-form [name=\"type\"]")

    if (typeDropdown === null) {
        console.error("type dropdown could not be found")
        return
    }

    for (let type of await api_listTypes()) {
        const option = document.createElement("option")
        option.value = type
        option.innerText = type
        typeDropdown.append(option)
    }
}

async function fillUserSelectionUI() {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement | null
    if (!uidSelector) {
        alert("Failed to 💧H Y D R A T E💧 the user selection list, aborting")
        return
    }

    for (let acc of await api_listAccounts()) {
        const opt = document.createElement("option")
        const [id, name] = acc.split(":")

        ACCOUNTS[Number(id)] = name

        opt.value = id
        opt.innerText = name
        uidSelector.append(opt)
    }
}

function setUIDUI(uid: string) {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement | null
    uidSelector && (uidSelector.value = uid)
}

function setUIDFromHeuristicsUI() {
    const params = new URLSearchParams(document.location.search)
    if (params.has("uname")) {
        let uid = Object.entries(ACCOUNTS).filter(([_, name]) => name === params.get("uname") as string)[0]
        if (!uid) {
            setError(`username: ${params.get("uname")} does not exist`)
            return
        }
        setUIDUI(String(uid))
    } else if (params.has("uid")) {
        setUIDUI(params.get("uid") as string)
    } else if (localStorage.getItem("userUID")) {
        setUIDUI(localStorage.getItem("userUID") as string)
    }
}

function setDisplayModeUI(on: boolean | "toggle" = "toggle") {
    let mainUI = document.getElementById("main-ui")
    if (on === "toggle") {
        mainUI?.classList.toggle("display-mode")
    } else if (on) {
        mainUI?.classList.add("display-mode")
    } else {
        mainUI?.classList.remove("display-mode")
    }
}

function setFaviconUI(path: string) {
    let link = (document.querySelector("link[rel=\"shortcut icon\"]") || document.createElement("link")) as HTMLLinkElement
    link.setAttribute("rel", "shortcut icon")
    link.href = path
    document.head.append(link)
}

function updatePageInfoWithItemUI(item: InfoEntry) {
    document.title = `[AIO] | ${item.En_Title || item.Native_Title}`
    setFaviconUI(fixThumbnailURL(findMetadataById(item.ItemId).Thumbnail))
}

type StartupLang = "javascript" | "aiol" | ""
function doUIStartupScript(script: string, lang: StartupLang) {
    if (script === "") return

    if (lang == "aiol" || lang == "") {
        parseExpression(script, new CalcVarTable())
    } else {
        //this is the user's own script, this should be fine
        eval(script)
    }
}

type UserSettings = {
    UIStartupScript: string
    StartupLang: StartupLang
}

async function getSettings(uid: number): Promise<UserSettings> {
    let res = await authorizedRequest(`/settings/get?uid=${uid}`)
    if (res === null || res.status !== 200) {
        console.error(res?.status)
        return { UIStartupScript: "", StartupLang: "" }
    }
    return await res.json() as UserSettings
}
