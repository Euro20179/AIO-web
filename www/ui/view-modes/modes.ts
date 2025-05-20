
type DisplayMode = {
    add: (entry: InfoEntry, updateStats?: boolean, parent?: HTMLElement | DocumentFragment) => HTMLElement
    sub: (entry: InfoEntry, updateStats?: boolean) => any
    addList: (entry: InfoEntry[], updateStats?: boolean) => any
    subList: (entry: InfoEntry[], updateStats?: boolean) => any
    refresh?: (id: bigint) => any
    putSelectedInCollection?: () => any
    addTagsToSelected?: () => any
    put?: (html: string | HTMLElement | ShadowRoot) => any
    [key: string]: any
}

function mode_isSelected(id: bigint) {
    for(let item of globalsNewUi.selectedEntries) {
        if(item.ItemId === id) {
            return true
        }
    }
    return false
}

const modes = [modeDisplayEntry, modeGraphView, modeCalc, modeGallery, modeScripting]
const modeOutputIds = ["entry-output", "graph-output", "calc-output", "gallery-output", "script-output"]

let idx = modeOutputIds.indexOf(location.hash.slice(1))

let mode = modes[idx]

function selectItem(item: InfoEntry, mode: DisplayMode, updateStats: boolean = true, parent?: HTMLElement | DocumentFragment): HTMLElement {
    globalsNewUi.selectedEntries.push(item)
    return mode.add(item, updateStats, parent)
}

function deselectItem(item: InfoEntry, updateStats: boolean = true) {
    globalsNewUi.selectedEntries = globalsNewUi.selectedEntries.filter(a => a.ItemId !== item.ItemId)
    mode.sub(item, updateStats)
}

function selectItemList(itemList: InfoEntry[], mode: DisplayMode, updateStats: boolean = true) {
    globalsNewUi.selectedEntries = globalsNewUi.selectedEntries.concat(itemList)
    mode.addList(itemList, updateStats)
}

function toggleItem(item: InfoEntry, updateStats: boolean = true) {
    if (globalsNewUi.selectedEntries.find(a => a.ItemId === item.ItemId)) {
        deselectItem(item, updateStats)
    } else {
        selectItem(item, mode, updateStats)
    }
}

function clearItems(items?: InfoEntry[]) {
    //FIXME: for some reason selectedEntries has an `undefined` item in it when the user has not items
    mode.subList(items || globalsNewUi.selectedEntries.filter(Boolean))
    globalsNewUi.selectedEntries = []
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

    const viewToggle = document.getElementById("view-toggle")

    if(viewToggle) {
        (viewToggle as HTMLSelectElement).value = name
    }

    let curModeIdx = modeOutputIds.indexOf(name)

    mode = modes[curModeIdx]
    location.hash = name

    mode.addList(globalsNewUi.selectedEntries)
}

document.getElementById("view-toggle")?.addEventListener("change", e => {
    mode_setMode((e.target as HTMLSelectElement).value)
})

const viewAllElem = document.getElementById("view-all") as HTMLInputElement
viewAllElem.addEventListener("change", e => {
    clearItems()
    if ((e.target as HTMLInputElement)?.checked) {
        selectItemList(globalsNewUi.results.map(v => v.info), mode)
    } else {
        resultStatsProxy.reset()
    }
})
