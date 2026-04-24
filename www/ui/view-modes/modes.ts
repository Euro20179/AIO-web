class Mode {
    NAME: string = "Mode"
    output: HTMLElement | DocumentFragment
    win: Window & typeof globalThis

    container: HTMLElement | null

    // Explainer for output vs container
    // The output is where information goes, the container is where the information + ui chrome is displayed
    // If an output is not provided the container is created by the mode, and removed on close()
    // This is the case because if an output is provided, the chrome is expected to be provided by the caller.

    /**
        * @param {HTMLElement | DocumentFragment} output The element that information gets put into in the mode, if not provided a container is created by the mode
        * @param {Window & typeof globalThis} win The window where the mode is (defaults to parent window)
        * @param {HTMLElement | null} container The container containing the output, if provided, it will be removed from the DOM on Mode.close()
    */
    constructor(output: HTMLElement | DocumentFragment, win?: Window & typeof globalThis, container?: HTMLElement | null) {
        this.win = win ||= window
        this.container = container || null
        this.output = output
        if (this.win === null) {
            throw new Error("default view (window) is null")
        }
    }
    add(entry: InfoEntry): HTMLElement { return document.createElement("div") }
    sub(entry: InfoEntry): any { }
    addList(entry: InfoEntry[]): any { }
    subList(entry: InfoEntry[]): any { }
    ///Responsible for removing the open class from the output element
    //and also clearing the selected items (clearSelected())
    close(): any { }
    clearSelected(): any { }
    chwin?(win: Window): any { }
    refresh?(id: bigint): any { }
    put?(html: string | HTMLElement | ShadowRoot): any { }
}

let openViewModes: Mode[] = []

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

        mode_refreshItem(BigInt(id))

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


function mode_getFirstModeInWindow(win: Window) {
    for (let mode of openViewModes) {
        if (mode.win === win) {
            return mode
        }
    }
}

function mode_isSelected(id: bigint) {
    for (let item of items_getSelected()) {
        if (item.ItemId === id) {
            return true
        }
    }
    return false
}

function mode_chwin(newWin: Window & typeof globalThis, mode: Mode) {
    if (newWin === window) {
        if (mode.chwin) {
            mode.chwin(window)
            let selected = items_getSelected()
            mode_clearItems()
            mode_selectItemList(selected, true, mode)
        }
    }
    else {
        newWin.addEventListener("DOMContentLoaded", () => {
            let selected = items_getSelected()
            mode_clearItems()
            items_setSelected(selected)
            mode.chwin?.(newWin)
            newWin.self.addEventListener("aio-items-rendered", () => {
                mode_clearItems()
                mode_selectItemList(selected, true, mode)
            })
        })
    }
}

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

function mode_refreshItem(item: bigint) {
    for (const mode of openViewModes) {
        if (mode.refresh) {
            mode.refresh(item)
        }
    }
}

function mode_deselectItem(item: InfoEntry, updateStats: boolean = true) {
    items_deselectById(item.ItemId)
    updateStats && changeResultStatsWithItemUI(item, -1)
    for (let mode of openViewModes) {
        mode.sub(item)
    }

    if(items_getSelected().length === 0) {
        setError("No items selected")
    }
}
//just in case
const deselectItem = mode_deselectItem

function mode_selectItemList(itemList: InfoEntry[], updateStats: boolean = true, mode?: Mode) {
    if(itemList.length !== 0)
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


//this should ONLY operate within the user specified or current window otherwise it makes no sense
function mode_setMode(name: string, win: Window & typeof globalThis = window) {
    name = {
        "entry": "entry-output",
        "graph": "graph-output",
        "calc": "calc-output",
        "gallery": "gallery-output",
        "script": "script-output",
        "event": "event-output",
        "calendar": "calendar-output",
        "tierlist": "tierlist-output",
    }[name] || name
    const modes = {
        "entry-output": DisplayMode,
        "graph-output": GraphMode,
        "calc-output": CalcMode,
        "gallery-output": GalleryMode,
        "script-output": ScriptMode,
        "event-output": EventMode,
        "calendar-output": CalendarMode,
        "tierlist-output": TierListMode,
    }

    const newMode = modes[name as keyof typeof modes]
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
        const m = new newMode(undefined, win)
        openViewModes.push(m as Mode)
        m.addList(items_getSelected())
    } catch (err) {
    }

    let toggle = document.getElementById("view-toggle") as HTMLSelectElement
    toggle.value = name
}

