/**
 * Downloads data as a file in the browser
 * @param data - The content to download
 * @param name - The filename for the download
 * @param ft - The file type/mime type
 * @returns 0 on success
 */
function ua_download(data: string, name: string, ft: string): number {
    let e = document.createElement("a")
    e.download = name
    let b = new Blob([data], { type: ft })
    e.href = URL.createObjectURL(b)
    e.click()
    return 0
}

/**
 * Shows a prompt dialog to the user
 * @param prompt - The prompt message to display
 * @param _default - Optional default value for the prompt
 * @param cb - Optional callback function that receives the user's input
 */
function ui_prompt(prompt: string, _default?: string, cb?: (result: string | null) => any) {
    promptUI(prompt, _default).then(cb)
}

/**
 * Creates a new statistic in the UI
 * @param name - Name of the statistic
 * @param additive - Whether the stat is additive
 * @param calculation - The calculation function for the stat
 * @returns 0 on success
 */
function ui_createstat(name: string, additive: boolean, calculation: _StatCalculator): number {
    createStat(name, additive, calculation)
    return 0
}

/**
 * Sets the value of a statistic
 * @param name - Name of the statistic
 * @param val - Value to set
 * @returns The value that was set
 */
function ui_setstat(name: string, val: number): number {
    setResultStat(name, val)
    return val
}

/**
 * Deletes a statistic
 * @param name - Name of the statistic to delete
 * @returns true if successful, false otherwise
 */
function ui_delstat(name: string): boolean {
    return deleteStat(name)
}

/**
 * Sorts entries in the UI by a specified criteria
 * @param by - The sorting criteria
 * @returns 0 on success
 */
function ui_sort(by: string): number {
    const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement
    sortBySelector.value = by
    sortEntriesUI()
    return 0
}

/**
 * Performs a search in the UI
 * @param query - The search query
 * @param cb - Optional callback that receives the search results
 * @returns 0 on success
 */
function ui_search(query: string, cb?: (results: items_Entry[]) => any): number {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    (form.querySelector('[name="search-query"]') as HTMLInputElement).value = query

    loadSearchUI().then(() => {
        cb?.(globalsNewUi.results)
    }).catch(console.error)

    return 0
}

/**
 * Sets the current UI mode
 * @param modeName - Name of the mode to set
 * @returns 0 on success, 1 if mode is invalid
 */
function ui_setmode(modeName: string): number {
    if (!modeOutputIds.includes(modeName)) {
        return 1
        // return new Str("Invalid mode")
    }
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
 * Selects an item in the sidebar
 * @param id - The ID of the item to select (can be bigint or entry object)
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
 * Renders an item in the sidebar
 * @param id - The ID of the item to render (can be bigint or entry object)
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
 * @param id - The ID of the item to toggle (can be bigint or entry object)
 * @returns 0 if deselected, 1 if selected, 2 if item not found
 */
function ui_toggle(id: bigint | InfoEntry | MetadataEntry | UserEntry): number {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 2
    }

    if (mode_isSelected(jsId)) {
        deselectItem(entry)
        return 0
    } else {
        selectItem(entry, mode)
        return 1
    }
}

/**
 * Selects an item
 * @param id - The ID of the item to select (can be bigint or entry object)
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

    return selectItem(entry, mode)
}

/**
 * Deselects an item
 * @param id - The ID of the item to deselect (can be bigint or entry object)
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

    deselectItem(entry)
    return ""
}

/**
 * Renders an item
 * @param id - The ID of the item to render (can be bigint or entry object)
 * @returns HTMLElement on success, 1 if item not found
 */
function ui_render(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    let frag = document.createDocumentFragment()

    return selectItem(entry, mode, false, frag)
}

/**
 * Clears all items
 * @returns 0 on success
 */
function ui_clear(): number {
    clearItems()
    return 0
}

/**
 * Clears the current mode
 * @returns 0 on success, 1 if mode doesn't support clearing
 */
function ui_modeclear(): number {
    if("clear" in mode) {
        mode.clear()
        return 0
    }
    return 1
}

/**
 * Sets the user ID in the UI
 * @param newId - The new user ID
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
 * @param results - Array of InfoEntry objects
 * @returns 0 on success
 */
function ui_setresults(results: InfoEntry[]): number {
    globalsNewUi.results = results.map(v => globalsNewUi.entries[String(v.ItemId)])
    renderSidebar(results)
    return 0
}

/**
 * Gets the current search results
 * @returns Array of InfoEntry objects
 */
function ui_getresults(): InfoEntry[] {
    return globalsNewUi.results.map(v => v.info)
}

/**
 * Gets the currently selected entries
 * @returns Array of InfoEntry objects
 */
function ui_selected(): InfoEntry[] {
    return globalsNewUi.selectedEntries
}

/**
 * Adds HTML content to the current mode
 * @param html - HTML content to add (string or HTMLElement)
 * @returns Empty string on success, 1 if mode doesn't support putting content
 */
function ui_put(...html: (string | HTMLElement)[]): "" | 1 {
    if(!mode.put) {
        return 1
    }
    for(let h of html) {
        mode.put(h)
    }
    return ""
}

/**
 * Reorders items in the sidebar
 * @param ids - Array of item IDs to reorder
 * @returns 0 on success
 */
function ui_sidebarreorder(...ids: (bigint | InfoEntry | MetadataEntry | UserEntry)[]): number {
    ids = ids.map(v => typeof v === 'bigint' ? v : v.ItemId)
    reorderSidebar(ids as bigint[])
    return 0
}

/**
 * Adds a new sorting option
 * @param name - Name of the sorting option
 * @param sortFN - Sorting function
 * @returns 0 on success
 */
function ui_addsort(name: string, sortFN: ((a: InfoEntry, b: InfoEntry) => number)): number {
    const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement
    let opt = sortBySelector.querySelector(`option[value="${name}"]`) as HTMLOptionElement | null
    if(!(opt instanceof HTMLOptionElement)) {
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
 * @param name - Name of the sorting option to remove
 * @returns 1 if option not found
 */
function ui_delsort(name: string) {
    let opt = sortBySelector.querySelector(`option[value="${name}"]`)
    if(!opt) return 1
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
 * Performs a search query
 * @param query - The search query
 * @returns Promise that resolves to an array of InfoEntry objects
 */
async function aio_search(query: string): Promise<InfoEntry[]> {
    return await api_queryV3(query, getUidUI())
}

/**
 * Sets an entry in the system
 * @param entry - The InfoEntry to set
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
 * @param meta - The MetadataEntry to set
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
 * @param user - The UserEntry to set
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
