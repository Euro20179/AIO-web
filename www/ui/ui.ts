/**
    * @module ui
* @requires items.ts
* @requires modes.ts
* @requires js_api.ts
* @requires api.ts
* @description
* This file is for functions that should be called by the ui to handle api operations
    * with client-side inputs
*/

type ClientSearchFilters = {
    filterRules: string[];
    newSearch: string;
    sortBy: string;

    searchType: "4" | "3" | `metadata:${string}`

    [key: string]: any
};


type StartupUIComponents = {
    newWindow: HTMLElement,
    viewToggle: HTMLSelectElement,
    viewAllElem: HTMLInputElement,
    statsOutput: HTMLElement,
    searchBox: HTMLInputElement,
    itemFilter: HTMLInputElement,
    newEntryLibrarySelector: HTMLInputElement,
    librarySelector: HTMLButtonElement,
    userSelector: HTMLSelectElement,
    sortBySelector: HTMLSelectElement,
    errorOut: HTMLElement,
    searchForm: HTMLFormElement,
    recommenders: HTMLDataListElement,
    newItemForm: HTMLFormElement,
    sidebarItems: HTMLElement,
    scriptSelect: HTMLDialogElement,

    mainUI: HTMLElement

    sidebarUI: SidebarMode
}


let statistics: Statistic[] = []

const components: {
    [k in keyof StartupUIComponents]?: StartupUIComponents[k] | null
} = {}

/**
    * should be called when the ui starts up.
    * sets up the mapping of components to use throughout the ui
* @param {Partial<Record<string, HTMLElement>>} components
*/
function startupUI({
    newWindow,
    viewToggle,
    viewAllElem,
    librarySelector,
    userSelector,
    searchBox: _searchBox,
    sortBySelector,
    statsOutput,
    newItemForm,
    sidebarItems,
}: typeof components) {

    addEventListener("modes.update-item", () => {
        dom_createdatalist("tags-dl", new Set(Object.values(items_getAllEntries()).values()
            .flatMap(i => i.info.Tags || []).toArray()).values().toArray())
    })

    for (let key in arguments[0]) {
        components[key as keyof StartupUIComponents] = arguments[0][key]
    }

    if (components['itemFilter'] && !(components["itemFilter"] instanceof HTMLInputElement)) {
        throw new Error("item filter must be an <input>")
    }

    if (!(components["viewToggle"] instanceof HTMLSelectElement)) {
        throw new Error("view toggle must be a <select>")
    }

    if (!(components["newEntryLibrarySelector"] instanceof HTMLInputElement)) {
        throw new Error("new entry's library selector must be a button element")
    }

    if (!(components["librarySelector"] instanceof HTMLButtonElement)) {
        throw new Error("library selector must be a button element")
    }

    // if (!(components["userSelector"] instanceof HTMLSelectElement)) {
    //     throw new Error("user uid selector must be a select element")
    // }

    if (!(components["sortBySelector"] instanceof HTMLSelectElement)) {
        throw new Error("sort by selector must be a select element")
    }

    if (!(sidebarItems)) {
        throw new Error("ui cannot function without a sidebar")
    }

    components['sidebarUI'] = new SidebarMode(sidebarItems)
    mode_add(components['sidebarUI'] as SidebarMode, {
        attachment: 'sticky',
        closable: false,
        listed: false
    })


    if (statsOutput) {
        statistics.push(new Statistic("results", false, () => getFilteredResultsUI().length))
        statistics.push(new Statistic("totalCost", true, (item, mult) => items_getEntry(item.ItemId).getLastPurchasePrice() * mult))

        statistics[0].resetable = false
    }

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
        mode_setMode((e.target as HTMLSelectElement).value, currentWindow())
    })

    librarySelector?.addEventListener("click", function() {
        fillItemListingWithSearch(`3 Type = 'Library'`).then(container => {
            const btn = document.createElement("button")
            btn.value = "-1"
            btn.innerText = "NO LIBRARY"
            container.querySelector("button")?.insertAdjacentElement('afterend', btn)
            return selectItemUI({ container })
        }).then(v => {
            if (!v) {
                alert("No library selected")
                return
            }

            librarySelector.innerText = v > 0
                ? items_getEntry(v).info.En_Title
                : "Library"

            items_setCurrentLibrary(v < 0n ? 0n : v)

            loadSearchUI()
        })
    })

    userSelector?.addEventListener("change", function() {
        refreshInfoUI(getUidUI()).then(() => loadSearchUI())
        if (components.recommenders)
            fillRecommendedListUI(components.recommenders, getUidUI())
    })

    sortBySelector?.addEventListener("change", function() {
        sortEntriesUI()
    })

    if (newItemForm) {
        const title = dom_getelorthrow('[name="title"]', HTMLInputElement, newItemForm)
        newItemForm.oninput = function(e) {
            if (e.target instanceof currentWindow().HTMLInputElement
                && e.target.getAttribute("name") === "location")
                return

            const location = dom_getelorthrow('[name="location"]', HTMLInputElement, newItemForm)
            if (typeof defaultSettings.location_generator === 'string') {
                location.value = defaultSettings.location_generator.replaceAll("{}", title.value)
            } else if (typeof defaultSettings.location_generator === 'function') {
                const info = new FormData(newItemForm)
                location.value = defaultSettings.location_generator(Object.fromEntries(info.entries().toArray()) as any)
            }
        }
    }

    components['itemFilter']?.addEventListener("input", function() {
        const filtered = getFilteredResultsUI()
        const ids = filtered.map(v => v.ItemId)
        //remove items that dont match
        for (let sidebarE of sidebarItems.querySelectorAll("sidebar-entry")) {
            const id = sidebarE.getAttribute("data-entry-id") as string
            if (!ids.includes(BigInt(id))) {
                sidebarE.remove()
            }
        }

        if (components['sidebarUI'])
            //add items that DO match            reapply sort
            renderSidebarItemList.call(components['sidebarUI'], filtered, components['sidebarUI']?.output || document.createDocumentFragment()).then(sortEntriesUI)
    })

    if (viewAllElem instanceof HTMLInputElement)
        viewAllElem.addEventListener("change", _ => {
            resetStatsUI()
            if (!viewAllElem.checked) {
                clearUI(false)
            } else {
                clearUI()
                for (let mode of mode_listOpen()) {
                    selectListUI(getFilteredResultsUI(), true, mode)
                }
            }
        })

    if (newWindow) {
        const openWindow = (modeName: string) => {
            let urlParams = new URLSearchParams(location.search)
            urlParams.set("display", "true")
            urlParams.set("no-select", "true")
            urlParams.set("no-startup", "true")
            urlParams.set("no-mode", "true")
            const newURL = `${location.origin}${location.pathname}?${urlParams.toString()}${location.hash}`
            const win = open(newURL, "_blank", "popup=true")
            if (!win) return
            win.onload = () => {
                mode_setMode(modeName, win as Window & typeof globalThis)
            }
        }

        newWindow.addEventListener("click", () => {
            const mode = mode_getFirstModeInWindow(currentWindow())
            if (!mode) return
            const name = mode_cls2name(mode.constructor as any)
            if (name)
                openWindow(name)
            else {
                throw new Error(`Unable to determine current mode name from mode class: ${mode.constructor.name}`)
            }
        })

        if (viewToggle) {
            newWindow.addEventListener("contextmenu", function(e) {
                e.preventDefault()

                const list = document.createElement("datalist")
                list.id = "mode-list"
                const modes = viewToggle.querySelectorAll(":where(option, optgroup)")
                    .values()
                    .map(v => v.cloneNode(true))
                list.append(...modes)
                document.body.append(list)

                promptUI(
                    "Choose a mode to open in a new window",
                    undefined,
                    list.id
                ).then(choice => {
                    if (choice && mode_map().has(choice)) {
                        openWindow(choice)
                    }
                    list.remove()
                })
            })
        }
    }
}

function generateTransactionElementsUI(itemid: bigint) {
    let children = []
    for (let transaction of items_getEntry(itemid).transactions) {
        let cur = document.createElement("article")
        children.push(cur)

        let event
        if (transaction.EventId) {
            event = items_getEntry(itemid).getEvent(transaction.EventId)
        }

        let title = document.createElement("h2")
        title.classList.add(transaction.Price > 0 ? "bad" : "good")

        let displayEvent =
            event ?
                event.Event
                : transaction.Price > 0 ?
                    "Purchased"
                    : "Sold"

        title.append(displayEvent)

        cur.append(title)

        let displayPrice = transaction.Price
        // only absolute value if the user knows (for sure)
        // that this is a sale event
        if (displayEvent.toLowerCase() === "sold") {
            displayPrice = Math.abs(displayPrice)
        }

        const infoP = document.createElement("p")
        infoP.append(`for ${displayPrice} ${transaction.Currency}`)

        const timeP = document.createElement("p")
        timeP.innerHTML = event ? items_eventTSHTML(event) : "unknown time"


        const btnContainer = document.createElement("div")
        btnContainer.classList.add("flex")
        const editBtn = document.createElement("button")
        editBtn.title = "edit transaction"
        editBtn.append("✏︎")
        editBtn.onclick = () => {
            openTransactionEditorUI(transaction)
            currentWindow().addEventListener("modes.update-item", e => {
                //@ts-ignore
                const trans = items_getEntry(BigInt(e.detail)).getTransactionById(transaction.TransactionId)
                if (trans)
                    infoP.innerText = `for ${displayEvent.toLowerCase() === "sold" ? Math.abs(trans.Price) : trans.Price} ${trans.Currency}`
            }, { once: true })
        }
        const delBtn = document.createElement("button")
        delBtn.title = "delete transaction"
        delBtn.classList.add("delete")
        delBtn.onclick = () => {
            deleteTransactionUI(transaction.TransactionId).then(res => res && cur.remove())
        }
        delBtn.append("🗑")

        btnContainer.append(editBtn, delBtn)

        cur.append(infoP, timeP, btnContainer)
    }

    return children
}

/**
    * Opens the transaction editor for a transaction
* @param {TransactionEntry} transaction the transaction to edit
* @returns {HTMLDialogElement | null}
*/
function openTransactionEditorUI(transaction: TransactionEntry): HTMLDialogElement | null {
    const modal = openModalUI("edit-transaction-dialog", undefined, "edit-transaction")

    const id = dom_getel("input[name='id']", currentWindow().HTMLInputElement, modal)
    if (id) {
        id.value = String(transaction.TransactionId)
    }

    const iid = dom_getel("input[name='itemId']", currentWindow().HTMLInputElement, modal)
    if (iid) {
        iid.value = String(transaction.ItemId)
    }

    const p = dom_getel("input[name='price']", currentWindow().HTMLInputElement, modal)
    if (p) {
        p.value = String(transaction.Price)
    }

    const c = dom_getel("input[name='currency']", currentWindow().HTMLInputElement, modal)
    if (c) {
        c.value = transaction.Currency
    }

    return modal
}

