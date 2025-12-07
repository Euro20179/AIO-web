/**
 * Downloads data as a file in the browser
 * @param {string} data - The content to download
 * @param {string} name - The filename for the download
 * @param {string} ft - The file type/mime type
 * @returns 0 on success
 */
function ua_download(data: string, name: string, ft: string): number {
    let e = document.createElement("a")
    e.download = name
    let b = new Blob([data], { type: ft })
    e.href = URL.createObjectURL(b)
    e.click()
    URL.revokeObjectURL(e.href)
    return 0
}

/**
 * Sets the favicon
 * @param {string} path - the url for the favicon
 */
function ua_setfavicon(path: string) {
    let link = (document.querySelector("link[rel=\"shortcut icon\"]") || document.createElement("link")) as HTMLLinkElement
    link.setAttribute("rel", "shortcut icon")
    //prevent unecessary fetching
    if (link.href !== path) {
        link.href = path
        document.head.append(link)
    }
}

/**
 * run cb after timeout milliseconds, but restart the timer if the function is rerun.
 * @param {Function} cb
 * @param {number} timeout
 * @returns a function that can be run to start/restart the timer
 */
function util_debounce(cb: Function, timeout: number) {
    let to: number | undefined
    return function() {
        if (to) {
            clearTimeout(to)
        }
        to = setTimeout(cb, timeout)
    }
}

/**
 * sets a css property on document and if catalogWin is open, also that document
 * @param {string} property the css property to set
 * @param {string} value the value to set property to
 */
function ui_setcss(property: string, value: string): void {
    document.documentElement.style.setProperty(property, value)
    if(catalogWin) {
        catalogWin.document.documentElement.style.setProperty(property, value)
    }
}

/**
 * Shows a prompt dialog to the user
 * @param {string} prompt - The prompt message to display
 * @param {string} [_default] - Optional default value for the prompt
 * @param {function(string|null): any} [cb] - Optional callback function that receives the user's input
 */
function ui_prompt(prompt: string, _default?: string, cb?: (result: string | null) => any) {
    promptUI(prompt, _default).then(cb)
}

/**
 * Creates a new statistic in the UI
 * Side effects:
 * - puts a statistic in the statistics area
 * @param {string} name - Name of the statistic
 * @param {boolean} additive - Whether the stat is additive
 * @param {StatCalculator} calculation - The calculation function for the stat
 * @returns 0 on success
 */
function ui_createstat(name: string, additive: boolean, calculation: StatCalculator): number {
    createStatUI(name, additive, calculation)
    return 0
}

/**
 * Sets the value of a statistic
 * @param {string} name - Name of the statistic
 * @param {number} val - Value to set
 * @returns The value that was set
 */
function ui_setstat(name: string, val: number): number {
    setResultStatUI(name, val)
    return val
}

/**
 * Deletes a statistic
 * Side effects:
 * - removes the statistic from the statistics area
 * @param {string} name - Name of the statistic to delete
 * @returns true if successful, false otherwise
 */
function ui_delstat(name: string): boolean {
    return deleteStatUI(name)
}

/**
 * Sorts entries in the UI by a specified criteria
 * Side effects:
 * - clears all selected items
 * - reorders the sidebar
 * - selects the first item in the sidebar
 * @param {string} by - The sorting criteria
 * @returns 0 on success
 */
function ui_sort(by: string): number {
    const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement
    sortBySelector.value = by
    sortEntriesUI()
    return 0
}

/**
 * Performs a search in the UI using search-v3
 * Side effects:
 * - fills the search bar with query
 * - clears selected items
 * - refills the sidebar with the new results
 * - uses the sort-by select element for sorting
 * @param {string} query - The search query
 * @param {function(items_Entry[]): any} [cb] - Optional callback that receives the search results
 * @returns 0 on success
 */
function ui_search(query: string, cb?: (results: items_Entry[]) => any): number {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    (form.querySelector('[name="search-query"]') as HTMLInputElement).value = `3 ${query}`

    loadSearchUI().then(() => {
        cb?.(items_getResults())
    }).catch(console.error)

    return 0
}

/**
 * Sets the current UI mode
 * @param {string} modeName - Name of the mode to set
 * @returns 0 on success, 1 if mode is invalid
 */
function ui_setmode(modeName: string): number {
    // if (!modeOutputIds.includes(modeName)) {
    //     return 1
    //     // return new Str("Invalid mode")
    // }
    mode_setMode(modeName)
    return 0
}

/**
 * Clears the sidebar
 * @returns 0 on success
 */
