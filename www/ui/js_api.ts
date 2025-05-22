function ua_download(data: string, name: string, ft: string): number {
    let e = document.createElement("a")
    e.download = name
    let b = new Blob([data], { type: ft })
    e.href = URL.createObjectURL(b)
    e.click()
    return 0
}

function ui_setstat(name: string, val: number): number {
    setResultStat(name, val)
    return val
}

function ui_delstat(name: string): boolean {
    return deleteResultStat(name)
}

function ui_sort(by: string): number {
    const sortBySelector = document.querySelector('[name="sort-by"]') as HTMLSelectElement
    sortBySelector.value = by
    sortEntriesUI()
    return 0
}

function ui_search(query: string, cb?: (results: items_Entry[]) => any): number {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    (form.querySelector('[name="search-query"]') as HTMLInputElement).value = query

    loadSearchUI().then(() => {
        cb?.(globalsNewUi.results)
    }).catch(console.error)

    return 0
}

function ui_setmode(modeName: string): number {
    if (!modeOutputIds.includes(modeName)) {
        return 1
        // return new Str("Invalid mode")
    }
    mode_setMode(modeName)
    return 0
}

function ui_sidebarclear(): number {
    clearSidebar()
    return 0
}

function ui_sidebarselect(id: bigint | InfoEntry | MetadataEntry | UserEntry): number {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    renderSidebarItem(entry)
    return 0
}

function ui_sidebarrender(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }
    let frag = document.createDocumentFragment()
    return renderSidebarItem(entry, frag, { renderImg: true })
}

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

function ui_render(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    let frag = document.createDocumentFragment()

    return selectItem(entry, mode, false, frag)
}

function ui_clear(): number {
    clearItems()
    return 0
}

function ui_modeclear(): number {
    if("clear" in mode) {
        mode.clear()
        return 0
    }
    return 1
}

function ui_setuid(newId: string): string {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement
    return uidSelector.value = newId
}

function ui_getuid(): number {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement
    return Number(uidSelector.value)
}

function ui_setresults(results: InfoEntry[]): number {
    globalsNewUi.results = results.map(v => globalsNewUi.entries[String(v.ItemId)])
    renderSidebar(results)
    return 0
}

function ui_getresults(): InfoEntry[] {
    return globalsNewUi.results.map(v => v.info)
}

function ui_selected(): InfoEntry[] {
    return globalsNewUi.selectedEntries
}

function ui_put(...html: (string | HTMLElement)[]): "" | 1 {
    if(!mode.put) {
        return 1
    }
    for(let h of html) {
        mode.put(h)
    }
    return ""
}

function ui_sidebarreorder(...ids: (bigint | InfoEntry | MetadataEntry | UserEntry)[]): number {
    ids = ids.map(v => typeof v === 'bigint' ? v : v.ItemId)
    reorderSidebar(ids as bigint[])
    return 0
}

async function ui_askitem() {
    return await selectExistingItem()
}

async function aio_search(query: string): Promise<InfoEntry[]> {
    return await api_queryV3(query, getUidUI())
}

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