async function editTransactionUI(form: HTMLFormElement) {
    const data = new FormData(form)
    console.log(data)

    const res = await api_editTransaction(Number(data.get("id")) as number, Object.fromEntries(data.entries()), getUserUID())

    if (data.has("itemId")) {
        const itemId = BigInt(String(data.get("itemId")))
        const ts = items_getEntry(itemId).transactions
        for (let t of ts) {
            if (t.TransactionId === Number(data.get("id"))) {
                t.Price = Number(data.get("price"))
                t.Currency = String(data.get("currency"))
                break
            }
        }
        updateInfo2({
            [String(itemId)]: {
                transactions: ts
            }
        })
    }

    if (res?.status !== 200) {
        alert("Failed to edit transaction")
        return
    }
}

function openEventEditorUI(itemId: bigint, eventId: number) {
    const dialog = openEventFormUI(String(itemId), String(eventId))

    if(!dialog) {
        alert("Failed to open the event editor")
        return
    }

    const submitBtn = dom_getel("[type='submit']", null, dialog)
    if (submitBtn) {
        submitBtn.innerHTML = "💾"
    }

    const event = items_getEntry(itemId).getEvent(eventId)
    if (!event) {
        alert(`Could not find event: ${eventId}`)
        return
    }

    let name = dom_getel("[name='name']", currentWindow().HTMLInputElement, dialog)
    if (name && event.Event) {
        name.value = event.Event
    }

    let after = dom_getel("[name='after']", currentWindow().HTMLInputElement, dialog)
    if (after && event.After) {
        after.value = new Date(event.After).toISOString().slice(0, 16)
    }

    let before = dom_getel("[name='before']", currentWindow().HTMLInputElement, dialog)
    if (before && event.Before) {
        before.value = new Date(event.Before).toISOString().slice(0, 16)
    }

    let ts = dom_getel("[name='timestamp']", currentWindow().HTMLInputElement, dialog)
    if (ts && event.Timestamp) {
        ts.value = new Date(event.Timestamp).toISOString().slice(0, 16)
    }

    let tz = dom_getel("[name='timezone']", currentWindow().HTMLInputElement, dialog)
    if (tz && event.TimeZone) {
        tz.value = String(event.TimeZone)
    }
}

/**
    * Deletes a transaction by id
* @param {number} transactionId the transaction to delete
*/
async function deleteTransactionUI(transactionId: number) {
    try {
        var user = await confirmUI("Are you sure you want to delete this transaction?")
    } catch (err) {
        return false
    }
    if (!(user)) {
        return false;
    }

    const res = await api_deleteTransaction(transactionId, getUidUI())
    if (res && res?.status !== 200) {
        const text = await res.text()
        alert(text)
        return false
    } else if (res) {
        alert(`Deleted transaction`)
        return true
    } else {
        alert("Failed to delete transaction")
        return false
    }
}

/**
    * Creates an element that the user can click to
* open that element in the current mode
*/
function createClickableEntryUI(id: bigint, openfn?: Function): HTMLElement {
    if (!openfn) openfn = () => {
        openDisplayWinUI(id)
    }

    const btn = document.createElement("button")
    const entry = items_getEntry(id)
    const t = entry.fixedThumbnail

    const alt = entry.info.En_Title || entry.info.Native_Title

    if (t) {
        const img = document.createElement("img")
        img.src = t
        img.alt = alt
        btn.append(img)
        btn.classList.add("styleless-button")
    } else {
        btn.append(alt)
    }

    btn.addEventListener("click", () => openfn())

    return btn
}

/**
    * Sets the error text
* @param {string} text
*/
function setError(text: string) {
    if (text == "") {
        components.errorOut?.removeAttribute("data-error")
    } else {
        components.errorOut?.setAttribute("data-error", text)
    }
}

/**
    * sets the error text, then sets it back IF it was not set by another caller
* @param {string} initial - the error to set to before the task starts
* @param {string} onend - the error to set to after the task ends
* @returns {Function} - the caller shall call this function when whatever they are doing has finished in order to set the error back
*/
function setErrorWhileUI(initial: string, onend: string): Function {
    setError(initial)
    return () => {
        if (components.errorOut?.getAttribute("data-error") === initial) {
            setError(onend)
        }
    }
}

/**
    * Reloads events for an item, updates that item
*/
async function reloadEventsUI(itemId: bigint) {
    loadUserEvents(getUidUI())
        .then(() => {
            updateInfo2({
                [String(itemId)]: items_getAllEntries()[String(itemId)]
            })
        })
}

/**
    * calls: loadLibraries(), loadInfoEntries(), loadUserEvents(), items_refreshMetadata(), loadTransactions()
* only returns the result of [loadUserEvents, items_refreshMetadata]
* side effects:
    * - causes items' state to be set
* - fills the library dropdown
* - sets the error to "Loading items", then ""
* - updates all loaded entries
* @returns {Promise<[Awaited<ReturnType<typeof loadUserEvents>>, Awaited<ReturnType<typeof items_refreshMetadata>>, Awaited<ReturnType<typeof loadTransactions>>]>}
*/
async function refreshInfoUI(uid: number): Promise<[
    Awaited<ReturnType<typeof loadUserEvents>>,
    Awaited<ReturnType<typeof items_refreshMetadata>>,
    Awaited<ReturnType<typeof loadTransactions>>
]> {
    await Promise.all([
        loadLibraries(uid),
        loadInfoEntries(uid),
    ])
    return Promise.all([
        loadUserEvents(uid),
        items_refreshMetadata(uid),
        loadTransactions(uid),
    ])
}

/**
    * Loads all libraries
* side effects:
    * - update item state
* - update library dropdown menu
*
    * @param {number} uid - the user to load libraries from (cannot be 0)
* @returns {Promise<void>}
*/
async function loadLibraries(uid: number): Promise<void> {
    await items_loadLibraries(uid)
}

/**
    * loads info, and user entries
* side effects:
    * - update item state
* - sets error to a loading state while loading, and "" when done
    */
async function loadInfoEntries(uid: number) {
    setError("Loading items")

    await items_refreshInfoEntries(uid)

    const reset = setErrorWhileUI("Loading user info", "")

    items_refreshUserEntries(uid).then(() => {
        reset()
        updateInfo2(items_getAllEntries())
    })

    return items_getAllEntries()
}

/**
    * opens the settings page for {user} or the current user id
*
    * @param {number | null} uid the user id to open settings for
*/
function openSettingsUI(uid: number | null = null) {
    open(`/settings.html?uid=${uid || getUidUI()}`, '_blank')
}

/**
    * Adds a new sorting option
* Side effects:
    * - adds the new option to the sort-by element
* @param {string} category - The category to put the sort option in to
* @param {string} name - Name of the sorting option
* @param {function(InfoEntry,InfoEntry): number} cb - Sorting function
*/
function addSortUI(category: string, name: string, cb: ((a: InfoEntry, b: InfoEntry) => number)) {
    const internalSortName = items_addSort(name, cb)
    let group = components.sortBySelector?.querySelector(`optgroup[label="${category}"]`)
    if (!group) {
        group = document.createElement("optgroup")
        group.setAttribute("label", category)
        components.sortBySelector?.appendChild(group)
    }

    const opt = document.createElement("option")
    opt.value = internalSortName
    opt.innerText = name
    group.append(opt)
}

/**
    * gets the current document (either catalog, or main document)
* @returns {HTMLDocument}
*/
function currentDocument(): HTMLDocument {
    return modeWin.document
}

/**
    * gets the current window (either catalog, or main window)
* @returns {Window & typeof globalThis}
*/
function currentWindow(): Window & typeof globalThis {
    return modeWin as Window & typeof globalThis
}

/**
    * Turns on/off an element
* @param {string} id the id of the element to toggle
* @param {'' | "none"} on more accurately the display to set for the element
    */
function toggleUI(id: string, on?: '' | "none") {
    const elem = document.getElementById(id) as HTMLElement | null
    if (!elem) return
    elem.style.display = on ?? (
        elem.style.display
            ? ''
            : "none")
}

/**
    * Gets a css property value from the main document
* @param {string} name
* @param {string} fallback incase the property name doesn't exist
*/
function getCSSProp(name: string, fallback: string) {
    const s = getComputedStyle(document.documentElement)
    return s.getPropertyValue(name) || fallback
}

