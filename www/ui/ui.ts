/*
 * This file is for functions that should be called by the ui to handle api operations
 * with client-side inputs
*/

const newWindow = document.getElementById("new-view-window") as HTMLButtonElement
const viewToggle = document.getElementById("view-toggle") as HTMLSelectElement
const viewAllElem = document.getElementById("view-all")
const statsOutput = document.getElementById("result-stats") as HTMLElement
const itemFilter = document.getElementById("item-filter") as HTMLInputElement
const newEntryLibrarySelector = document.querySelector("[name=\"libraryId\"]") as HTMLSelectElement
const librarySelector = document.getElementById("library-selector") as HTMLSelectElement
const userSelector = document.querySelector('[name="uid"]') as HTMLSelectElement
const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement

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

viewToggle?.addEventListener("change", e => {
    mode_setMode((e.target as HTMLSelectElement).value, (catalogWin || window) as Window & typeof globalThis)
})

librarySelector?.addEventListener("change", function() {
    let val = librarySelector.value
    items_setCurrentLibrary(BigInt(val))

    loadSearchUI()
})

userSelector?.addEventListener("change", function() {
    refreshInfo(getUidUI()).then(() => loadSearchUI())
    fillRecommendedListUI(null, getUidUI())
})

sortBySelector?.addEventListener("change", function() {
    sortEntriesUI()
})

itemFilter?.addEventListener("input", function() {
    const filtered = getFilteredResultsUI()
    const ids = filtered.map(v => v.ItemId)
    //remove items that dont match
    for (let sidebarE of sidebarItems.querySelectorAll("sidebar-entry")) {
        const id = sidebarE.getAttribute("data-entry-id") as string
        if (!ids.includes(BigInt(id))) {
            sidebarE.remove()
        }
    }

    //add items that DO match            reapply sort
    renderSidebarItemList(filtered).then(sortEntriesUI)
})

if (viewAllElem instanceof HTMLInputElement)
    viewAllElem.addEventListener("change", e => {
        resetStatsUI()
        if (!viewAllElem.checked) {
            clearItems(false)
        } else {
            clearItems()
            for (let mode of openViewModes) {
                selectItemList(getFilteredResultsUI(), true, mode)
            }
        }
    })

if (newWindow)
    newWindow.onclick = function() {
        let urlParams = new URLSearchParams(location.search)
        urlParams.set("display", "true")
        urlParams.set("no-select", "true")
        urlParams.set("no-startup", "true")
        urlParams.set("no-mode", "true")
        const newURL = `${location.origin}${location.pathname}?${urlParams.toString()}${location.hash}`
        const win = open(newURL, "_blank", "popup=true")
        if (!win) return
        const mode = mode_getFirstModeInWindow(catalogWin || window)
        if (!mode) return
        win.onload = () => {
            mode_setMode(mode.NAME, win as Window & typeof globalThis)
        }
    }

function setError(text: string) {
    const errorOut = currentDocument().getElementById("error")
    if (text == "") {
        errorOut?.removeAttribute("data-error")
    } else {
        errorOut?.setAttribute("data-error", text)
    }
}

async function refreshInfo(uid: number) {
    await Promise.all([
        loadLibraries(uid),
        loadInfoEntries(uid),
    ])
    return Promise.all([
        loadUserEvents(uid),
        items_refreshMetadata(uid)
    ])
}

async function loadLibraries(uid: number) {
    await items_loadLibraries(uid)
    updateLibraryDropdown()
}

async function loadInfoEntries(uid: number) {
    setError("Loading items")

    await items_refreshInfoEntries(uid)

    setError("")

    items_refreshUserEntries(uid).then(() => {
        updateInfo2(items_getAllEntries())
    })

    return items_getAllEntries()
}


function addSortUI(category: string, name: string, cb: ((a: InfoEntry, b: InfoEntry) => number)) {
    const internalSortName = items_addSort(name, cb)
    let group = sortBySelector.querySelector(`optgroup[label="${category}"]`)
    if (!group) {
        group = document.createElement("optgroup")
        group.setAttribute("label", category)
        sortBySelector.appendChild(group)
    }

    const opt = document.createElement("option")
    opt.value = internalSortName
    opt.innerText = name
    group.append(opt)
}

