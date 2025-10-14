class Mode {
    NAME: string = "Mode"
    parent: HTMLElement | DocumentFragment
    win: Window & typeof globalThis
    //using string will querySelector on the (win || window)'s document
    constructor(parent: HTMLElement | DocumentFragment | string, win?: Window & typeof globalThis) {
        this.parent = parent instanceof HTMLElement || parent instanceof DocumentFragment
            ? parent
            : (win || window).document.querySelector(parent) as HTMLElement
        //@ts-ignore
        this.win = win || this.parent.ownerDocument.defaultView
        if (this.win === null) {
            throw new Error("default view (window) is null")
        }
    }
    add(entry: InfoEntry): HTMLElement { return document.createElement("div") }
    sub(entry: InfoEntry): any { }
    addList(entry: InfoEntry[]): any { }
    subList(entry: InfoEntry[]): any { }
    chwin?(win: Window): any { }
    refresh?(id: bigint): any { }
    putSelectedInCollection?(): any { }
    addTagsToSelected?(): any { }
    put?(html: string | HTMLElement | ShadowRoot): any { }
    close(): any { }
    clearSelected(): any { }
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

        const parent = (info || findInfoEntryById(BigInt(id)))?.ParentId
        if (parent && items_getAllEntries()[String(parent)]) {
            //if the parent is this, or itself, just dont update
            if (![BigInt(id), parent].includes(items_getAllEntries()[String(parent)].info.ParentId)) {
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
    for(let mode of openViewModes) {
        if(mode.win === win) {
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
            clearItems()
            selectItemList(selected, true, mode)
        }
    }
    else {
        newWin.addEventListener("DOMContentLoaded", () => {
            let selected = items_getSelected()
            clearItems()
            items_setSelected(selected)
            mode.chwin?.(newWin)
            newWin.addEventListener("aio-items-rendered", () => {
                newWin.mode_setMode(mode.NAME)
                clearItems()
                selectItemList(selected, true, mode)
            })
        })
    }
}

function selectItem(item: InfoEntry, updateStats: boolean = true, mode?: Mode): HTMLElement[] {
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

function mode_refreshItem(item: bigint) {
    for (const mode of openViewModes) {
        if (mode.refresh) {
            mode.refresh(item)
        }
    }
}

function deselectItem(item: InfoEntry, updateStats: boolean = true) {
    items_deselectById(item.ItemId)
    updateStats && changeResultStatsWithItemUI(item, -1)
    for (let mode of openViewModes) {
        mode.sub(item)
    }
}

function selectItemList(itemList: InfoEntry[], updateStats: boolean = true, mode?: Mode) {
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

function toggleItem(item: InfoEntry, updateStats: boolean = true) {
    if (items_getSelected().find(a => a.ItemId === item.ItemId)) {
        deselectItem(item, updateStats)
    } else {
        selectItem(item, updateStats)
    }
}

function clearItems(updateStats: boolean = true) {
    items_clearSelected()
    for (const mode of openViewModes) {
        mode.clearSelected()
    }
    updateStats && resetStatsUI()
}

//this should ONLY operate within the user specified or current window otherwise it makes no sense
function mode_setMode(name: string, win: Window & typeof globalThis = window) {
    const modes = {
        "entry-output": DisplayMode,
        "graph-output": GraphMode,
        "calc-output": CalcMode,
        "gallery-output": GalleryMode,
        "script-output": ScriptMode,
        "event-output": EventMode,
        "calendar-output": CalendarMode,
    }
    //@ts-ignore
    const newMode = modes[name]
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
        const m = new newMode(null, win)
        openViewModes.push(m)
        m.addList(items_getSelected())
    } catch (err) {
    }

    let toggle = document.getElementById("view-toggle") as HTMLSelectElement
    toggle.value = name
}