function ui_sidebarclear(): number {
    clearSidebar()
    return 0
}

/**
 * Renders an item in the sidebar (duplicates allowed)
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to select (can be bigint or entry object)
 * @returns 0 on success, 1 if item not found
 */
function ui_sidebarselect(id: bigint | InfoEntry | MetadataEntry | UserEntry): number {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    renderSidebarItem(entry)
    return 0
}

/**
 * Renders a sidebar-entry, and returns the resulting element
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to render (can be bigint or entry object)
 * @returns HTMLElement on success, 1 if item not found
 */
function ui_sidebarrender(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }
    let frag = document.createDocumentFragment()
    return renderSidebarItem(entry, frag, { renderImg: true })
}

/**
 * Toggles the selection state of an item
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to toggle (can be bigint or entry object)
 * @returns 0 if deselected, 1 if selected, 2 if item not found
 */
function ui_toggle(id: bigint | InfoEntry | MetadataEntry | UserEntry): number {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 2
    }

    if (mode_isSelected(jsId)) {
        mode_deselectItem(entry)
        return 0
    } else {
        mode_selectItem(entry)
        return 1
    }
}

/**
 * Selects an item
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to select (can be bigint or entry object)
 * @returns HTMLElement on success, 1 if item not found, 2 if already selected
 */
function ui_select(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | 2 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    if (mode_isSelected(jsId)) {
        return 2
    }
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    return mode_selectItem(entry)[0]
}

/**
 * Deselects an item
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to deselect (can be bigint or entry object)
 * @returns Empty string on success, 1 if item not found, 2 if not selected
 */