function currentDocument() {
    return catalogWin?.document || document
}

function toggleUI(id: string, on?: '' | "none") {
    const elem = document.getElementById(id) as HTMLElement | null
    if (!elem) return
    elem.style.display = on ?? (
        elem.style.display
            ? ''
            : "none")
}

function getCSSProp(name: string, fallback: string) {
    const s = getComputedStyle(document.documentElement)
    return s.getPropertyValue(name) || fallback
}

function getFilteredResultsUI(list: items_Entry[] | null = null): InfoEntry[] {
    let newArr = []
    const search = itemFilter.value.toLowerCase()
    for (let item of list || items_getResults()) {
        for (let str of [item.info.En_Title, item.info.Native_Title, item.meta.Title, item.meta.Native_Title]) {
            if (str.toLowerCase().includes(search)) {
                newArr.push(item.info)
                break
            }
        }
    }
    return newArr
}


// if (document.cookie.match(/login=[A-Za-z0-9=/]+/)) {
//     sessionStorage.setItem("userAuth", document.cookie.slice("login=".length))
// }

type StatCalculator = (item: InfoEntry, multiplier: number) => number
class Statistic {
    name: string
    calculation: StatCalculator
    additive: boolean
    resetable: boolean = true

    #value: number = 0
    el: HTMLElement
    constructor(name: string, additive: boolean, calculation: StatCalculator) {
        this.name = name
        this.additive = additive
        this.calculation = calculation
        this.el = document.createElement("entries-statistic")
        this.el.setAttribute("data-stat-name", this.name)
        statsOutput?.append(this.el)
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
    new Statistic("results", false, () => getFilteredResultsUI().length),
    new Statistic("count", true, (_, mult) => 1 * mult),
    new Statistic("totalCost", true, (item, mult) => item.PurchasePrice * mult)
]

statistics[0].resetable = false

document.addEventListener("keydown", e => {

    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (e.shiftKey || e.ctrlKey)) {
        if (!document.activeElement || document.activeElement.tagName !== "SIDEBAR-ENTRY") {
            focusNthSidebarItem(e.key === "ArrowUp" ? sidebarItems.childElementCount : 1)
        } else focusNextSidebarItem(e.key === "ArrowUp")
        if (e.ctrlKey) {
            if (!e.shiftKey) clearItems()
            selectFocusedSidebarItem()
        }
        e.preventDefault()
        return
    }

    if (!e.ctrlKey) return
    switch (e.key) {
        case "/": {
            let form = document.getElementById("sidebar-form") as HTMLFormElement
            const search = form.querySelector('[name="search-query"]') as HTMLInputElement
            search?.focus()
            search?.select()
            e.preventDefault()
            break
        }
        case "?": {
            itemFilter.focus()
            itemFilter.select()
            // document.getElementById("item-filter")?.focus()
            e.preventDefault()
            break
        }
        case "A": {
            viewAllElem && viewAllElem.click()
            e.preventDefault()
            break
        }
        case "m": {
            e.preventDefault()
            viewToggle.focus()
            break
        }
        case "p": {
            selectScriptUI()
            e.preventDefault()
            break
        }
        case "N": {
            openModalUI("new-entry")
            e.preventDefault()
            break
        }
        case "S": {
            toggleUI("search-area")
            e.preventDefault()
            break
        }
        case "B": {
            toggleUI("sidebar")
            e.preventDefault()
            break
        }
        case "V": {
            let mainUI = document.getElementById("main-ui")
            //we dont want dual-window mode to be toggleable if we are in display mode
            if (mainUI?.classList.contains("display-mode")) {
                return
            }
            if (isCatalogModeUI()) {
                closeCatalogModeUI()
            } else {
                openCatalogModeUI()
            }
            e.preventDefault()
            break
        }
        case "D": {
            setDisplayModeUI()
            e.preventDefault()
            break
        }
    }
    if ("0123456789".includes(e.key)) {
        clearItems()
        sidebarSelectNth(Number(e.key))
        e.preventDefault()
    }
})

