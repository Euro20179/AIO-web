/*
 * This file is for functions that should be called by the ui to handle api operations
 * with client-side inputs
*/

type StartupUIComponents = {
    newWindow: HTMLElement,
    viewToggle: HTMLSelectElement,
    viewAllElem: HTMLInputElement,
    statsOutput: HTMLElement,
    itemFilter: HTMLInputElement,
    newEntryLibrarySelector: HTMLSelectElement,
    librarySelector: HTMLSelectElement,
    userSelector: HTMLSelectElement,
    sortBySelector: HTMLSelectElement,
    errorOut: HTMLElement,
    searchForm: HTMLFormElement,
    recommenders: HTMLDataListElement,
    newItemForm: HTMLFormElement,
    promptDialog: HTMLDialogElement,
    sidebarItems: HTMLElement

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
    sortBySelector,
    statsOutput,
    newItemForm,
    sidebarItems,
}: typeof components) {

    for (let key in arguments[0]) {
        components[key as keyof StartupUIComponents] = arguments[0][key]
    }

    if (components['itemFilter'] && !(components["itemFilter"] instanceof HTMLInputElement)) {
        throw new Error("item filter must be an <input>")
    }

    if (!(components["viewToggle"] instanceof HTMLSelectElement)) {
        throw new Error("view toggle must be a <select>")
    }

    if (!(components["newEntryLibrarySelector"] instanceof HTMLSelectElement)) {
        throw new Error("new entry's library selector must be a select element")
    }

    if (!(components["librarySelector"] instanceof HTMLSelectElement)) {
        throw new Error("library selector must be a select element")
    }

    // if (!(components["userSelector"] instanceof HTMLSelectElement)) {
    //     throw new Error("user uid selector must be a select element")
    // }

    if (!(components["sortBySelector"] instanceof HTMLSelectElement)) {
        throw new Error("sort by selector must be a select element")
    }

    if (!(components["promptDialog"] instanceof HTMLDialogElement)) {
        throw new Error("prompt dialog must be a dialog element")
    }

    if (!(sidebarItems)) {
        throw new Error("ui cannot function without a sidebar")
    }

    //@ts-ignore
    components['sidebarUI'] = new SidebarMode(sidebarItems)


    if (statsOutput) {
        statistics.push(new Statistic("results", false, () => getFilteredResultsUI().length))
        statistics.push(new Statistic("totalCost", true, (item, mult) => item.PurchasePrice * mult))

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
        mode_setMode((e.target as HTMLSelectElement).value, (catalogWin || window) as Window & typeof globalThis)
    })

    librarySelector?.addEventListener("change", function() {
        let val = librarySelector.value
        items_setCurrentLibrary(BigInt(val))

        loadSearchUI()
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
        const title = getElementOrThrowUI('[name="title"]', HTMLInputElement, newItemForm)
        newItemForm.oninput = function() {
            const location = getElementOrThrowUI('[name="location"]', HTMLInputElement, newItemForm)
            if (typeof settings.location_generator === 'string') {
                location.value = settings.location_generator.replaceAll("{}", title.value)
            } else if (typeof settings.location_generator === 'function') {
                const info = new FormData(newItemForm)
                location.value = settings.location_generator(Object.fromEntries(info.entries().toArray()) as any)
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
                mode_clearItems(false)
            } else {
                mode_clearItems()
                for (let mode of openViewModes) {
                    mode_selectItemList(getFilteredResultsUI(), true, mode)
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
            const mode = mode_getFirstModeInWindow(catalogWin || window)
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
 * calls: loadLibraries(), loadInfoEntries(), loadUserEvents(), items_refreshMetadata()
 * only returns the result of [loadUserEvents, items_refreshMetadata]
 * side effects:
 * - causes items' state to be set
 * - fills the library dropdown
 * - sets the error to "Loading items", then ""
 * - updates all loaded entries
 * @returns {Promise<[Awaited<ReturnType<typeof loadUserEvents>>, Awaited<ReturnType<typeof items_refreshMetadata>>]>}
 */
async function refreshInfoUI(uid: number): Promise<[Awaited<ReturnType<typeof loadUserEvents>>, Awaited<ReturnType<typeof items_refreshMetadata>>]> {
    await Promise.all([
        loadLibraries(uid),
        loadInfoEntries(uid),
    ])
    return Promise.all([
        loadUserEvents(uid),
        items_refreshMetadata(uid)
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
    updateLibraryDropdown()
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
    return catalogWin?.document || document
}

/**
 * gets the current window (either catalog, or main window)
 * @returns {Window & typeof globalThis}
 */
function currentWindow(): Window & typeof globalThis {
    return catalogWin?.document.defaultView || window
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
        items = items.filter(v => String(v.info.Library) === ls.value)
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
    const search = getElementOrThrowUI("[name=\"search-query\"]", HTMLInputElement, components.searchForm)

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
    const search = getElementOrThrowUI('[name="search-query"]', HTMLInputElement, components.searchForm)
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
})

registerCTRLShortcutUI("D", e => {
    setDisplayModeUI()
    e.preventDefault()
})

for (let i = 0; i < 10; i++) {
    registerCTRLShortcutUI(String(i), e => {
        let event = e as KeyboardEvent
        mode_clearItems()
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
                if (!e.shiftKey) mode_clearItems()
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
    const scriptSelect = getElementOrThrowUI("#script-select", HTMLElement)

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
async function promptUI(html?: string, _default?: string, uselist?: string, defaultValue: string = ""): Promise<string | null> {
    const pEl = components["promptDialog"]
    if (!pEl) {
        const parser = new DOMParser
        const doc = parser.parseFromString(html || "", "text/html")
        html = doc.documentElement.outerText
        return prompt(html, _default) || defaultValue
    }

    const close = pEl.querySelector("button:first-child") as HTMLButtonElement
    const root = pEl.querySelector("[root]") as HTMLDivElement
    const submission = pEl.querySelector('[name="prompt-value"]') as HTMLInputElement
    submission.value = defaultValue

    if (uselist)
        submission.setAttribute("list", uselist)
    else
        submission.removeAttribute("list")

    root.innerHTML = html || "<p>prompt</p>"
    pEl.showModal()
    return await new Promise((res) => {
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
  * Shows a confirmation dialogue
  * If the user clicks ok, resolve with true
  * otherwise reject with true
  * @param html {string} the html to put in the confirmation box
  */
async function confirmUI(html: string) {
    const cEl = getElementOrThrowUI("#confirm", currentWindow().HTMLDialogElement)
    const close = cEl.querySelector("button:first-child") as HTMLButtonElement
    const cancel = getElementOrThrowUI("#cancel", currentWindow().HTMLButtonElement, cEl)
    const ok = getElementOrThrowUI("#ok", currentWindow().HTMLButtonElement, cEl)
    const root = getElementOrThrowUI("[root]", currentWindow().HTMLElement, cEl)
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
 * Gets an element by a query selector that's an instanceof {requiredType}
 * If such an element is not found, null is returned
 *
 * @param selector passed to root.querySelector
 * @param [requiredType=null] The type the found element must be
 * @param [root=null] The root document, (default is currentDocument())
 * @reutrns {Element | null}
 */
function getElementUI<T extends typeof Element>(
    selector: string,
    requiredType: T | null = null,
    root: { querySelector(selector: string): Element | null } | null = null
): InstanceType<T> | null {
    let el = (root || currentDocument()).querySelector(selector)
    if (!el || (requiredType && !(el instanceof (requiredType as T)))) return null
    return el as InstanceType<T>
}

/**
 * attempts to find an element of a certain type with a query selector within a container
 * if the element is not found, throw an error
 * @template T - an HTMLElement constructor (must be HTMLElement iself or a subclass)
 * @param {string} selector
 * @param {T | null} [requiredType=null] - the type the found element must be
 * @param [root=null] - the root (defaults to currentDocument()) (may also just be anything with a querySelector implementation)
 * @returns {T}
 */
function getElementOrThrowUI<T extends typeof HTMLElement>(
    selector: string,
    requiredType: T | null = null,
    root: { querySelector(selector: string): HTMLElement | null } | null = null
): InstanceType<T> {
    let el = getElementUI(selector, requiredType, root)
    if (!(el)) {
        throw new Error(`Element: ${selector} was not found`)
    }
    return el
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
function openModalUI(
    modalName: string,
    root?: {
        querySelector(query: string): HTMLElement | null
    }
): HTMLDialogElement | null {
    const modal = getElementUI(`#${modalName}`, HTMLDialogElement, root)
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
    }
) {
    getElementUI(`#${modalName}`, HTMLDialogElement, root)?.close()
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
    let dialog = getElementUI(`#${modalName}`, HTMLDialogElement, root)
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
    mode_clearItems()
    components['sidebarUI']?.reorder(getFilteredResultsUI().map(v => v.ItemId))
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
    let form = components.searchForm
    if (!form) throw new Error("No search form found")
    let data = new FormData(form)
    return data
}

/**
 * Akin to the user submitting the search form
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
 */
async function loadSearchUI() {
    let form = components.searchForm
    if (!form) throw new Error("No search form found")

    let formData = new FormData(form)

    let filters = parseClientsideSearchFiltering(formData)

    let entries = filters.useV4
        ? await api_queryV4(
            String(filters.newSearch) || "%",
            Number(formData.get('uid')) || 0,
            filters.sortBy as SortKind
        )
        : await api_queryV3(
            String(filters.newSearch) || "#",
            Number(formData.get("uid")) || 0,
            filters.sortBy as SortKind
        )

    entries = applyClientsideSearchFiltering(entries, filters)

    setResultStatUI("results", entries.length)

    items_setResults(entries.map(v => v.ItemId))

    mode_clearItems()
    if (entries.length === 0) {
        setError("No results")
        components['sidebarUI']?.clearSelected()
        const g = genericInfo(0n, 0)
        g.En_Title = "No Results"
        renderFakeSidebarItem(g, components['sidebarUI']?.output || document.createDocumentFragment())
    } else components['sidebarUI']?.render(getFilteredResultsUI(), false)
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
        .then(() => {
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
        })
}

/**
 * updates the librarySelector component's options by getting all libraries
 * and creating an option for each one
 */
function updateLibraryDropdown() {
    components.librarySelector && (components.librarySelector.innerHTML = '<option value="0">Library</option>')
    components.newEntryLibrarySelector && (components.newEntryLibrarySelector.innerHTML = '<option value="0">Library</option>')
    const libraries = items_getLibraries()
    for (let i in libraries) {
        let item = libraries[i]
        const opt = document.createElement("option")
        opt.value = String(item["ItemId"])
        opt.innerText = item["En_Title"]
        components.librarySelector && components.librarySelector.append(opt)
        components.newEntryLibrarySelector && components.newEntryLibrarySelector.append(opt.cloneNode(true))
    }
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

    let useV4 = true
    if (search.startsWith("3")) {
        useV4 = false
        search = search.slice(1).trimStart()
    }

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
        useV4
    }
}

/**
 * Given a list of entries, and filters, apply the filters to the list of entries
 * and return the new list
 * @param {InfoEntry[]} entries
 * @param {ClientSearchFilters} filters
 * @returns {InfoEntry[]}
 */
function applyClientsideSearchFiltering(entries: InfoEntry[], filters: ClientSearchFilters): InfoEntry[] {

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
            entries = entries.filter(v => {
                let e = items_getEntry(v.ItemId)
                return !e.relations.isChild()
            })
        } else if (filter === "!copy") {
            entries = entries.filter(v => items_getEntry(v.ItemId).relations.isCopy())
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
 * Opens the new-event-form dialog fills the itemid input element with {itemid}
 * @param {string} itemid the item id to add the event to
 */
function openEventFormUI(itemid: string) {
    const modal = openModalUI("new-event-form")
    if (!modal) return

    const form = modal.querySelector("form")
    if (!form) return

    const itemidEl = getElementOrThrowUI('[name="itemid"]', HTMLInputElement, form)
    itemidEl.value = itemid
}



/**
 * Creates an event based on a form
 * Side effects:
 * - assuming the form is within a popover, hide it
 * - reloads events
 */
function newEventUI(form: HTMLFormElement) {
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
 * @param {HTMLFormElement} form - the form to use for creating an entry
 */
async function newEntryUI(form: HTMLFormElement) {
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

/**
 * does a search, and fills the item listing with the results
 * @param {string} - search query
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
    const itemsFillDiv = getElementOrThrowUI("#put-items-to-select", HTMLElement)
    itemsFillDiv.innerHTML = ""

    const container = document.createElement("div")
    container.classList.add("grid")
    container.classList.add("center")
    container.style.gridTemplateColumns = "1fr 1fr 1fr"

    for (let id in items) {
        let el = items[id]
        if (el.tagName !== "FIGURE") {
            const f = document.createElement("figure")
            f.append(el)
            el = f
        }
        el.setAttribute("data-item-id", id)
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
    const itemsFillDiv = getElementOrThrowUI("#put-items-to-select", HTMLElement)
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

/**
 * Replaces the input element's value with a user chosen item
 * if the user doesn't select anything, the value is set to "0"
 * @param {HTMLInputElement} input
 */
async function replaceValueWithSelectedItemIdUI(input: HTMLInputElement) {
    let item = await selectItemUI()
    const popover = getElementOrThrowUI("#items-listing", HTMLDialogElement)
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
 * @param {SelectItemOptions} [options]
 * @returns {Promise<null | bigint>}
*/
async function selectItemUI(options?: SelectItemOptions): Promise<null | bigint> {
    const popover = getElementOrThrowUI("#items-listing", HTMLDialogElement)


    let f = getElementOrThrowUI("#items-listing-search", HTMLFormElement)
    let query = getElementOrThrowUI('[name="items-listing-search"]', HTMLInputElement, f)

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
        function registerFigClickEvents(container: HTMLElement) {
            for (let fig of container.querySelectorAll("figure")) {
                const id = fig.getAttribute("data-item-id")
                fig.onclick = () => {
                    popover.close(id as string)
                }
            }
        }
        popover.onclose = function() {
            if (popover.returnValue) {
                res(BigInt(popover.returnValue))
            } else res(null)
        }
        f.onsubmit = function() {
            onsearch(query.value).then(registerFigClickEvents)
        }
        registerFigClickEvents(container)
    })
}

/**
 * Opens the sign in ui to let the user sign in, with an optional reason to sign in shown to the user
 * @param {string} reason
 * @returns {Promise<string>} the login token
 */
async function signinUI(reason: string): Promise<string> {
    const loginPopover = getElementOrThrowUI("#login", HTMLDialogElement)

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
        const form = getElementOrThrowUI("#login-form", HTMLFormElement, loginPopover)
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

/**
 * checks if the catalog window is open
 * @returns {boolean}
 */
function isCatalogModeUI(): boolean {
    return catalogWin !== null
}

/**
 * opens the catalog window
 */
function openCatalogModeUI() {
    let mainUI = document.getElementById("main-ui")
    if (!mainUI || mainUI.classList.contains("catalog-mode")) return

    let urlParams = new URLSearchParams(location.search)
    urlParams.set("display", "true")
    urlParams.set("no-select", "true")
    urlParams.set("no-startup", "true")
    urlParams.set("no-mode", "true")
    const newURL = `${location.origin}${location.pathname}?${urlParams.toString()}${location.hash}`
    catalogWin = open(newURL, "_blank", "popup=true")
    if (catalogWin) {
        catalogWin.addEventListener("beforeunload", () => {
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

/**
 * closes the catalog window
 */
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

type StartupLang = "javascript" | "aiol" | ""
/**
 * Do a user startup script
 * should only be called if the current uid matches the logged in user uid
 * otherwise we will load random people's settings :)
 * @param {UserSettings} settings
 */
function doUserStartupUI(settings: UserSettings) {
    const script = settings.UIStartupScript
    const lang = settings.StartupLang

    for (let key in settings) {
        if (key.startsWith("template-")) {
            if (!settings[key as keyof typeof settings]) continue
            const tmpl = key.split("template-")[1]
            const tmplEl = currentDocument().getElementById(tmpl)
            if (!tmplEl) continue
            tmplEl.innerHTML = settings[key as keyof typeof settings]
        }
    }

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

/**
 * Gets the settings for a user
 * @param {number} uid
 * @returns {Promise<UserSettings>}
 */
async function getSettings(uid: number): Promise<UserSettings> {
    let res = await authorizedRequest(`${location.protocol}//${location.host}/settings/get?uid=${uid}`)
    if (res === null || res.status !== 200) {
        console.error(res?.status)
        return { UIStartupScript: "", StartupLang: "" }
    }
    const t = await res.text()
    return JSON.parse(t) as UserSettings
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
        //@ts-ignore
        parent = root.getElementById(toPop)
    }
    if (!parent) return

    popoutTarget.onclick = async function() {
        const win = await popupUI()
        if (!win) return
        win.document.write(`<!DOCTYPE html>
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
<div style='float: right; align-content: center;' class='flex' id='settings'>
    <button class="popout" style='float: right;'>✗</button>
</div>
</body>`)

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

        const closePopout = getElementUI("button.popout", win.self.HTMLElement, win.document.body)
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

/**
 * Update the PurchasePrice field of an item (on the server and clientside)
 * @param {bigint} itemId
 * @param {string | null} [newPrice=null] if not given, prompt the user
 */
async function updateCostUI(itemId: bigint, newPrice: number | null = null) {
    newPrice ||= await promptNumber("New cost", "not a number", parseFloat)
    if (newPrice === null) return

    return await setPropUI(findInfoEntryById(itemId), "PurchasePrice", newPrice, "Update purchase price")
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
        newTags = await promptUI("Tag name (, seperated)")
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
 * Creates a popup window, attempts to use dPiP.requestWindow, falls back to open()
 * @param {DocumentPictureInPictureOptions} [pipOptions={}] options to give dPiP if dPiP is supported
 * @returns {Promise<Window | null>}
 */
async function popupUI(pipOptions = {}): Promise<Window | null> {
    let win: Window
    if (window.documentPictureInPicture) {
        win = await documentPictureInPicture.requestWindow(pipOptions)
    } else {
        win = open("", "_blank", "popup=true")
    }
    return win
}