/**
    * Uses the library filter, <s>and item filter</s> (deprecated)
* to filter a list of entries
* @param {items_Entry[] | null} [list=null] - the list of entries to filter, if not given, use the search results list
    * @returns {InfoEntry[]}
*/
function getFilteredResultsUI(list: items_Entry[] | null = null): InfoEntry[] {
    let items = list || items_getResults()

    const ls = components.librarySelector
    if (ls) {
        items = items.filter(v => v.info.Library === items_getCurrentLibrary())
    }

    if (!components.itemFilter) {
        return items.map(v => v.info)
    }


    let newArr = []
    const search = components.itemFilter.value.toLowerCase()

    if (search == "") {
        return items.map(v => v.info)
    }

    for (let item of items) {
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

    values: number[]

    #value: number = 0
    el: HTMLElement
    constructor(name: string, additive: boolean, calculation: StatCalculator) {
        this.name = name
        this.additive = additive
        this.calculation = calculation
        this.el = document.createElement("entries-statistic")
        this.el.setAttribute("data-stat-name", this.name)
        components.statsOutput?.append(this.el)

        this.values = []
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
        this.values = [value]
    }
    add(value: number) {
        this.values.push(value)
        if (Math.sumPresice) {
            this.value = Math.sumPrecise(this.values)
        } else {
            this.value += value
        }
    }
    changeWithItem(item: InfoEntry, mult: number) {
        let value = this.calculation(item, mult)
        if (!this.additive) {
            this.value = value
        } else {
            this.values.push(value)
            if (Math.sumPrecise)
                this.value = Math.sumPrecise(this.values)
            else this.value += value
        }
    }
    changeWithItemList(items: InfoEntry[], mult: number) {
        if (!this.additive) {
            this.value = this.calculation(items[0] || genericInfo(0n, getUidUI()), mult)
        } else {
            this.values = this.values.concat(items.map(v => this.calculation(v, mult)))
            if (Math.sumPrecise) {
                this.value = Math.sumPrecise(this.values)
            } else {
                for (let item of items) {
                    this.value += this.calculation(item, mult)
                }
            }
        }
    }
}

/**
    * Registers a shortcut that when ctrl+key is pressed, run will be called
* @param {string} key the key to add a ctrl+key shortcut for
    * @param {(event: Event) => any} run what to run when {key} is pressed
*/
function registerCTRLShortcutUI(key: string | string[], run: (event: Event) => any) {
    if (Array.isArray(key)) {
        for (let k of key) {
            registerCTRLShortcutUI(k, run)
        }
    } else {
        //@ts-ignore
        if (window.shortcuts) {
            window.shortcuts.nnoremap(key, true, false, /^[A-Z]$/.test(key), run)
        }
    }
}

registerCTRLShortcutUI("\\", (e) => {
    const search = components.searchBox
    if (!search) {
        throw new Error("no searchbox component")
    }

    search.focus()

    //3 indicates a query-v3 search
    //if the user is pressing ctrl-\ they want to do a query-v3 search
    if (!search.value.startsWith("3")) {
        //since it does not start with a 3, add one
        search.value = '3 '
    }
    //select everything after '3 '
    search.setSelectionRange(2, Math.max(search.value.length, 2))

    e.preventDefault()
})

registerCTRLShortcutUI("/", e => {
    const search = components.searchBox
    search?.focus()
    search?.select()
    e.preventDefault()
})

registerCTRLShortcutUI("?", e => {
    components.itemFilter?.focus()
    components.itemFilter?.select()
    e.preventDefault()
})

registerCTRLShortcutUI("A", e => {
    components.viewAllElem && components.viewAllElem.click()
    e.preventDefault()
})

registerCTRLShortcutUI("m", e => {
    e.preventDefault()
    components.viewToggle?.focus()
})

registerCTRLShortcutUI(["p", "P"], e => {
    openModalUI("script-select")
    e.preventDefault()
})

registerCTRLShortcutUI("N", e => {
    openModalUI("new-entry")
    e.preventDefault()
})

registerCTRLShortcutUI("S", e => {
    toggleUI("search-area")
    e.preventDefault()
})

registerCTRLShortcutUI("B", e => {
    toggleUI("sidebar")
    e.preventDefault()
})

registerCTRLShortcutUI("V", e => {
    //we dont want dual-window mode to be toggleable if we are in display mode
    if (components.mainUI?.classList.contains("display-mode")) {
        return
    }
    if (isCatalogModeUI()) {
        closeCatalogModeUI()
    } else {
        openCatalogModeUI()
    }
    e.preventDefault()
})

registerCTRLShortcutUI("D", e => {
    setDisplayModeUI()
    e.preventDefault()
})

for (let i = 0; i < 10; i++) {
    registerCTRLShortcutUI(String(i), e => {
        let event = e as KeyboardEvent
        clearUI()
        components['sidebarUI']?.selectNth(Number(event.key))
        e.preventDefault()
    })
}

if (window.shortcuts) {
    let curkey = window.shortcuts
    addEventListener("keydown", e => {
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (e.shiftKey || e.ctrlKey)) {
            if (!document.activeElement || document.activeElement.tagName !== "SIDEBAR-ENTRY") {
                components['sidebarUI']?.focusNthItem(e.key === "ArrowUp" ? (components['sidebarItems']?.childElementCount || 1) : 1)
            } else components['sidebarUI']?.focusNextItem(e.key === "ArrowUp")
            if (e.ctrlKey) {
                if (!e.shiftKey) clearUI()
                selectFocusedSidebarItem()
            }
            e.preventDefault()
            return
        }

        const next = curkey?.press(e, e.key, e.ctrlKey, e.altKey, e.shiftKey)
        if (next instanceof shortcuts_Trie) {
            e.preventDefault()
            curkey = next
        } else {
            curkey = window.shortcuts
        }
    })
}

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
    const scriptSelect = components.scriptSelect
    if(!scriptSelect) {
        alert("No script selector on this page")
    }

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
    scriptSelect?.append(par)
    userScripts.set(name, new UserScript(onrun, desc))
}

/**
    * Picks the first script from the dialog and runs it
*/
function runFirstUserScriptUI() {
    const scriptName = dom_getelorthrow("#script-select div:not([hidden]) h3", HTMLElement)
    runUserScriptUI(scriptName.textContent)
}

/**
    * Filters the users scripts in the user scripts dialog.
    * Checks if {filter} is included in that script's text somewhere
* @param {string} filter
*/
function filterUserScriptsUI(filter: string) {
    const scriptSelect = dom_getelorthrow("#script-select", HTMLElement)
    const divs = scriptSelect.querySelectorAll("div")
    for (let el of divs) {
        el.hidden = false
    }

    if (!filter) return

    for (let el of divs) {
        if (!el.textContent.includes(filter)) {
            el.hidden = true
        }
    }
}