type UserScript_FN = (selected: InfoEntry[], results: InfoEntry[]) => any
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
    if (!script) return
    script.exec(items_getSelected(), items_getResults().map(v => v.info))
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
    if (!scriptSelect) return
    const par = document.createElement("div")
    par.classList.add("user-script")
    par.id = `user-script-${name}`
    const title = document.createElement("h3")
    const d = document.createElement("p")
    const run = document.createElement("button")
    run.append("run")
    d.innerHTML = desc
    par.replaceChildren(title, d, run)
    title.innerText = name
    run.onclick = () => runUserScriptUI(name)
    scriptSelect.append(par)
    userScripts.set(name, new UserScript(onrun, desc))
}

/**
 * Shows a prompt dialog to the user
 * @param {string} html - The prompt message to display
 * @param {string} [_default] - Optional default value for the prompt
 * @returns {Promise<string | null>} the user's response
 */
async function promptUI(html?: string, _default?: string): Promise<string | null> {
    const pEl = currentDocument().getElementById("prompt") as HTMLDialogElement
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

/**
 * Sets all statistics to 0
 */
function resetStatsUI() {
    for (let stat of statistics) {
        if (!stat.resetable) continue
        stat.set(0)
    }
}

/**
 * Opens a modal by id
 * @param {string} modalName - the id of the modal to open
 * @param root - the elemnt which is the parent of the modal to find
 */
function openModalUI(modalName: string, root?: { getElementById(elementId: string): HTMLElement | null }) {
    root ||= catalogWin?.document || document
    let dialog = root.getElementById(modalName)
    if (!dialog || !(dialog instanceof HTMLDialogElement)) return
    dialog.showModal()
}

/**
 * Closes a modal by id
 * @param {string} modalName - the id of the modal to close
 * @param root - the elemnt which is the parent of the modal to find
 */
function closeModalUI(modalName: string, root?: { getElementById(elementId: string): HTMLElement | null }) {
    root ||= catalogWin?.document || document
    let dialog = root.getElementById(modalName)
    if (!dialog || !(dialog instanceof HTMLDialogElement)) return
    dialog.close()
}

/**
 * Toggles a modal's open status by id
 * @param {string} modalName - the id of the modal to toggle
 * @param root - the elemnt which is the parent of the modal to find
 */
function toggleModalUI(modalName: string, root?: { getElementById(elementId: string): HTMLElement | null }) {
    root ||= catalogWin?.document || document
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

/**
 * Sorts entries, and reorders the sidebar based on the selected sort in the sort-by selector
 */
function sortEntriesUI() {
    let newEntries = sortEntries(items_getResults().map(v => v.info), sortBySelector.value)
    let ids = newEntries.map(v => v.ItemId)
    items_setResults(ids)
    clearItems()
    reorderSidebar(getFilteredResultsUI().map(v => v.ItemId))
}

/**
 * Gets the currently selected uid from the uid selector
 */
function getUidUI() {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement
    if (!uidSelector) return 0
    return Number(uidSelector.value)
}

/**
 * Gets the form data from the search form
 * @returns {FormData} the data
 */
function getSearchDataUI(): FormData {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    let data = new FormData(form)
    return data
}

/**
 * Akin to the user submitting the search form
 * @param {Record<string, string>} params - values to override
 */
function mkSearchUI(params: Record<string, string>) {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    for (let param in params) {
        let inp = form.querySelector(`[name="${param}"]`) as HTMLInputElement | null
        if (!inp || inp.tagName !== "INPUT") continue
        inp.value = params[param]
    }
    form.submit()
}

/**
 * Performs a search based on the search form
 * Side effects:
 * - sets the result count statistic to the amount of results
 * - sets the global results list to the new results
 * - clears selected items
 * - re-renders the side bar with the new results
 * - if there are no results, sets the error to "No results"
 */
async function loadSearchUI() {
    let form = document.getElementById("sidebar-form") as HTMLFormElement

    let formData = new FormData(form)

    let filters = parseClientsideSearchFiltering(formData)

    let entries = await api_queryV3(String(filters.newSearch) || "#", Number(formData.get("uid")) || 0, filters.sortBy)

    entries = applyClientsideSearchFiltering(entries, filters)

    setResultStatUI("results", entries.length)

    items_setResults(entries.map(v => v.ItemId))

    clearItems()
    if (entries.length === 0) {
        setError("No results")
        return
    }

    renderSidebar(getFilteredResultsUI(), false)
}

/**
 * Similar to aio_delete, but asks the user first
 * @param {InfoEntry} item - the item to delete
 */
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

/**
 * Based on an id, and location provider, find the location of that item
 * @param {bigint} id - the item to find the location of
 * @param {string} [provider] - the provider to use
 */
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

function updateLibraryDropdown() {
    librarySelector.innerHTML = '<option value="0">Library</option>'
    const libraries = items_getLibraries()
    for (let i in libraries) {
        let item = libraries[i]
        const opt = document.createElement("option")
        opt.value = String(item["ItemId"])
        opt.innerText = item["En_Title"]
        librarySelector.append(opt)
    }
    newEntryLibrarySelector.innerHTML = librarySelector.innerHTML
}

/**
 * pulls out relevant filters for the client
 * has the side effect of modifying search-query, removing any parts deemed filters for the client
 * eg: \[start:end\]
 */
function parseClientsideSearchFiltering(searchForm: FormData): ClientSearchFilters {
    // let start = 0
    // let end = -1

    let search = searchForm.get("search-query") as string
    let inBracket = 0
    let filterStartPos = -1
    for (let i = 0; i < search.length; i++) {
        if (search[i] === "{") inBracket++
        else if (search[i] === "}") inBracket--
        if (i > 2 && search[i - 1] == "-" && search[i] == ">" && inBracket <= 0) {
            filterStartPos = i - 1
            break
        }
    }
    let filters: string[] = []
    if (filterStartPos > -1) {
        filters = search.slice(filterStartPos).split("->").map(v => v.trim())
        search = search.slice(0, filterStartPos)
    }

    let sortBy = searchForm.get("sort-by") as string

    return {
        filterRules: filters,
        newSearch: search,
        sortBy,
    }
}

function applyClientsideSearchFiltering(entries: InfoEntry[], filters: ClientSearchFilters) {

    entries = entries.filter(v => v.Library === items_getCurrentLibrary())

    if (filters.sortBy.startsWith("-aiow")) {
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
            }
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

/**
 * Creates a new entry based on a form
 * Side effects:
 * - adds the new item to the global entries list
 * - calls ui_search() with <q>En_Title = 'new-item-name'</q>
 * @param {HTMLFormElement} form - the form to use for creating an entry
 */
async function newEntryUI(form: HTMLFormElement) {
    document.getElementById("new-entry")?.hidePopover()
    const data = new FormData(form)

    let artStyle = 0

    const styles = ['is-anime-art', 'is-cartoon', 'is-handrawn', 'is-digital-art', 'is-cgi', 'is-live-action', 'is-2d', 'is-3d']
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

    if (validEntries["requires"] && validEntries["requires"] == "0") {
        delete validEntries["requires"]
    }

    if (validEntries["copyOf"] && validEntries["copyOf"] == "0") {
        delete validEntries["copyOf"]
    }

    let queryString = "?" + Object.entries(validEntries).map(v => `${v[0]}=${encodeURIComponent(String(v[1]))}`).join("&") + `&art-style=${artStyle}`
    //@ts-ignore
    const parentId = form.querySelector("[name=\"parentId\"]").value
    //@ts-ignore
    const copyOfId = form.querySelector("[name=\"copyOf\"]").value
    //@ts-ignore
    const requires = form.querySelector("[name=\"requires\"]").value
    if (parentId !== "0") {
        queryString += `&parentId=${parentId}`
    }
    if (copyOfId !== "0") {
        queryString += `&copyOf=${copyOfId}`
    }
    if (requires !== "0") {
        queryString += `&requires=${requires}`
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

    let res = await authorizedRequest(`${apiPath}/add-entry${queryString}&timezone=${encodeURIComponent(tz)}`)
    let text = await res?.text()
    if (res?.status !== 200 || !text) {
        alert(text)
        return
    }

    let json = api_deserializeJsonl(text).next().value

    api_getEntryAll(json.ItemId, json.Uid).then(async res => {
        if (res === null) {
            console.error("failed to get entry data")
            return
        }
        let { meta, events, user, info } = res

        items_addItem({
            meta,
            user,
            events,
            info
        })

        ui_search(`En_Title = '${quoteEscape(json.En_Title, "'")}'`)
    }).catch((err) => {
        console.error(err)
        alert("Failed to load new item metadata, please reload")
    })
}

const newItemForm = document.getElementById("new-item-form") as HTMLFormElement
if (newItemForm) {
    const title = newItemForm.querySelector('[name="title"]') as HTMLInputElement
    newItemForm.oninput = function() {
        const location = newItemForm.querySelector('[name="location"]') as HTMLInputElement
        if (typeof settings.location_generator === 'string') {
            location.value = settings.location_generator.replaceAll("{}", title.value)
        } else if (typeof settings.location_generator === 'function') {
            const info = new FormData(newItemForm)
            location.value = settings.location_generator(Object.fromEntries(info.entries().toArray()) as any)
        }
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
    const itemsFillDiv = currentDocument().getElementById("put-items-to-select") as HTMLDivElement
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
    const popover = currentDocument().getElementById("items-listing") as HTMLDialogElement
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
 * lets the user select an item, be sure to use fillItemListingUI first
*/
async function selectItemUI(options?: SelectItemOptions): Promise<null | bigint> {
    const popover = currentDocument().getElementById("items-listing") as HTMLDialogElement

    let f = currentDocument().getElementById("items-listing-search") as HTMLFormElement
    let query = f.querySelector('[name="items-listing-search"]') as HTMLInputElement

    let { container, onsearch } = options || {}

    if (!onsearch) {
        onsearch = fillItemListingWithSearch
    }

    if (!container) {
        let cpy = { ...items_getAllEntries() }
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
    })
}

async function signinUI(reason: string): Promise<string> {
    const loginPopover = currentDocument().getElementById("login") as HTMLDialogElement
    if(!loginPopover) {
        throw new Error("Could not create login screen")
    }

    const loginReasonEl = loginPopover.querySelector("#login-reason")
    if(loginReasonEl instanceof HTMLElement) {
        loginReasonEl.innerText = reason
    }

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

            api_username2UID(username!.toString()).then(uid => {
                if (uid < 1) return
                storeUserUID(String(uid))
            })

            const b64 = btoa(`${username}:${password}`)
            setUserAuth(b64)
            res(b64)
        }
    })
}

async function fillFormatSelectionUI(formatSelector: HTMLSelectElement | null = null) {
    formatSelector ||= currentDocument().querySelector('[name="format"]') as HTMLSelectElement

    if (formatSelector === null) {
        console.error("format dropdown could not be found")
        return
    }

    const groups = {
        "DIGITAL": "Misc",
        "IMAGE": "Misc",
        "UNOWNED": "Misc",
        "OTHER": "Misc",
        "CD": "Optical",
        "DVD": "Optical",
        "BLURAY": "Optical",
        "4KBLURAY": "Optical",
        "STEAM": "Game",
        "NIN_SWITCH": "Game",
        "XBOXONE": "Game",
        "XBOX360": "Game",
        "BOARDGAME": "Game",
        "MANGA": "Book",
        "BOOK": "Book",
        "VINYL": "Analog",
        "VHS": "Analog",
    }

    const optGroups: Record<string, HTMLOptGroupElement> = {}
    for (const group of Object.values(groups)) {
        const g = document.createElement("optgroup")
        optGroups[group] = g
        g.label = group
    }

    const formats = await api_listFormats()
    for (let fNo in formats) {
        let name = formats[fNo]
        if (name === "MOD_DIGITAL") continue

        let g = optGroups[groups[name as keyof typeof groups] as keyof typeof optGroups]

        let opt = document.createElement("option")
        opt.value = fNo
        opt.innerText = formats[fNo]
        g.appendChild(opt)
    }

    formatSelector.replaceChildren(...Object.values(optGroups))
}

async function fillRecommendedListUI(list: HTMLDataListElement | null = null, uid: number) {
    list ||= currentDocument().querySelector("datalist#recommended-by")
    if(!list) {
        console.error("Could not find a recommended-by list to fill")
        return
    }

    const recommenders = await api_list_recommenders(uid)
    for(let r of recommenders) {
        const opt = document.createElement("option")
        opt.value = r
        list.appendChild(opt)
    }
}

async function fillTypeSelectionUI(typeDropdown: HTMLSelectElement | null = null) {
    typeDropdown ||= currentDocument().querySelector("#new-item-form [name=\"type\"]")

    if (typeDropdown === null) {
        console.error("type dropdown could not be found")
        return
    }

    const groups = {
        "Show": "TV",
        "Movie": "TV",
        "MovieShort": "TV",
        "Documentary": "TV",
        "Episode": "TV",
        "Video": "General",
        "Meme": "General",
        "Picture": "General",
        "Song": "Music",
        "Albumn": "Music",
        "Soundtrack": "Music",
        "Book": "Reading",
        "Manga": "Reading",
        "ShortStory": "Reading",
        "Game": "Activity",
        "BoardGame": "Activity",
        "Collection": "Meta",
        "Library": "Meta"
    }

    const optGroups: Record<string, HTMLOptGroupElement> = {}
    for (const group of Object.values(groups)) {
        const g = document.createElement("optgroup")
        optGroups[group] = g
        g.label = group
    }

    for (let type of await api_listTypes()) {
        let g = optGroups[groups[type as keyof typeof groups] as keyof typeof optGroups]
        const option = document.createElement("option")
        option.value = type
        option.innerText = type
        g.append(option)
    }
    typeDropdown.replaceChildren(...Object.values(optGroups))
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

/**
 * @description keeps track of the window being used to display the information selected by view-toggle
 */
let catalogWin: Window | null = null

function isCatalogModeUI() {
    return catalogWin !== null
}

function openCatalogModeUI() {
    let mainUI = document.getElementById("main-ui")
    if (!mainUI || mainUI.classList.contains("catalog-mode")) return

    let urlParams = new URLSearchParams(location.search)
    urlParams.set("display", "true")
    urlParams.set("no-select", "true")
    urlParams.set("no-startup", "true")
    const newURL = `${location.origin}${location.pathname}?${urlParams.toString()}${location.hash}`
    catalogWin = open(newURL, "_blank", "popup=true")
    if (catalogWin) {
        catalogWin.addEventListener("beforeunload", (e) => {
            closeCatalogModeUI()
        })
        const thisMode = mode_getFirstModeInWindow(window)
        if (thisMode) {
            mode_chwin(catalogWin as Window & typeof globalThis, thisMode)
        }
        mainUI.classList.add("catalog-mode")
        toggleUI("viewing-area", "none")
    }
}

function closeCatalogModeUI() {
    if (!catalogWin) {
        console.warn("Catalog window is not open")
        return
    }
    const thisMode = mode_getFirstModeInWindow(catalogWin)
    if (thisMode) {
        mode_chwin(window, thisMode)
    }
    let mainUI = document.getElementById("main-ui")
    if (!mainUI) {
        console.warn("could not find main ui")
        return
    }
    mainUI.classList.remove("catalog-mode")
    toggleUI("viewing-area", "")
    catalogWin = null
}

function updatePageInfoWithItemUI(item: InfoEntry) {
    document.title = `[AIO] | ${item.En_Title || item.Native_Title}`
    ua_setfavicon(fixThumbnailURL(findMetadataById(item.ItemId).Thumbnail))
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

function formatToSymbolUI(format: number) {
    const custom = settings_get("custom_item_formats")
    let out = ""
    if (items_isDigitized(format)) {
        format -= DIGI_MOD
        out = "+d"
    }
    if (format in custom) {
        return custom[format] + out
    }
    return items_formatToSymbol(format) + out
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
