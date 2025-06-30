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

function mode_getFirstModeInWindow(win: Window) {
    for(let mode of openViewModes) {
        if(mode.win === win) {
            return mode
        }
    }
}

function mode_isSelected(id: bigint) {
    for (let item of globalsNewUi.selectedEntries) {
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
            let selected = globalsNewUi.selectedEntries
            clearItems()
            selectItemList(selected, true, mode)
        }
    }
    else {
        newWin.addEventListener("DOMContentLoaded", () => {
            let selected = globalsNewUi.selectedEntries
            clearItems()
            globalsNewUi.selectedEntries = selected
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
    globalsNewUi.selectedEntries.push(item)
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
    globalsNewUi.selectedEntries = globalsNewUi.selectedEntries.filter(a => a.ItemId !== item.ItemId)
    updateStats && changeResultStatsWithItemUI(item, -1)
    for (let mode of openViewModes) {
        mode.sub(item)
    }
}

function selectItemList(itemList: InfoEntry[], updateStats: boolean = true, mode?: Mode) {
    globalsNewUi.selectedEntries = globalsNewUi.selectedEntries.concat(itemList)
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
    if (globalsNewUi.selectedEntries.find(a => a.ItemId === item.ItemId)) {
        deselectItem(item, updateStats)
    } else {
        selectItem(item, updateStats)
    }
}

function clearItems(updateStats: boolean = true) {
    globalsNewUi.selectedEntries = []
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
        "event-output": EventMode
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
        m.addList(globalsNewUi.selectedEntries)
    } catch (err) {
    }

    let toggle = document.getElementById("view-toggle") as HTMLSelectElement
    toggle.value = name
}