/**
    * Shows a prompt dialog to the user
* @param {string} html - The prompt message to display
* @param {string} [_default] - Optional default value for the prompt
    * @returns {Promise<string | null>} the user's response
*/
async function promptUI(html?: string, _default?: string, uselist?: string, defaultValue: string = ""): Promise<string | null> {
    let pElRoot = currentDocument().createElement("prompt-dialog").shadowRoot
    if (!pElRoot) {
        const parser = new DOMParser
        const doc = parser.parseFromString(html || "", "text/html")
        html = doc.documentElement.outerText
        return prompt(html, _default) || defaultValue
    }

    currentDocument().body.append(pElRoot.host)

    let pEl = dom_getelorthrow("dialog", currentWindow().HTMLDialogElement, pElRoot)

    const close = pEl.querySelector("button:first-child") as HTMLButtonElement
    const root = pEl.querySelector("[root]") as HTMLDivElement
    const submission = pEl.querySelector('[name="prompt-value"]') as HTMLInputElement
    submission.value = defaultValue

    if (uselist)
        submission.setAttribute("list", uselist)
    else
        submission.removeAttribute("list")

    root.innerHTML = html || "<p>prompt</p>"
    pEl.returnValue = ''
    pEl.showModal()
    return await new Promise((res) => {
        pEl.onclose = () => {
            pElRoot.host.remove()
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
    * Shows a confirmation dialogue
* If the user clicks ok, resolve with true
    * otherwise reject with true
* @param html {string} the html to put in the confirmation box
*/
async function confirmUI(html: string) {
    const cEl = dom_getelorthrow("#confirm", currentWindow().HTMLDialogElement)
    const close = cEl.querySelector("button:first-child") as HTMLButtonElement
    const cancel = dom_getelorthrow("#cancel", currentWindow().HTMLButtonElement, cEl)
    const ok = dom_getelorthrow("#ok", currentWindow().HTMLButtonElement, cEl)
    const root = dom_getelorthrow("[root]", currentWindow().HTMLElement, cEl)
    root.innerHTML = html || "<p>CONFIRM</p>"

    cEl.showModal()
    return await new Promise((res, rej) => {
        ok.focus()

        cEl.onclose = () => {
            (cEl.returnValue ? res : rej)(true)
        }
        close.onclick = () => cEl.close("");
        cancel.onclick = () => {
            cEl.close("")
        }
        ok.onclick = () => cEl.close("true")
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
* @param {{querySelector(query: string): HTMLElement | null}} [root] - the elemnt which is the parent of the modal to find
*/
function openModalUI(
    modalName: string,
    root?: {
        querySelector(query: string): HTMLElement | null
    },
    pullFromShadowRootTemplate?: string
): HTMLDialogElement | null {
    let modal
    if(pullFromShadowRootTemplate) {
        const root = currentDocument().createElement(pullFromShadowRootTemplate).shadowRoot
        if(!root) {
            throw new Error(`Template: ${pullFromShadowRootTemplate} does not have a shadowroot`)
        }
        currentDocument().body.append(root.host)
        modal = dom_getel(`#${modalName}`, currentWindow().HTMLDialogElement, root)
        modal?.addEventListener("close", () => root.host.remove())
    }
    else modal = dom_getel(`#${modalName}`, currentWindow().HTMLDialogElement, root)
    modal?.showModal()
    return modal
}

/**
    * Closes a modal by id
* @param {string} modalName - the id of the modal to close
* @param root - the elemnt which is the parent of the modal to find
*/
function closeModalUI(
    modalName: string,
    root?: {
        querySelector(query: string): HTMLElement | null
    },
    returnValue?: string
) {
    dom_getel(`#${modalName}`, HTMLDialogElement, root)?.close(returnValue)
}

/**
    * Toggles a modal's open status by id
* @param {string} modalName - the id of the modal to toggle
* @param root - the elemnt which is the parent of the modal to find
*/
function toggleModalUI(
    modalName: string,
    root?: {
        querySelector(query: string): HTMLElement | null
    }
) {
    let dialog = dom_getel(`#${modalName}`, HTMLDialogElement, root)
    if (!dialog) return

    dialog.open
        ? dialog.close()
        : dialog.showModal()
}

/**
    * Creates a new statistic in the UI
* Side effects:
    * - puts a statistic in the statistics area
* @param {string} name - Name of the statistic
* @param {boolean} additive - Whether the stat is additive
* @param {StatCalculator} calculation - The calculation function for the stat
    */
function createStatUI(name: string, additive: boolean, calculation: StatCalculator) {
    statistics.push(new Statistic(name, additive, calculation))
    setResultStatUI(name, 0)
}

/**
    * Deletes a statistic
* Side effects:
    * - removes the statistic from the statistics area
* @param {string} name - Name of the statistic to delete
* @returns {boolean}
*/
function deleteStatUI(name: string): boolean {
    statistics = statistics.filter(v => v.name !== name)
    return deleteResultStatUI(name)
}

/**
    * Sets the value of a statistic
* @param {string} key - Name of the statistic
* @param {number} value - Value to set
*/
function setResultStatUI(key: string, value: number) {
    for (let stat of statistics) {
        if (stat.name !== key) continue

        stat.set(value)
        break
    }
}

/**
    * adds value to the stat named key
* @param {string} key
* @param {number} value
*/
function changeResultStatsUI(key: string, value: number) {
    for (let stat of statistics) {
        if (stat.name !== key) continue

        stat.add(value)
        break
    }
}

/**
    * changes all statistics with an item (each stat determines how this works)
* @param {InfoEntry} item
* @param {number} [multiplier=1] - the multiplier, set to -1 to subtract
*/
function changeResultStatsWithItemUI(item: InfoEntry, multiplier: number = 1) {
    if (!item) return
    for (let stat of statistics) {
        stat.changeWithItem(item, multiplier)
    }
}

/**
    * removes a stat from display but NOT the internal list of stats
* @param {string} key - the stat to remove
*/
function deleteResultStatUI(key: string) {
    let el = components.statsOutput?.querySelector(`[data-stat-name="${key}"]`)
    if (el) {
        el.remove()
        return true
    }
    return false
}

/**
    * similar to changeResultStatsWithItem() but uses a list of items
* @param {InfoEntry[]} items
* @param {number} [multiplier=1]
*/
function changeResultStatsWithItemListUI(items: InfoEntry[], multiplier: number = 1) {
    for (let stat of statistics) {
        stat.changeWithItemList(items, multiplier)
    }
}

/**
    * Sorts entries, and reorders the sidebar based on the selected sort in the sort-by selector
*/
function sortEntriesUI() {
    const sortby = components.sortBySelector?.value
    //checks if null or undefined, if it's an empty string that's no-sort
    if (sortby == undefined) {
        throw new Error("Could not get sort by")
    }
    let newEntries = sortEntries(items_getResults().map(v => v.info), sortby)
    let ids = newEntries.map(v => v.ItemId)
    items_setResults(ids)
    clearUI()
    components['sidebarUI']?.reorder(getFilteredResultsUI().map(v => v.ItemId))
}

/**
    * Gets the currently selected uid from the uid selector
* @returns {number}
*/
function getUidUI() {
    if (!components.userSelector) return 0
    return Number(components.userSelector.value)
}

function getSignedInUidUI() {

}

/**
    * Gets the form data from the search form
* @returns {FormData} the data
*/
function getSearchDataUI(): FormData {
    let form = components.searchForm
    if (!form) throw new Error("No search form found")
    let data = new FormData(form)
    return data
}

/**
    * Akin to the user submitting the search form
* form inputs:
    * - search-query: string, the search query (processed on the client, so uses client filters, and '3' prefixing)
* - sort-by: ""
*   | "item-id"
*   | "release-year"
*   | "cost"
*   | "user-title"
*   | "native-title"
*   | "-aiow-numeric-title"
*   | "rating"
*   | "general-rating"
*   | "added"
*   | "finished"
*   | "viewing", the sorting method, applies server and client side
* - uid: number, the user id to query items from
* @param {Record<string, string>} params - values to override
*/
function mkSearchUI(params: Record<string, string>) {
    let form = components.searchForm
    if (!form) throw new Error("No search form found")

    for (let param in params) {
        const inp = form.querySelector(`[name="${param}"]`)
        if (!inp || !("value" in inp)) continue
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
    * - at the end, fires the aio-search-performed event
* @param {HTMLFormElement} [form] the form to pull from (defaults to the form on the page)
*/
async function loadSearchUI(form: HTMLFormElement | null | undefined = components.searchForm) {
    if (!form) throw new Error("No search form found")

    let formData = new FormData(form)

    let filters = parseClientsideSearchFiltering(formData)

    const st = filters["searchType"]
    let entries: InfoEntry[]
    switch (st) {
        case "4":
        case "3": {
            entries = await api_query(
                String(filters.newSearch) || "%",
                Number(formData.get("uid")) || 0,
                Number(st) as 3 | 4,
                filters.sortBy as SortKind
            )
            break
        }
        default: {
            let [_, provider] = st.split(":")
            const res = await api_identify(String(filters.newSearch) || "%", provider)
            if (!res) {
                entries = []
                break
            }
            const text = await res.text()
            entries = []
            for (let meta of api_deserializeJsonl<MetadataEntry>(text.split("\x02").slice(1).join("\x02").trim())) {
                entries.push(items_meta2info(meta))
                items_addItem({
                    events: [],
                    info: entries[entries.length - 1],
                    user: items_meta2user(meta),
                    meta,
                    transactions: []
                })
            }
        }
    }

    entries = applyClientsideSearchFiltering(entries, filters)

    setResultStatUI("results", entries.length)

    const ids = entries.map(v => v.ItemId)
    await items_addById(ids)
    items_setResults(ids)

    clearUI()

    if (entries.length === 0) {
        setError("No results")
        components['sidebarUI']?.clearSelected()
        const g = genericInfo(0n, 0)
        g.En_Title = "No Results"
        renderFakeSidebarItem(g, components['sidebarUI']?.output || document.createDocumentFragment())
    } else components['sidebarUI']?.render(getFilteredResultsUI(), false)

    dispatchEvent(new CustomEvent("aio-search-performed", {
        detail: {
            results: entries
        }
    }))
}

/**
    * Similar to aio_delete, but asks the user first
* @param {InfoEntry} item - the item to delete
*/
function deleteEntryUI(item: InfoEntry) {
    confirmUI("Are you sure you want to delete this item")
        .then(() => {
            aio_delete(item.ItemId).then(res => {
                if (res === 1) {
                    alert("Failed to delete item")
                    return
                }
                alert(`Deleted: ${item.En_Title} (${item.Native_Title ? item.Native_Title + " : " : ""}${item.ItemId})`)
            })
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

/**
    * Overwrites the metadata for an item, by getting new metadata based on heuristics determined by the server
* side effects:
    * - asks the user if they are sure they want to overwrite
* - refreshes selected items
* @param {ShadowRoot} _root - unused
* @param {InfoEntry} item
*/
function overwriteEntryMetadataUI(_root: ShadowRoot, item: InfoEntry) {
    confirmUI("Are you sure you want to overwrite the metadata with a refresh")
        .then(async () => {
            const provider = await promptUI("Provider override (optional)")
            api_overwriteMetadataEntry(item.ItemId, provider || "").then(res => {
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
        })
}

/**
    * updates the librarySelector component's options by getting all libraries
* and creating an option for each one
    */
function updateLibraryDropdown() {
    let library_data = items_getEntry(items_getCurrentLibrary())
    if (components.librarySelector)
        components.librarySelector.innerText = library_data.ItemId == 0n
            ? "Library"
            : library_data.info.En_Title
}


const clientSearchParsers = new Map<string, (search: string, filters: ClientSearchFilters, searchForm: FormData) => string>

/**
    * Creates a new client search parser that gets used to parse the search query before sending it to the api
* @param {string} name - name of the parser (a unique identifier)
* @param {(search: string, filters: ClientSearchFilters) => string} parser - the function that parses the current search string, and is provided the current, already parsed, filters
* @returns {1 | 0} - 0 on success
*/
function addSearchParserUI(name: string, parser: (search: string, filters: ClientSearchFilters, searchForm: FormData) => string): 1 | 0 {
    if (clientSearchParsers.has(name)) {
        return 1
    }
    clientSearchParsers.set(name, parser)
    return 0
}

/**
    * Deletes a search parser
* @param {string} name - name of the parser to delete
* @returns {1 | 0} - 0 on success
*/
function deleteSearchParserUI(name: string): 1 | 0 {
    if (!clientSearchParsers.has(name)) {
        return 1
    }
    clientSearchParsers.delete(name)
    return 0
}

addSearchParserUI("search-type", (search, filters) => {
    if (search.startsWith("3")) {
        filters["searchType"] = '3'
        search = search.slice(1).trimStart()
    } else if (search.startsWith("!s")) {
        if (search.startsWith("!s:")) {
            let identifier = search.split("!s:")[1].split(/\s/)[0]
            filters["searchType"] = `metadata:${identifier}`
            search = search.slice(3 + identifier.length).trimStart()
        } else {
            filters["searchType"] = `metadata:${"omdb"}`
            search = search.slice(2).trimStart()
        }
    } else {
        filters['searchType'] = '4'
    }
    return search
})

addSearchParserUI("filter-parser", (search, filters) => {
    let inBracket = 0
    let filterStartPos = -1
    for (let i = 0; !filters["useV4"] && i < search.length; i++) {
        if (search[i] === "{") inBracket++
        else if (search[i] === "}") inBracket--
        if (i > 2 && search[i - 1] == "-" && search[i] == ">" && inBracket <= 0) {
            filterStartPos = i - 1
            break
        }
    }
    let foundFilts: string[] = []
    if (filterStartPos > -1) {
        foundFilts = search.slice(filterStartPos).split("->").map(v => v.trim())
        search = search.slice(0, filterStartPos)
    }
    filters["filterRules"] = foundFilts
    return search
})

addSearchParserUI("sort-by", (search, filters, form) => {
    filters["sortBy"] = form.get("sort-by") as string
    return search
})

/**
    * pulls out relevant filters for the client
* has the side effect of modifying search-query, removing any parts deemed filters for the client
    * eg: \[start:end\]
* @param {FormData} searchForm form that contains the search-query key-value pair
* @returns {ClientSearchFilters}
*/
function parseClientsideSearchFiltering(searchForm: FormData): ClientSearchFilters {

    let search = searchForm.get("search-query") as string

    const filters: ClientSearchFilters = {
        searchType: '4',
        filterRules: [],
        newSearch: search,
        sortBy: ""
    }

    for (let parser of clientSearchParsers.values()) {
        filters["newSearch"] = parser(filters["newSearch"], filters, searchForm)
    }

    return filters
}

type ClientFilter = (filter: string) => boolean
type ClientFilterApplication = (filter: string, entries: ArrayIterator<InfoEntry>) => ArrayIterator<InfoEntry>
const clientFilters = new Map<ClientFilter, ClientFilterApplication>

/**
    * Adds a filter to client filters
* @param {ClientFilter} filter a function that takes a string (filter name) as an argument and returns a boolean to determine if it is the filter you want
    * @param {ClientFilterApplication} map a function that takes the filter name, and a list of InfoEntry, and returns a list of InfoEntry after filter has been applied
*/
function addClientFilterRuleUI(filter: ClientFilter, map: ClientFilterApplication) {
    clientFilters.set(filter, map)
}

/**
    * Removes a filter from the client filters
* @param {ClientFilter} filter The filter to remove
* @returns {1 | 0} 1 for success, 0 if filter does not exist
    */
function removeClientFilterRuleUI(filter: ClientFilter): 1 | 0 {
    if (clientFilters.has(filter)) {
        clientFilters.delete(filter)
        return 1
    }
    return 0
}

addClientFilterRuleUI(filter => filter.startsWith("is"),
    function(filter, items) {
        let ty = filter.split("is")[1]?.trim()
        if (!ty) return items
        ty = ty.replace(/(\w)(\S*)/g, (_, $1, $2) => $1.toUpperCase() + $2)
        return items.filter(v => v.Type == ty)
    })

addClientFilterRuleUI(filter => !!filter.match(/\[(\d*):(-?\d*)\]/),
    function(filter, items) {
        const match = filter.match(/\[(\d*):(-?\d*)\]/)
        if (!match) return items
        return items.drop(+match[1]).take(+match[2] - +match[1])
    })

addClientFilterRuleUI(filter => filter.startsWith("/") && filter.endsWith("/"),
    function(filter, items) {
        const re = new RegExp(filter.slice(1, filter.length - 1))
        return items.filter(v => v.En_Title.match(re))
    })

addClientFilterRuleUI(filter => filter === 'shuffle' || filter === 'shuf',
    (_, items) => arr_shuf(items).values())

addClientFilterRuleUI(filter => filter.startsWith("head"),
    (filter, items) => items.take(parseInt(filter.slice("head".length).trim()) || 1))

addClientFilterRuleUI(filter => filter.startsWith("tail"),
    (filter, items) => {
        const e = [...items]
        const tail = parseInt(filter.slice("tail".length).trim()) || 1
        return e.reverse().slice(0, tail).reverse().values()
    })

addClientFilterRuleUI(filter => filter.startsWith("sort"),
    (filter, items) => {
        let type = filter.slice("sort".length).trim() || "a"
        const reversed = type.startsWith("-") ? -1 : 1
        if (reversed == -1) type = type.slice(1)
        switch (type[0]) {
            case "a":
                return [...items].sort((a, b) => (a.En_Title > b.En_Title ? 1 : -1) * reversed).values()
            default:
                return items
        }

    })

addClientFilterRuleUI(filter => filter === "!child", (filter, items) => {
    return items.filter(v => !items_getEntry(v.ItemId).relations.isChild())
})

addClientFilterRuleUI(filter => filter === "!copy", (filter, items) => {
    return items.filter(v => !items_getEntry(v.ItemId).relations.isCopy())
})

/**
    * Given a list of entries, and filters, apply the filters to the list of entries
* and return the new list
* @param {InfoEntry[]} entries
* @param {ClientSearchFilters} filters
* @returns {InfoEntry[]}
*/
function applyClientsideSearchFiltering(entries: InfoEntry[], filters: ClientSearchFilters): InfoEntry[] {

    if (filters.sortBy.startsWith("-aiow")) {
        entries = sortEntries(entries, filters.sortBy)
    }

    for (let filter of filters.filterRules) {
        filter = filter.trim()

        let e = entries.values()
        for (let [is, filterFn] of clientFilters.entries()) {
            if (is(filter)) e = filterFn(filter, e)
        }
        entries = e.toArray()
    }

    return entries
}

/**
 * Opens the new-event-form dialog fills the itemid input element with {itemid}
 * @param {string} itemid the item id to add the event to
 * @param {string} [eventId] the event id to edit 
 * @returns {HTMLDialogElement | null}
 */
function openEventFormUI(itemid: string, eventId?: string, resetForm: boolean = true): HTMLDialogElement | null {
    const modal = openModalUI("new-event-form")
    if (!modal) return null

    const form = dom_getelorthrow("form:has(input)", currentWindow().HTMLFormElement, modal)

    if(resetForm) form.reset()

    const itemidEl = dom_getelorthrow('[name="itemid"]', currentWindow().HTMLInputElement, form)
    itemidEl.value = itemid

    const eventidEl = dom_getelorthrow('[name="eventId"]', currentWindow().HTMLInputElement, form)
    if(eventId) {
        eventidEl.value = eventId
    } else {
        eventidEl.value = "0"
    }

    return modal
}



/**
 * Creates (or edits) an event based on a form
 * if the input with name eventId != 0, it edits that event instead of creating a new one
 * Side effects:
 * - assuming the form is within a popover, hide it
 * - reloads events
*/
async function newEventUI(form: HTMLFormElement) {
    const data = new FormData(form)
    const name = data.get("name")
    if (name == null) {
        alert("Name required")
        return
    }

    const tsStr = data.get("timestamp")?.toString() || ""

    const aftertsStr = data.get("after")
    const beforetsStr = data.get("before")
    const timezoneData = data.get("timezone")
    const timezone = (timezoneData
        ? timezoneData.toString()
        : INTL_OPTIONS.timeZone
    ) || ""

    let ts = tsStr
        ? time_zoneddate2utc(tsStr, timezone)
        : 0
    let afterts = aftertsStr
        ? time_zoneddate2utc(aftertsStr.toString(), timezone)
        : 0
    let beforets = beforetsStr
        ? time_zoneddate2utc(beforetsStr.toString(), timezone)
        : 0

    const itemidvalue = data.get("itemid")?.toString()
    if (!(itemidvalue)) throw new Error("No itemid from new event form")

    const itemId = BigInt(itemidvalue)

    const eventId = data.get("eventId")
    if(eventId && eventId != "0") {
        const event = items_getEntry(itemId).getEvent(Number(eventId))
        if(!event) {
            alert(`Could not find event: ${eventId}`)
            return
        }
        api_editEvent(
            event.EventId,
            event.Event = name.toString(),
            event.Timestamp = ts,
            event.After = afterts,
            event.TimeZone = timezone,
            event.Before = beforets
        )
            .then(res => {
                items_replaceEvent(event)
                updateInfo2({
                    [String(event.ItemId)]: {
                        events: items_getEntry(itemId).events
                    }
                })
            })
        return
    }

    api_registerEvent(itemId, name.toString(), ts, afterts, timezone, beforets)
        .then(res => res?.text())
        .then(() => {
            reloadEventsUI(itemId)
            form.parentElement?.hidePopover()
        })
        .catch(alert)
}

/**
    * Creates a new entry based on a form
* Side effects:
    * - adds the new item to the global entries list
* - calls ui_search() with <q>En_Title = 'new-item-name'</q>
* - resets the form
* @param {HTMLFormElement} form - the form to use for creating an entry
    */
async function newEntryUI(form: HTMLFormElement) {
    const data = new FormData(form)

    dom_resetform(form)

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

    if (validEntries["parentId"] && validEntries["parentId"] == "0") {
        delete validEntries["parentId"]
    }

    let queryString = "?" + Object.entries(validEntries).map(v => `${v[0]}=${encodeURIComponent(String(v[1]))}`).join("&") + `&art-style=${artStyle}`

    let parentIdEl = form.querySelector("[name=\"parentId\"]")
    if (!(parentIdEl !== null && "value" in parentIdEl)) throw new Error("name=parentId did not return an input kind element")
    const parentId = parentIdEl.value

    let copyOfIdEl = form.querySelector("[name=\"copyOf\"]")
    if (!(copyOfIdEl !== null && "value" in copyOfIdEl)) throw new Error("name=copyOf did not return an input kind element")
    const copyOfId = copyOfIdEl.value

    let requiresEl = form.querySelector("[name=\"requires\"]")
    if (!(requiresEl !== null && "value" in requiresEl)) throw new Error("name=requires did not return an input kind element")
    const requires = requiresEl.value

    if (parentId !== "0") {
        queryString += `&parentId=${parentId}`
    }
    if (copyOfId !== "0") {
        queryString += `&copyOf=${copyOfId}`
    }
    if (requires !== "0") {
        queryString += `&requires=${requires}`
    }

    const tz = INTL_OPTIONS.timeZone

    let res = await authorizedRequest(`${apiPath}/add-entry${queryString}&timezone=${encodeURIComponent(tz)}`)
    let text = await res?.text()
    if (res?.status !== 200 || !text) {
        alert(text)
        return
    }

    let json = api_deserializeJsonl(text).next().value

    items_addById(json.ItemId).then(() => {
        ui_search(`En_Title = '${quoteEscape(json.En_Title, "'")}'`)
    }).catch(err => {
        console.error(err)
        alert("Failed to load new item metadata, please reload")
    })
}

/**
    * does a search, and fills the item listing with the results
* @param {string} search - search query
*/
async function fillItemListingWithSearch(search: string): Promise<HTMLDivElement> {
    let useV3 = false
    if (search.startsWith("3")) {
        useV3 = true
        search = search.slice(1).trimStart()
    }

    let results = await (useV3 ? api_queryV3 : api_queryV4)(search, getUidUI())

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

/**
    * fills the item listing with an arbitrary record of id: element pairs
* when an element is clicked, the id associated with it is the return value of the item selection
* @param {Record<any, HTMLElement>} items
*/
function fillItemListingArbitraryUI(items: Record<any, HTMLElement>) {
    const itemsFillDiv = dom_getelorthrow("#put-items-to-select", HTMLElement)
    itemsFillDiv.innerHTML = ""

    const container = document.createElement("div")
    container.classList.add("grid")
    container.classList.add("center")
    container.style.gridTemplateColumns = "1fr 1fr 1fr"

    for (let id in items) {
        let el = items[id]
        if (el.tagName !== "BUTTON") {
            const f = document.createElement("button")
            f.append(el)
            el = f
        }
        (el as HTMLButtonElement).value = id
        container.append(el)
    }
    itemsFillDiv.append(container)
    return container
}

/**
    * Fills the item listing with items
* @param {Record<string, MetadataEntry | items_Entry>} entries
* @param {boolean} [addCancel=true]
* @returns {HTMLDivElement}
*/
function fillItemListingUI(entries: Record<string, MetadataEntry | items_Entry>, addCancel: boolean = true): HTMLDivElement {
    const itemsFillDiv = dom_getelorthrow("#put-items-to-select", HTMLElement)
    itemsFillDiv.innerHTML = ""

    const container = itemsFillDiv.querySelector("div") || document.createElement("div")
    container.classList.add("grid")
    container.classList.add("center")
    container.style.gridTemplateColumns = "1fr 1fr 1fr"
    container.style.justifyItems = "center"

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

        const btn = document.createElement("button")

        btn.classList.add("styleless-button")
        btn.style.width = "fit-content"
        btn.value = String(id)

        const fig = document.createElement("figure")
        btn.append(fig)

        fig.style.cursor = "pointer"

        let thumbnail = probablyMetaEntry(entry) ? fixThumbnailURL(entry.Thumbnail) : entry.fixedThumbnail

        const img = document.createElement("img")
        img.src = fixThumbnailURL(thumbnail)
        img.width = 100
        img.loading = "lazy"
        const caption = document.createElement("figcaption")
        caption.innerText = title

        fig.append(img)
        fig.append(caption)

        container.append(btn)
    }

    itemsFillDiv.append(container)
    return container
}

/**
    * Replaces the input element's value with a user chosen item
* if the user doesn't select anything, the value is set to "0"
    * @param {HTMLInputElement} input
*/
async function replaceValueWithSelectedItemIdUI(input: HTMLInputElement, options?: SelectItemOptions) {
    let item = await selectItemUI(options)
    const popover = dom_getelorthrow("#items-listing", HTMLDialogElement)
    if (item === null) {
        input.value = "0"
        return
    }
    input.value = popover.returnValue
}

type SelectItemOptions = Partial<{
    container: HTMLDivElement | null,
    onsearch: (query: string) => Promise<HTMLDivElement>,
    convertToBigInt: boolean
}>

/**
    * lets the user select an item, be sure to use fillItemListingUI first
* @param {SelectItemOptions} [options]
* @returns {Promise<null | bigint>}
*/
async function selectItemUI(options?: SelectItemOptions): Promise<null | bigint | any> {
    const popover = dom_getelorthrow("#items-listing", HTMLDialogElement)

    const convert = options?.convertToBigInt ?? true

    let f = dom_getelorthrow("#items-listing-search", HTMLFormElement)
    let query = dom_getelorthrow('[name="items-listing-search"]', HTMLInputElement, f)

    let { container, onsearch } = options || {}

    if (!onsearch) {
        onsearch = fillItemListingWithSearch
    }

    if (!container) {
        let cpy = { ...items_getAllEntries() }
        container = fillItemListingUI(cpy, true)
    }

    popover.showModal()

    return await new Promise((res) => {
        popover.onclose = function() {
            if (popover.returnValue) {
                res(convert ? BigInt(popover.returnValue) : popover.returnValue)
            } else res(null)
        }
        f.onsubmit = function() {
            onsearch(query.value)
        }
    })
}

/**
    * Opens the sign in ui to let the user sign in, with an optional reason to sign in shown to the user
* @param {string} reason
* @returns {Promise<string>} the login token
*/
async function signinUI(reason: string): Promise<string> {
    const loginPopover = dom_getelorthrow("#login", currentWindow().HTMLDialogElement)

    const loginReasonEl = loginPopover.querySelector("#login-reason")
    if (loginReasonEl instanceof HTMLElement) {
        loginReasonEl.innerText = reason || ""
    }

    //if the popover is already open, something already called this function for the user to sign in
    if (loginPopover.open) {
        return await new Promise((res) => {
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
    return await new Promise((res) => {
        const form = dom_getelorthrow("#login-form", currentWindow().HTMLFormElement, loginPopover)
        form.onsubmit = function() {
            alert(1)
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

/**
    * Fills a select element with all the possible formats
* @param {HTMLSelectElement} formatSelector
*/
async function fillFormatSelectionUI(formatSelector: HTMLSelectElement) {
    const groups = {
        "DIGITAL": "Misc",
        "IMAGE": "Misc",
        "UNOWNED": "Misc",
        "THEATER": "Misc",
        "OTHER": "Misc",
        "CD": "Optical",
        "DVD": "Optical",
        "BLURAY": "Optical",
        "4KBLURAY": "Optical",
        "STEAM": "Store",
        "EPIC": "Store",
        "NIN_SWITCH": "Console",
        "NIN_SWITCH2": "Console",
        "GAMECUBE": "Console",
        "WII": "Console",
        "NIN_DS": "Console",
        "PS1": "Console",
        "PS2": "Console",
        "PS3": "Console",
        "PS4": "Console",
        "PS5": "Console",
        "XBOXONE": "Console",
        "XBOX360": "Console",
        "BOARDGAME": "Misc",
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

/**
    * Fills a datalist with a list of all recommenders a user has used
* @param {HTMLDataListElement} list
* @param {number} uid
*/
async function fillRecommendedListUI(list: HTMLDataListElement, uid: number) {
    list.innerHTML = ""

    const recommenders = await api_list_recommenders(uid)
    for (let r of recommenders) {
        const opt = document.createElement("option")
        opt.value = r
        list.appendChild(opt)
    }
}

/**
    * Fills a select element with all the possible types
* @param {HTMLSelectElement} typeDropdown
*/
async function fillTypeSelectionUI(typeDropdown: HTMLSelectElement) {
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

/**
    * Fills a select element with all users
* @param {HTMLSelectElement | undefined | null} selector
*/
async function fillUserSelectionUI(selector: HTMLSelectElement | undefined | null) {
    for (let acc of await api_listAccounts()) {
        const [id, name] = acc.split(":")

        ACCOUNTS[Number(id)] = name

        if (selector) {
            const opt = document.createElement("option")
            opt.value = id
            opt.innerText = name
            selector.append(opt)
        }
    }
}

/**
    * Sets the current uid
* side effects:
    * - alters the uid selector's value to the current uid
* the above side effect is necessary as the uid selector is how the current uid is kept track of
*/
function setUIDUI(uid: string) {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement | null
    uidSelector && (uidSelector.value = uid)
}

/**
    * Sets the current uid from a list of things that might contain a uid
* heuristics:
    * - ?uname parameter
* - ?uid parameter
* - localStorage["userUid"]
*/
function setUIDFromHeuristicsUI() {
    const params = new URLSearchParams(document.location.search)
    if (params.has("uname")) {
        let uid = Object.entries(ACCOUNTS).filter(([_, name]) => name === params.get("uname") as string)[0]
        if (!uid) {
            setError(`username: ${params.get("uname")} does not exist`)
            return
        }
        setUIDUI(uid[0])
    } else if (params.has("uid")) {
        setUIDUI(params.get("uid") as string)
    } else if (localStorage.getItem("userUID")) {
        setUIDUI(localStorage.getItem("userUID") as string)
    }
}

/**
    * turns on/off display mode, which hides the chrome around the view mode
* @param {boolean | "toggle"} [on="toggle"]
*/
function setDisplayModeUI(on: boolean | "toggle" = "toggle") {
    if (on === "toggle") {
        components.mainUI?.classList.toggle("display-mode")
    } else if (on) {
        components.mainUI?.classList.add("display-mode")
    } else {
        components.mainUI?.classList.remove("display-mode")
    }
}

/**
    * @description keeps track of the window being used to display the information selected by view-toggle
*/
let modeWin: Window = window

/**
    * checks if the catalog window is open
* @returns {boolean}
*/
function isCatalogModeUI(): boolean {
    return modeWin !== window
}

/**
    * opens the catalog window
*/
function openCatalogModeUI() {
    let mainUI = components.mainUI
    if (!mainUI || mainUI.classList.contains("catalog-mode")) return

    let urlParams = new URLSearchParams(location.search)
    urlParams.set("display", "true")
    urlParams.set("no-select", "true")
    urlParams.set("no-mode", "true")
    const newURL = `${location.origin}${location.pathname}?${urlParams.toString()}${location.hash}`
    const win = open(newURL, "_blank", "popup=true")
    if (win) {
        modeWin = win
        win.addEventListener("beforeunload", () => {
            closeCatalogModeUI()
        })
        const thisMode = mode_getFirstModeInWindow(window)
        if (thisMode) {
            mode_chwin(win as Window & typeof globalThis, thisMode)
        }
        mainUI.classList.add("catalog-mode")
        toggleUI("viewing-area", "none")
    } else {
        alert("Failed to track the newly opened window, it will not work")
    }
}

/**
    * closes the catalog window
*/
function closeCatalogModeUI() {
    if (!modeWin) {
        console.warn("Catalog window is not open")
        return
    }
    const thisMode = mode_getFirstModeInWindow(modeWin)
    modeWin.close()
    if (thisMode) {
        mode_chwin(window, thisMode)
    }
    let mainUI = components.mainUI
    if (!mainUI) {
        console.warn("could not find main ui")
        return
    }
    mainUI.classList.remove("catalog-mode")
    toggleUI("viewing-area", "")
    modeWin = window
}

/**
    * Given an item:
    * - set the document title to "[AIO] | itemname"
* - set the favicon to the item's thumbnail
* @param {InfoEntry} item
*/
function updatePageInfoWithItemUI(item: InfoEntry) {
    document.title = `[AIO] | ${item.En_Title || item.Native_Title}`
    ua_setfavicon(fixThumbnailURL(findMetadataById(item.ItemId).Thumbnail))
}

/**
    * Do a user startup script
* should only be called if the current uid matches the logged in user uid
    * otherwise we will load random people's settings :)
* @param {Settings} settings
*/
function doUserStartupUI(settings: Settings) {
    const script = settings.UIStartupScript
    const lang = settings.StartupLang

    if (script === "") return

    if (lang == "aiol" || lang == "") {
        parseExpression(script, new CalcVarTable())
    } else {
        //this is the user's own script, this should be fine
        eval(script)
    }
}

/**
    * Converts a format number to a displayable symbol
*/
function formatToSymbolUI(format: number): string {
    const custom = settings_get(getUserUID(), "custom_item_formats")
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

/**
    * Potentially register an element as a popout trigger target that will pop
* the parent element into it's own window
* This fails if there is no parent element
    *
    * WARNING: interactive elements may not work in the popout window
*/
function popoutUI(popoutTarget: HTMLElement, _event: keyof WindowEventMap = "click") {

    const toPop = popoutTarget.getAttribute("popout-target")
    let parent = popoutTarget.parentElement
    if (toPop) {
        const root = popoutTarget.getRootNode()
        if (!(
            root.nodeType === Node.DOCUMENT_NODE
            || root.nodeType === Node.DOCUMENT_FRAGMENT_NODE
        ))
            throw new Error("Popout button root is not a document")
        parent = root.getElementById(toPop)
    }
    if (!parent) return

    popoutTarget.onclick = async function() {
        const win = await ua_popup(`<!DOCTYPE html>
                                           <head style='height: 100dvh'>
                                           <meta name="viewport" content="width=device-width, initial-scale=1">
                                           <style>
                                           body {
                                               padding: var(--small-gap);
                                               height: 100%;
                                           }
                                           </style>
                                           </head>
                                           <body>
                                           </body>`)
        if (!win) return

        for (let sheet of document.styleSheets) {
            const newSheet = new win.self.CSSStyleSheet()
            newSheet.replace([...sheet.cssRules].map(v => v.cssText).join(""))
            win.document.adoptedStyleSheets.push(newSheet)
        }


        //this is where we are going to put the parent back
        const placeholder = document.createElement("p")
        placeholder.innerHTML = `Content popped out <button>Focus content</button>`
        placeholder.querySelector("button")?.addEventListener("click", () => win.focus())

        //create a copy of the parent in the new document
        const adoptedParent = win.document.importNode(parent, true)

        //replace the parent with the place holder
        parent.replaceWith(placeholder)

        //move the parent to the other document
        win.document.body.append(adoptedParent)

        //@ts-ignore
        let watcher: CloseWatcher | null = null
        if ("CloseWatcher" in window) {
            //@ts-ignore
            watcher = new win.CloseWatcher
            watcher.onclose = () => {
                placeholder.replaceWith(parent)
                win.close()
                watcher.destroy()
            }
        }

        const closePopout = dom_getel("close-button button", win.self.HTMLElement, win.document.body)
        if (closePopout) {
            closePopout.onclick = () => {
                placeholder.replaceWith(parent)
                win.close()
                if (watcher) watcher.destroy()
            }
        }

        win.addEventListener("pagehide", () => {
            placeholder.replaceWith(parent)
            if (watcher) watcher.destroy()
        })
    }
}

/**
    * Update the Status field of an item (on the server and clientside)
* @param {bigint} itemId
* @param {UserStatus} status
*/
async function updateStatusUI(itemId: bigint, status: UserStatus) {
    return await setPropUI(findUserEntryById(itemId), "Status", status, "Update status")
}

/**
    * Update the Notes field of an item (on the server and clientside)
* @param {bigint} itemId
* @param {string} note
*/
async function updateNotesUI(itemId: bigint, note: string) {
    return await setPropUI(findUserEntryById(itemId), "Notes", note, "Update notes")
}

async function transactUI(uid: number, itemId: bigint, transactionType: "Purchased" | "Sold", price: number) {
    if (transactionType === "Sold") {
        price *= -1
    }
    let rv = await api_transact(uid, itemId, price, settings_get(uid, "currency"), INTL_OPTIONS.timeZone)
    let newInfo = await api_getEntryAll(itemId, uid)
    if (newInfo)
        updateInfo2({
            [String(itemId)]: newInfo
        })

    return rv
}

/**
    * Ask the user for a list of additional recommenders for an item
* will update the list clientside, and serverside
* @param {bigint} itemId
*/
async function newRecommendedByUI(itemId: bigint) {
    let newRecommendedBy = await promptUI("Names (, separated)", "", "recommended-by")
    if (!newRecommendedBy) return

    let r = newRecommendedBy.split(",")
    try {
        const info = findInfoEntryById(itemId)
        info.RecommendedBy = JSON.stringify(
            JSON.parse(info.RecommendedBy).concat(r)
        )

        var res = await api_setItem("", info, "Update recommended by")
        if (res?.status !== 200) return ""
        updateInfo2({
            [String(itemId)]: {
                info
            }
        })
    } catch (err) {
        console.error(err)
    }
}

/**
    * Ask the user for a list of additional tags for an item
* will update the list clientside, and serverside
* @param {bigint} itemId
* @param {string[] | null} [tags=null]
*/
async function newTagsUI(itemId: bigint, tags: string[] | null = null) {
    let newTags = null
    if (!tags) {
        newTags = await promptUI("Tag name (, seperated)", "", "tags-dl")
    }
    if (!newTags) return
    tags = newTags.split(",")


    try {
        const info = findInfoEntryById(itemId)
        info.Tags = info.Tags?.concat(tags) || tags

        var res = await api_addEntryTags(info.ItemId, newTags.split(","))
        if (res?.status !== 200) return ""

        updateInfo2({
            [String(itemId)]: {
                info
            }
        })
    } catch (err) {
        console.error(err)
    }
}

/**
    * Update the location field of an item (on the server and clientside)
* @param {bigint} itemId
* @param {string} [location]
*/
async function updateLocationUI(itemId: bigint, location: string) {
    return await setPropUI(findInfoEntryById(itemId), "Location", location, "update location")
}

/**
    * Update the En_Title field of an item (on the server and clientside)
* @param {bigint} itemId
* @param {string} [newTitle]
*/
async function updateUserTitleUI(itemId: bigint, newTitle: string): Promise<Response | null> {
    return await setPropUI(findInfoEntryById(itemId), "En_Title", newTitle, "Update the english title")
}

/**
    * Attempts to set a property of a UserEntry, InfoEntry, or MetadataEntry.
    * If it succeeds, it will update the ui
* If not it will alert an error to the user
    *
    * @returns {Response}
*/
async function setPropUI<N extends keyof UserEntry>(obj: UserEntry, name: N, value: UserEntry[N], actionDisplayName?: string): Promise<Response | null>
async function setPropUI<N extends keyof MetadataEntry>(obj: MetadataEntry, name: N, value: MetadataEntry[N], actionDisplayName?: string): Promise<Response | null>
async function setPropUI<N extends keyof InfoEntry>(obj: InfoEntry, name: N, value: InfoEntry[N], actionDisplayName?: string): Promise<Response | null>
async function setPropUI<T extends InfoEntry | MetadataEntry | UserEntry, N extends keyof T>(obj: T, name: N, value: any, actionDisplayName?: string): Promise<Response | null> {
    //dont update the actual object until we know we
    //successfully updated the object on the server, otherwise we have desync
    const cpy = { ...obj }
    cpy[name] = value

    const ty =
        probablyMetaEntry(obj) ?
            "meta"
            : probablyUserItem(obj) ?
                "user"
                : "info"

    const path =
        ty === "meta" ?
            "metadata/"
            : ty === "user" ?
                "engagement/"
                : ""

    try {
        var res = await api_setItem(path, cpy, actionDisplayName)
    } catch (err) {
        alert(`Failed to ${actionDisplayName}`)
        return null
    }

    if (res?.status !== 200) {
        alert(`Failed to ${actionDisplayName}, ${await res?.text()}`)
        return res
    } else {
        alert(`${actionDisplayName} successful`)
    }

    obj[name] = value

    updateInfo2({
        [String(obj.ItemId)]:
            ty === "meta" ?
                { meta: obj as MetadataEntry }
                : ty === "user" ?
                    { user: obj as UserEntry }
                    : { info: obj as InfoEntry }
    })

    return res
}

/**
    * checks if all items are being viewed, does so through the viewAllElem copmonent
* @returns {boolean}
*/
function isViewingAllUI(): boolean {
    return components.viewAllElem?.checked || false
}

/**
    * Enables/disables all items being viewed, does so through the viewAllElem component
* @param {boolean} enabled
*/
function setViewingAllUI(enabled: boolean) {
    if (!(components.viewAllElem instanceof HTMLInputElement))
        throw new Error("If there is a viewAll element it is not an <input>")
    components.viewAllElem.checked = enabled
}

/**
    * Given an item, open a popup window to display it
* @param {bigint} id - the item id
* @param {string} [target="_blank"]
* @param {boolean} [popup=true]
*/
function openDisplayWinUI(id: bigint, target: string = "_blank", popup: boolean = true) {
    const win = open(`/ui/display.php?item-id=${id}`, target, popup ? "popup=true" : undefined)
    win?.addEventListener("modes.update-item", _ => {
        var i = setInterval(() => {
            let btn = win?.document.querySelector("display-entry")?.shadowRoot?.querySelector("[entry-action='close']")
            if (!btn) return
            clearInterval(i)
            if (!(btn instanceof win?.self.HTMLButtonElement)) return
            (btn).onclick = function() { win.close() }
        }, 100)

        api_getEntryAll(id, findInfoEntryById(id).Uid).then((res) => {
            if (!res) return
            updateInfo2({
                [String(id)]: {
                    ...res
                }
            })
        })
    })
}

/**
    * Selects an item to be displayed in {mode} if given, otherwise all openViewModes
*
    * side effects:
    * - update stats (if updateStats is true)
* @param {InfoEntry} item
* @param {boolean} [updateStats=true]
* @param {Mode} [mode=undefined] the mode to update (otherwise all open modes)
*/
function selectUI(item: InfoEntry, updateStats: boolean = true, mode?: Mode): HTMLElement[] {
    setError("")

    items_selectById(item.ItemId)
    updateStats && changeResultStatsWithItemUI(item)
    updatePageInfoWithItemUI(item)
    return mode_selectItem(item, mode)
}

/**
    * Selects a list of items to be selected within {mode} or all openViewModes if not given
* side effects:
    * - updates stats (if updateStats is true)
* - sets error to "" (if list is not empty, meaining, we selected something)
    * @param {InfoEntry[]} itemList
* @param {boolean} [updateStats=true]
* @param {Mode} [mode=undefined]
*/
function selectListUI(itemList: InfoEntry[], updateStats: boolean = true, mode?: Mode) {
    if (itemList.length !== 0)
        setError("")
    items_setSelected(items_getSelected().concat(itemList))
    updateStats && changeResultStatsWithItemListUI(itemList)
    if (itemList.length)
        updatePageInfoWithItemUI(itemList[0])

    mode_selectItemList(itemList, mode)
}
//just in case
const selectItemList = selectListUI

/**
    * Deselects an item
* side effects:
    * - update stats (if updateStats is true)
* - sets error to "No items selected" if no items are selected
    * @param {InfoEntry} item
* @param {boolean} [updateStats=true]
*/
function deselectUI(item: InfoEntry, updateStats: boolean = true) {
    items_deselectById(item.ItemId)
    updateStats && changeResultStatsWithItemUI(item, -1)

    mode_deselectItem(item)

    if (items_getSelected().length === 0) {
        setError("No items selected")
    }
}

/**
    * Toggle the selectedness of an item
* side effects:
    * - updates stats (if updateStats is true)
* @param {InfoEntry} item
* @param {boolean} [updateStats=true]
*/
function toggleItemUI(item: InfoEntry, updateStats: boolean = true) {
    if (items_isSelected(item.ItemId)) {
        deselectUI(item, updateStats)
        //by definition we are no longer viewing everything
        setViewingAllUI(false)
    }
    else {
        selectUI(item, updateStats)
    }
}
//just in case
const toggleItem = toggleItemUI


/**
    * Clears selected items within a mode
* side effects:
    * - updates stats
* - sets error to "No items selected"
*
    * @see ui_modeclear(), which clears miscellanious nodes from modes
*/
function clearUI(updateStats: boolean = true) {
    setError("No items selected")
    items_clearSelected()
    mode_clearItems()
    updateStats && resetStatsUI()
}


/**
    * given a metadata provider, and a search query allow the user to select an item from the metadata provider's results.
    * @param {string} provider the metadata provider
* @param {string} search the search query
* @returns {Promise<string | null>} the provider's id for the selected result or null.
        */
async function titleIdentificationUI(provider: string, search: string): Promise<string | null> {
    let res = await api_identify(search, provider)
    if (!res) {
        return null
    }
    let text = await res.text()
    let [_, ...restList] = text.split("\x02")

    let rest = restList.join("\x02")

    let items: any[]
    try {
        items = rest.split("\n").filter(Boolean).map(v => JSON.parse(v))
    }
    catch (err) {
        console.error("Could not parse json", rest.split('\n'))
        return null
    }

    let obj = Object.fromEntries(items.map(v => [v.ProviderID || String(v.ItemId), v]))
    const container = fillItemListingUI(obj)
    let item = await selectItemUI({
        convertToBigInt: false,
        container,
        async onsearch(query) {
            let res = await api_identify(query, provider)
            if (!res) return document.createElement("div")
            let text = await res.text()
            let [_, rest] = text.split("\x02")
            let items = rest.split("\n").filter(Boolean).map(v => JSON.parse(v))
            obj = Object.fromEntries(items.map(v => [v.ProviderID || String(v.ItemId), v]))
            return fillItemListingUI(obj)
        },
    })
    return item ? String(item) : null
}

/**
    * Fills the new item form from metadata
* @param {MetadataEntry} [metadata] must be provided or fails
* @param {HTMLFormElement} [form] the new item form to fill out
*/
function fillNewItemFormFromMetadataUI(metadata?: MetadataEntry, form?: HTMLFormElement | null) {
    form ||= components.newItemForm
    if (!form) {
        console.error("Failed to fill new item form from metadata, no form")
        return
    }

    if (!metadata) {
        console.error("Failed to fill new item form from metadata, no metadata")
        return
    }

    form.elements['metadata'].value = api_serializeEntry(metadata)
    form.elements['title'].value = metadata.Title
    let dep = {}
    if (metadata.MediaDependant != '{}') {
        dep = JSON.parse(metadata.MediaDependant)
        const ty = Object.keys(dep)[0].split('-')[0]
        form.elements['type'].value = ty
    }

    if (metadata.Provider == 'anilist' && form.elements['type'].value === 'Show') {
        form.elements['is-anime-art'].checked = true
    } else {
        form.elements['is-anime-art'].checked = false
    }

    if (metadata.Provider.startsWith("gtdb")) {
        form.elements["type"].value = "Game"
        if(dep["Game-console"]) {
            switch(dep["Game-console"].toLowerCase()) {
                case "wii":
                    form.elements["format"].value = 18
                    break
                case "gamecube":
                    form.elements["format"].value = 27
                    break
                case "switch":
                    form.elements["format"].value = 10
                    break
                case "ds":
                    form.elements["format"].value = 19
                    break
            }
        }
    }
}

/**
    * Allow the user to perform a metadata search
* if forItem is given, apply the selected metadata to that item
    * @param {bigint} [forItem] the item to apply metadata to
* @return {Promise<MetadataEntry | null>
    */
async function itemIdentificationUI(forItem?: bigint): Promise<MetadataEntry | null> {
    const modal = openModalUI("item-identification-form")
    if (!modal) return null

    return await new Promise(async (pres, rej) => {
        modal.oncancel = e => e.preventDefault()
        modal.onclose = async () => {
            if (!modal.returnValue) {
                rej("user cancelled")
                return
            }

            const paramsForm = dom_getelorthrow("[name='dialog-form']", currentWindow().HTMLFormElement, modal)

            let data = new FormData(paramsForm)

            let provider = data.get("provider") as string

            let queryType = data.get("query-type") as "by-title" | "by-id"

            let search = data.get("search") as string

            if (!search) {
                rej("No search")
                return
            }

            let finalItemId: string | null = ""

            switch (queryType) {
                case "by-title":
                    finalItemId = await titleIdentificationUI(provider, search)

                    if (!finalItemId) {
                        alert("Failed to identify item")
                        return
                    }

                    break
                case "by-id":
                    finalItemId = search
                    break
            }
            const res = await api_finalizeIdentify(finalItemId, provider, forItem)
            const json = await res?.text()
            if (!json) {
                alert(`Failed to reload meta: ${json}, please refresh`)
                rej(`Failed to reload meta: ${json}, please refresh`)
                return
            }

            const newMeta = [...api_deserializeJsonl<MetadataEntry>(json)][0]

            if (forItem) {
                //if the provider also has a location provider might as well get the location for it
                if (["steam", "sonarr", "radarr"].includes(provider)) {
                    fetchLocationUI(forItem, provider)
                }
                updateInfo2({
                    [String(forItem)]: {
                        meta: newMeta
                    }
                })
            }

            pres(newMeta)
        }
    })
}

//just in case
const clearItems = clearUI

/**
    * given an object, and a table, fill the table with fields from the object
* that the user can edit
* @param {object} obj
* @param {HTMLTableElement} objectTbl
* @param {string} [clear='tr:not(:first-child)'] a query selector of which element children to clear
*/
function updateObjectTblUI(obj: object, objectTbl: HTMLTableElement, clear?: string = 'tr:not(:first-child)', skip: string[] = []) {

    if (clear) {
        for (let el of objectTbl.querySelectorAll(clear)) {
            el.remove()
        }
    }

    for (let key in obj) {
        if(skip.includes(key)) continue

        let val = obj[key as keyof typeof obj] as any
        //if the key alr is in the table, and we aren't clearing, then skip
        //otherwise the key will get duplicated
        if (objectTbl.querySelector(`[data-keyname="${key}"]`) && !clear) {
            continue;
        }
        const tr = document.createElement("tr")
        const nameTd = document.createElement("td")
        const valTd = document.createElement("td")

        nameTd.setAttribute("data-keyname", key)
        nameTd.innerText = key

        valTd.setAttribute("data-type", typeof val)
        if (typeof val === 'bigint') {
            val = String(val)
        }
        else if (typeof val !== 'string' && typeof val !== 'number') {
            val = JSON.stringify(val)
        }
        valTd.innerText = val

        valTd.contentEditable = "true"
        nameTd.contentEditable = "true"

        tr.append(nameTd)
        tr.append(valTd)

        objectTbl.append(tr)
    }
}

/**
    * Given a table element, pull out all k/v pairs into an object
* @param {HTMLTableElement} tbl
* @param {string[]} skip if a key is in this array, it will not be added to the final object
    * @return {Record<string, string>}
*/
function getObjFromObjEditorUI(tbl: HTMLTableElement, skip: string[] = []): Record<string, string> {
    let newObj: Record<string, any> = {}
    for (let row of tbl?.querySelectorAll("tr:has(td)") || []) {
        let key = row.firstElementChild?.textContent || ""

        let valueEl = row.firstElementChild?.nextElementSibling
        if (!valueEl) continue
        let value = valueEl?.textContent || ""
        if (key == "") continue

        let valueType = valueEl.getAttribute("data-type")
        if (valueType === 'bigint') {
            newObj[key] = BigInt(value)
        } else if (valueType === 'number') {
            newObj[key] = Number(value)
        } else {
            newObj[key] = value
        }
    }
    return newObj
}

/**
 * Given an item id make <de-progress> bars for it
 * @param {bigint} forItem
 */
function mkDeProgressUI(forItem: bigint, actions?: Record<string, (target: HTMLElement, event: Event) => any>): HTMLElement[] {
    const meta = findMetadataById(forItem)
    let user = findUserEntryById(forItem)

    try {
        var mediaDependant = JSON.parse(meta["MediaDependant"] || "{}")
    } catch (err) {
        console.error("Could not parse media dependant meta info json")
        return []
    }

    let lengthInNumber = items_getLength(mediaDependant)[0] || 0

    if (!user.CurrentPosition) {
        user = { ...user }
        user.CurrentPosition = "0"
    }

    let bars = []

    //for each [P]x[/y] in userPos create a progress element
    //for example "10, S1/3" would use 10 in the standard progress bar, then create a new progress bar for S with a max of 3 and value of 1
    //"10/30, S1/3" would use the standard progress bar for 10 but override lengthInNumber with 30, then create a second bar for S with max of 3 and value of 1
    //"10 S3" would create 2 progress bars, the first uses lengthInNumber as max, the 2nd uses 0 as max, so it would be S3/0
    //"," is optional
    const parts = items_getProgressParts(user.CurrentPosition)
    for (let part of parts) {
        if (!part) continue
        let label = part[1]

        let container = document.createElement("de-progress")

        bars.push(container)

        let max =
            //if there's no label, and no total is given
            //use the mediaDependant determined length
            !label && part[3] === undefined
                ? (lengthInNumber || 0)
                : (part[3] || 0) //part[3] could be empty string

        let p = dom_getel(
            "progress",
            null,
            container.shadowRoot!
        )
        if (!p) break
        p.setAttribute("data-status", user.Status)
        if("max" in p && "value" in p) {
            p.max = parseFloat(String(max))
            p.value = parseFloat(part[2])
        }

        let c = dom_getel(
            ".entry-progressbar-position-label",
            null,
            container.shadowRoot!
        )
        if(!c) continue
        const node = document.createTextNode(`${label || ""}${part[2]}`)
        if (max) {
            node.appendData(`/${max}`)
        }
        c.append(node)

        const upHint = dom_getel(
            "#user-progress-hint",
            null,
            c
        )
        if(!upHint) continue
        upHint.innerHTML = `${(Math.round(parseFloat(part[2]) / parseInt(String(max)) * 1000) / 10) || 0}%`

        updateDeclarativeDSL(
            {
                setprogress: () => {
                    setProgressUI(forItem)
                }
            },
            settings_get(getUserUID(), "enable_unsafe"),
            findInfoEntryById(forItem),
            user,
            meta,
            container.shadowRoot!
        )
    }

    return bars
}

/**
 * Given an item id, allow the user to set the CurrentPosition of it
 * @param {bigint} forItem
*/
async function setProgressUI(forItem: bigint) {
    const user = findUserEntryById(forItem) as UserEntry
    let newEp = await promptUI("Current position", undefined, undefined, user.CurrentPosition)
    if (!newEp) return

    await api_setPos(forItem, String(newEp))
    user.CurrentPosition = String(newEp)
    updateInfo2({
        [String(forItem)]: { user }
    })
}

/**
 * Given an item id, make an <item-card> element
 * @param {bigint} forItem
 * @returns {HTMLElement}
 */
function mkItemCardUI(forItem: bigint): HTMLElement {
    const card = document.createElement("item-card");
    card.setAttribute("data-item-id", String(forItem))

    const user = findUserEntryById(forItem)
    updateDeclarativeDSL(
        {
            openitem: target => {
                openDisplayWinUI(forItem)
            }
        },
        settings_get(getUserUID(), "enable_unsafe"),
        findInfoEntryById(forItem),
        user,
        findMetadataById(forItem),
        card.shadowRoot!
    )

    const meta = findMetadataById(forItem)
    if(meta.Thumbnail) {
        const img = document.createElement("img")
        img.slot = "thumbnail"
        img.src = fixThumbnailURL(meta.Thumbnail)
        img.loading = 'lazy'
        card.append(img)
    }

    const p = mkDeProgressUI(forItem)
    p.forEach(v => v.slot = "progress")
    card.append(...p)

    settings_load(meta.Uid).then(() => {
        applyUserRating(
            settings_get(meta.Uid, "tiers"),
            user.UserRating,
            dom_getelorthrow('slot[name="rating"]', null, card.shadowRoot!)
        )
    })

    return card
}
