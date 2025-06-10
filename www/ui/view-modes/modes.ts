
type DisplayMode = {
    add: (entry: InfoEntry, parent?: HTMLElement | DocumentFragment) => HTMLElement
    sub: (entry: InfoEntry) => any
    addList: (entry: InfoEntry[]) => any
    subList: (entry: InfoEntry[]) => any
    chwin?: (win: Window) => any,
    refresh?: (id: bigint) => any
    putSelectedInCollection?: () => any
    addTagsToSelected?: () => any
    put?: (html: string | HTMLElement | ShadowRoot) => any
    clearSelected: () => any
    [key: string]: any
}

function mode_isSelected(id: bigint) {
    for (let item of globalsNewUi.selectedEntries) {
        if (item.ItemId === id) {
            return true
        }
    }
    return false
}

const modes = [modeDisplayEntry, modeGraphView, modeCalc, modeGallery, modeScripting, modeEvents]
const modeOutputIds = ["entry-output", "graph-output", "calc-output", "gallery-output", "script-output", "event-output"]

let idx = modeOutputIds.indexOf(location.hash.slice(1))
let curModeName = modeOutputIds[idx]

let mode = modes[idx]

let mode_curWin: Window = window

function mode_chwin(newWin: Window) {
    if (newWin === window) {
        mode_curWin.close()
        mode_curWin = window
        if (mode.chwin) {
            mode.chwin(window)
            let selected = globalsNewUi.selectedEntries
            clearItems()
            selectItemList(selected, mode)
        }
    }
    else if (mode.chwin) {
        mode_curWin = newWin
        newWin.addEventListener("DOMContentLoaded", () => {
            let selected = globalsNewUi.selectedEntries
            clearItems()
            globalsNewUi.selectedEntries = selected
            mode.chwin?.(newWin)
            newWin.addEventListener("aio-items-rendered", () => {
                clearItems()
                selectItemList(selected, mode)
            })
        })
    }
}

function selectItem(item: InfoEntry, mode: DisplayMode, updateStats: boolean = true, parent?: HTMLElement | DocumentFragment): HTMLElement {
    globalsNewUi.selectedEntries.push(item)
    updateStats && changeResultStatsWithItemUI(item)
    updatePageInfoWithItemUI(item)
    return mode.add(item, parent)
}

function deselectItem(item: InfoEntry, updateStats: boolean = true) {
    globalsNewUi.selectedEntries = globalsNewUi.selectedEntries.filter(a => a.ItemId !== item.ItemId)
    updateStats && changeResultStatsWithItemUI(item, -1)
    mode.sub(item)
}

function selectItemList(itemList: InfoEntry[], mode: DisplayMode, updateStats: boolean = true) {
    globalsNewUi.selectedEntries = globalsNewUi.selectedEntries.concat(itemList)
    updateStats && changeResultStatsWithItemListUI(itemList)
    if(itemList.length)
        updatePageInfoWithItemUI(itemList[0])
    mode.addList(itemList)
}

function toggleItem(item: InfoEntry, updateStats: boolean = true) {
    if (globalsNewUi.selectedEntries.find(a => a.ItemId === item.ItemId)) {
        deselectItem(item, updateStats)
    } else {
        selectItem(item, mode, updateStats)
    }
}

function clearItems(updateStats: boolean = true) {
    globalsNewUi.selectedEntries = []
    mode.clearSelected()
    updateStats && resetStatsUI()
}

function putSelectedToCollection() {
    if (mode.putSelectedInCollection) {
        mode.putSelectedInCollection()
    } else {
        alert("This mode does not support putting items into a collection")
    }
}

function addTagsToSelected() {
    if (mode.addTagsToSelected) {
        mode.addTagsToSelected()
    } else {
        alert("This mode does not support adding tags to selected items")
    }
}

function mode_setMode(name: string) {
    mode.subList(globalsNewUi.selectedEntries)


    let curModeIdx = modeOutputIds.indexOf(name)

    mode = modes[curModeIdx]
    mode_curWin.location.hash = name
    if(mode.chwin) {
        mode.chwin(mode_curWin)
    }

    mode.addList(globalsNewUi.selectedEntries)

    curModeName = name
    let toggle = document.getElementById("view-toggle") as HTMLSelectElement
    toggle.value = name
}

document.getElementById("view-toggle")?.addEventListener("change", e => {
    mode_setMode((e.target as HTMLSelectElement).value)
})

const viewAllElem = document.getElementById("view-all") as HTMLInputElement
viewAllElem.addEventListener("change", e => {
    resetStatsUI()
    if (!viewAllElem.checked) {
        clearItems(false)
    } else {
        clearItems()
        selectItemList(getFilteredResultsUI(), mode)
    }
})