function ui_deselect(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | 2 | "" {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    if (!mode_isSelected(jsId)) {
        return 2
    }
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    mode_deselectItem(entry)
    return ""
}

/**
 * Renders a display-entry, and returns the resulting element
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to render (can be bigint or entry object)
 * @returns HTMLElement on success, 1 if item not found
 */
function ui_render(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    let frag = document.createDocumentFragment()

    const m = new Mode(frag)

    return mode_selectItem(entry, false, m)[0]
}

/**
 * Clears all items
 * @returns 0 on success
 */
function ui_clear(): number {
    mode_clearItems()
    return 0
}

/**
 * Clears the current mode (including anything added with ui_put())
 * @returns 0 on success, 1 if mode doesn't support clearing
 */
function ui_modeclear(): number {
    let valid = 1
    for (let mode of openViewModes) {
        if ("clear" in mode) {
            //@ts-ignore
            mode.clear()
            valid = 0
        }
    }
    return valid
}

/**
 * runs ui_clear() and ui_modeclear() to clear all items, and nodes put by ui_put()
 * @returns an array of the results from ui_clear(), and ui_modeclear()
 */
function ui_clearall(): [number, number] {
    return [ui_clear(), ui_modeclear()]
}

/**
 * Sets the user ID in the UI
 * Side effects:
 * - sets the uid select element to the new uid
 * @param {string} newId - The new user ID
 * @returns The new user ID
 */
function ui_setuid(newId: string): string {
    setUIDUI(newId)
    return newId
}

/**
 * Gets the current user ID from the UI
 * @returns The current user ID as a number
 */
function ui_getuid(): number {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement
    return Number(uidSelector.value)
}

/**
 * Sets the search results in the UI
 * Side effects:
 * - re-renders the sidebar
 * - clears selected items
 * - selects the first item from the sidebar
 * @param {InfoEntry[]} results - Array of InfoEntry objects
 * @returns 0 on success
 */
function ui_setresults(results: InfoEntry[]): number {
    items_setResults(results.map(v => v.ItemId))
    renderSidebar(results)
    return 0
}

/**
 * Gets the current search results
 * @returns Array of InfoEntry objects
 */
function ui_getresults(): InfoEntry[] {
    return items_getResults().map(v => v.info)
}

/**
 * Gets the currently selected entries
 * @returns Array of InfoEntry objects
 */
function ui_selected(): InfoEntry[] {
    return items_getSelected()
}

/**
 * Adds HTML content to the current mode
 * Side effects:
 * - ONLY clearable with ui_modeclear()
 * @param {...(string|HTMLElement)} html - HTML content to add (string or HTMLElement)
 * @returns Empty string on success, 1 if mode doesn't support putting content
 */
function ui_put(...html: (string | HTMLElement)[]): "" | 1 {
    for (let mode of openViewModes) {
        if (!mode.put) {
            continue
        }
        for (let h of html) {
            mode.put(h)
        }
    }
    return ""
}

/**
 * Reorders items in the sidebar
 * Side effects:
 * - clears selected entries
 * - selects the new first item in the sidebar
 * @param {...(bigint|InfoEntry|MetadataEntry|UserEntry)} ids - Array of item IDs to reorder
 * @returns 0 on success
 */
function ui_sidebarreorder(...ids: (bigint | InfoEntry | MetadataEntry | UserEntry)[]): number {
    ids = ids.map(v => typeof v === 'bigint' ? v : v.ItemId)
    reorderSidebar(ids as bigint[])
    return 0
}

/**
 * Adds a new sorting option
 * Side effects:
 * - adds the new option to the sort-by element
 * @param {string} name - Name of the sorting option
 * @param {function(InfoEntry,InfoEntry): number} sortFN - Sorting function
 * @returns 0 on success
 */
function ui_addsort(name: string, sortFN: ((a: InfoEntry, b: InfoEntry) => number)): number {
    const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement
    let opt = sortBySelector.querySelector(`option[value="${name}"]`) as HTMLOptionElement | null
    if (!(opt instanceof HTMLOptionElement)) {
        opt = document.createElement("option") as HTMLOptionElement
    }
    items_addSort(name, sortFN)
    opt.value = name
    opt.innerText = name
    sortBySelector.append(opt)
    return 0
}

/**
 * Removes a sorting option
 * Side effects:
 * - removes the option from the sort-by element
 * @param {string} name - Name of the sorting option to remove
 * @returns 1 if option not found
 */
function ui_delsort(name: string) {
    let opt = sortBySelector.querySelector(`option[value="${name}"]`)
    if (!opt) return 1
    opt.remove()
    items_delSort(name)
}

/**
 * Prompts the user to select an item
 * @returns Promise that resolves to the selected item
 */
async function ui_askitem() {
    return await selectItemUI()
}

/**
 * Sets the error text
 * <i>hint: to clear the error, pass ""</i>
 * @param {string} err - The error text
 */
function ui_seterr(err: string): void {
    setError(err)
}


/**
 * An alias for addUserScriptUI
 */
function ui_newscript() {
    //@ts-ignore
    addUserScriptUI(...arguments)
}

/**
 * <del>Performs a search query</del>
 * <ins>Use api_queryV3 instead</ins>
 * @param {string} query - The search query
 * @returns Promise that resolves to an array of InfoEntry objects
 * @deprecated
 */
async function aio_search(query: string): Promise<InfoEntry[]> {
    return await api_queryV3(query, getUidUI())
}

/**
 * Sets an entry in the system
 * @param {InfoEntry} entry - The InfoEntry to set
 * @returns Promise that resolves to true if successful, false otherwise
 */
async function aio_setentry(entry: InfoEntry): Promise<boolean> {
    let res = await api_setItem("", entry)
    if (res?.status !== 200) {
        return false
    }
    updateInfo2({
        [String(entry.ItemId)]: { info: entry }
    })
    return true
}

/**
 * Sets metadata for an entry
 * @param {MetadataEntry} meta - The MetadataEntry to set
 * @returns Promise that resolves to true if successful, false otherwise
 */
async function aio_setmeta(meta: MetadataEntry): Promise<boolean> {
    let res = await api_setItem("metadata/", meta)
    if (res?.status !== 200) {
        return false
    }
    updateInfo2({
        [String(meta.ItemId)]: {
            meta: meta
        }
    })
    return true
}

/**
 * Sets a user entry
 * @param {UserEntry} user - The UserEntry to set
 * @returns Promise that resolves to true if successful, false otherwise
 */
async function aio_setuser(user: UserEntry): Promise<boolean> {
    const res = await api_setItem("engagement/", user)
    if (res?.status !== 200) {
        return false
    }
    updateInfo2({
        [String(user.ItemId)]: {
            user: user
        }
    })
    return true
}

/**
 * Deletes an entry
 * Side effects:
 * - removes item from sidebar
 * - removes item from global entries map
 * - clears selected items
 * - selects the new first item in the sidebar
 * @param {bigint} item - the item id to delete
 * @returns 1 on failure to delete else 0
 */
async function aio_delete(item: bigint) {
    const res = await api_deleteEntry(item)
    if (!res || res.status !== 200) {
        return 1
    }
    removeSidebarItem(findInfoEntryById(item))
    items_delEntry(item)
    mode_clearItems()
    sidebarSelectNth(1)
    return 0
}
