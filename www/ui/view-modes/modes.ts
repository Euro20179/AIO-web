interface Mode {
    output: HTMLElement | DocumentFragment
    win: Window & typeof globalThis
    container: HTMLElement | null
    NAME: string
    add(entry: InfoEntry): HTMLElement
    sub(entry: InfoEntry): any
    addList(entry: InfoEntry[]): any
    subList(entry: InfoEntry[]): any
    ///Responsible for removing the open class from the output element
    //and also clearing the selected items (clearSelected())
    close(): any
    clearSelected(): any
    mkcontainer(): HTMLElement
    //responsible for creating the container, output, and putting them on the page
    mkcontainers(into: HTMLElement | DocumentFragment): {output: HTMLElement, container: HTMLElement }
    chwin(win: Window & typeof globalThis): HTMLElement
    refresh?(id: bigint): any
    put?(html: string | HTMLElement | ShadowRoot): any
    clear?(): any
}

const ModePrimitives = {
    setup(this: Mode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis, containerPlacement?: HTMLElement | DocumentFragment) {
        this.win = win ||= window
        let c = null
        if(!output) {
            ({output, container: c} = this.mkcontainers(containerPlacement || getElementOrThrow("#viewing-area", null, this.win.document)))
        }
        this.output = output
        this.container = c
    },
    chwin(this: Mode, win: Window & typeof globalThis): HTMLElement {
        if (this.win !== window) {
            this.win.close()
        }

        if (this.container) {
            this.container.remove()
        }

        this.win = win

        let { output: newOutput, container } = this.mkcontainers(getElementOrThrow("#viewing-area", null, this.win.document))
        const imported = win.document.importNode(this.output, true)
        newOutput.replaceChildren(...imported.childNodes)
        this.output = newOutput
        this.container = container

        return container
    }
}

let openViewModes: Mode[] = []

/**
 * Given an object of item ids to update, and new values for {info, user, meta, events} for that item
 * update the state for that item to have the new values.
 *
 * dispatches the modes.update-item event which may trigger other things to happen

 * @param {Record<string, Partial<{user: UserEntry, events: UserEvent[], meta: MetadataEntry, info: InfoEntry}>>} toUpdate a record containing the item ids to update with their values
 * @param {boolean} [del=false] if the items should be deleted
 */
function updateInfo2(toUpdate: Record<string, Partial<{ user: UserEntry, events: UserEvent[], meta: MetadataEntry, info: InfoEntry }>>, del: boolean = false) {
    let updatedLibraries = false
    for (let id in toUpdate) {
        if (del) {
            items_delEntry(BigInt(id))
            continue
        }

        const { user, events, meta, info } = toUpdate[id]

        if (info?.Type === "Library") {
            if (del)
                delete items_getLibraries()[id]
            else
                items_setLibrary(info)

            updatedLibraries = true
        }

        dispatchEvent(new CustomEvent("modes.update-item", {
            detail: id
        }))

        items_updateEntryById(id, { user, events, meta, info })

        refreshItemUI(BigInt(id))

        for (let parent of items_getEntry(BigInt(id)).relations.findParents()) {
            //if the parent is this, or itself, just dont update
            if (parent !== BigInt(id)) {
                updateInfo2({
                    [String(parent)]: {
                        info: findInfoEntryById(parent),
                        user: findUserEntryById(parent),
                        events: findUserEventsById(parent),
                        meta: findMetadataById(parent)
                    }
                })
            }
        }
    }

    if (updatedLibraries) {
        updateLibraryDropdown()
    }
}


/**
 * Given a window, get the first mode in the list of openViewModes that is
 * being displayed in that window
 * @param {Window} win
 * @returns {Mode | undefined}
 */
function mode_getFirstModeInWindow(win: Window): Mode | undefined {
    for (let mode of openViewModes) {
        if (mode.win === win) {
            return mode
        }
    }
}

/**
 * Check if an item id is selected
 * @param {bigint} id
 * @returns {boolean}
 */
function mode_isSelected(id: bigint): boolean {
    for (let item of items_getSelected()) {
        if (item.ItemId === id) {
            return true
        }
    }
    return false
}

/**
 * Makes a mode display in a different window
 * @param {Window & typeof globalThis} newWin
 * @param {Mode} mode
 */
function mode_chwin(newWin: Window & typeof globalThis, mode: Mode) {
    const refresh = () => {
        for (let item of items_getSelected()) {
            refreshItemUI(item.ItemId)
        }
    }
    if (newWin === window) {
        if (mode.chwin) {
            mode.chwin(window)
            refresh()
        }
    }
    else {
        newWin.addEventListener("DOMContentLoaded", () => {
            mode.chwin?.(newWin)
            newWin.self.addEventListener("aio-items-rendered", () => {
                refresh()
            })
        })
    }
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
function mode_selectItem(item: InfoEntry, updateStats: boolean = true, mode?: Mode): HTMLElement[] {
    setError("")

    items_selectById(item.ItemId)
    updateStats && changeResultStatsWithItemUI(item)
    updatePageInfoWithItemUI(item)
    if (mode)
        return [mode.add(item)]
    else {
        const elems = []
        for (const mode of openViewModes) {
            elems.push(mode.add(item))
        }
        return elems
    }
}
//just in case
const selectItem = mode_selectItem

/**
 * Deselects an item
 * side effects:
 * - update stats (if updateStats is true)
 * - sets error to "No items selected" if no items are selected
 * @param {InfoEntry} item
 * @param {boolean} [updateStats=true]
 */
function mode_deselectItem(item: InfoEntry, updateStats: boolean = true) {
    items_deselectById(item.ItemId)
    updateStats && changeResultStatsWithItemUI(item, -1)
    for (let mode of openViewModes) {
        mode.sub(item)
    }

    if (items_getSelected().length === 0) {
        setError("No items selected")
    }
}
//just in case
const deselectItem = mode_deselectItem

/**
 * Selects a list of items to be selected within {mode} or all openViewModes if not given
 * side effects:
 * - updates stats (if updateStats is true)
 * @param {InfoEntry[]} itemList
 * @param {boolean} [updateStats=true]
 * @param {Mode} [mode=undefined]
 */
function mode_selectItemList(itemList: InfoEntry[], updateStats: boolean = true, mode?: Mode) {
    if (itemList.length !== 0)
        setError("")
    items_setSelected(items_getSelected().concat(itemList))
    updateStats && changeResultStatsWithItemListUI(itemList)
    if (itemList.length)
        updatePageInfoWithItemUI(itemList[0])
    if (mode) {
        mode.addList(itemList)
    } else {
        for (let mode of openViewModes) {
            mode.addList(itemList)
        }
    }
}
//just in case
const selectItemList = mode_selectItemList

/**
 * Toggle the selectedness of an item
 * side effects:
 * - updates stats (if updateStats is true)
 * @param {InfoEntry} item
 * @param {boolean} [updateStats=true]
 */
function mode_toggleItem(item: InfoEntry, updateStats: boolean = true) {
    if (items_getSelected().find(a => a.ItemId === item.ItemId)) {
        mode_deselectItem(item, updateStats)
        //by definition we are no longer viewing everything
        setViewingAllUI(false)
    } else {
        mode_selectItem(item, updateStats)
    }
}
//just in case
const toggleItem = mode_toggleItem

/**
 * Clears selected items within a mode
 * also updates stats
 *
 * @see ui_modeclear(), which clears miscellanious nodes from modes
 */
function mode_clearItems(updateStats: boolean = true) {
    setError("No items selected")
    items_clearSelected()
    for (const mode of openViewModes) {
        mode.clearSelected()
    }
    updateStats && resetStatsUI()
}

//just in case
const clearItems = mode_clearItems

const mode_map = () => new Map<string, (output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) => void>([
    ["entry-output", DisplayMode],
    ["graph-output", GraphMode],
    ["calc-output", CalcMode],
    ["gallery-output", GalleryMode],
    ["script-output", ScriptMode],
    ["event-output", EventMode],
    ["calendar-output", CalendarMode],
    ["tierlist-output", TierListMode],
    ["sidebar-items", SidebarMode],
])

/**
 * Given a mode name, convert it to a mode class
 * @param {string} name
 * @returns {Function}
 */
function mode_name2cls(name: string): Function {
    let ogName = name
    name = {
        "entry": "entry-output",
        "graph": "graph-output",
        "calc": "calc-output",
        "gallery": "gallery-output",
        "script": "script-output",
        "event": "event-output",
        "calendar": "calendar-output",
        "tierlist": "tierlist-output",
        "sidebar": "sidebar-items",
    }[name] || name
    let val = mode_map().get(name)
    if(!val) {
        throw new Error(`${ogName} is not a mode`)
    }
    return val
}

/**
 * Given a mode class, convert it to it's name
 * @param {(output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) => void} cls
 * @returns string
 */
function mode_cls2name(cls: (output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) => void): string {
    let map = new Map(mode_map().entries().map(([k, v]: any) => [v, k]))
    return map.get(cls)
}

//this should ONLY operate within the user specified or current window otherwise it makes no sense
/**
 * Given a mode name, and window, close all open modes within that window, and open the {name} mode
 * @param {string} name
 * @param {Window & typeof globalThis} [win=window]
 */
function mode_setMode(name: string, win: Window & typeof globalThis = window) {
    const newMode = mode_name2cls(name)
    if(!newMode) return

    try {
        let newModes = []
        for (const mode of openViewModes) {
            if (mode.win === win) {
                mode.close()
            } else {
                newModes.push(mode)
            }
        }
        openViewModes = newModes
        const m = new (newMode as any)(undefined, win)
        openViewModes.push(m as Mode)
        m.addList(items_getSelected())
    } catch (err) {
        console.error(err)
    }

    let toggle = win.document.getElementById("view-toggle") as HTMLSelectElement
    if(toggle)
        toggle.value = name
}

