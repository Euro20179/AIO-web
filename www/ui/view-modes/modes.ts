/**
    * @module modes
    * @requires items.ts
    * @description
    * Manages state reguarding modes
    * is decoupled from the ui as much as possible

    * individual modes may and still are likely coupled to the ui
*/
type ModeProperties = {
    //attachment to its window
    //- sticky: does not move windows
    //- free: can move windows
    attachment: "sticky" | "free"
    //whether or not this mode can be listed in functions like mode_listOpen()
    //or mode_getFirstModeInWindow()
    listed: boolean
    closable: boolean
}


let openViewModes: Map<Mode, ModeProperties> = new Map

interface ModeConstructor<T> {
  new (output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis): T;
}

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
            ({output, container: c} = this.mkcontainers(containerPlacement || dom_getelorthrow("#viewing-area", null, this.win.document)))
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

        let { output: newOutput, container } = this.mkcontainers(dom_getelorthrow("#viewing-area", null, this.win.document))
        const imported = win.document.importNode(this.output, true)
        newOutput.replaceChildren(...imported.childNodes)
        this.output = newOutput
        this.container = container

        return container
    }
}

/**
 * gets a list of open modes
 * @returns {Mode[]}
 */
function mode_listOpen(): Mode[] {
    return openViewModes
        .entries()
        .filter(([_, p]) => p.listed)
        .map(v => v[0])
        .toArray()
}

/**
 * Lists <b>ALL</b> modes, even if they are unlistable
 */
function mode_listALL(): Mode[] {
    return openViewModes.keys().toArray()
}

/**
 * adds a mode to the list of open modes, with optional properties
 * @param {Mode} mode
 * @param {ModeProperties} [properties={attachment: "free"}]
 */
function mode_add(mode: Mode, properties?: ModeProperties) {
    openViewModes.set(mode, properties || {
        listed: true,
        closable: true,
        attachment: "free"
    })
}

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


/**
 * Given a window, get the first mode in the list of openViewModes that is
 * being displayed in that window
 * @param {Window} win
 * @returns {Mode | undefined}
 */
function mode_getFirstModeInWindow(win: Window): Mode | undefined {
    for (let mode of mode_listOpen()) {
        if (mode.win === win) {
            return mode
        }
    }
}

/**
 * Refresh an item by item id in all openViewModes
 * @param {bigint} item
 */
var mode_refreshItem = function() {
    let toForItems = new Map
    return function(item: bigint) {
        const refresh = () => {
            toForItems.delete(item)
            for (const mode of mode_listALL()) {
                if (mode.refresh) {
                    mode.refresh(item)
                }
            }
        }
        if(toForItems.has(item)) {
            clearTimeout(toForItems.get(item))
        }
        toForItems.set(item, setTimeout(refresh, 40))
    }
}()


/**
 * Makes a mode display in a different window (if it's attachment is 'free')
 * @param {Window & typeof globalThis} newWin
 * @param {Mode} mode
 */
function mode_chwin(newWin: Window & typeof globalThis, mode: Mode) {
    if(openViewModes.get(mode)?.attachment === 'sticky') return

    const refresh = () => {
        for (let item of items_getSelected()) {
            mode_refreshItem(item.ItemId)
        }
    }
    if (newWin === window) {
        if (mode.chwin && mode) {
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
 * @param {InfoEntry} item
 * @param {Mode} [mode=undefined] the mode to update (otherwise all open modes)
 */
function mode_selectItem(item: InfoEntry, mode?: Mode): HTMLElement[] {
    if (mode) return [mode.add(item)]

    const elems = []
    for (const mode of mode_listOpen()) {
        elems.push(mode.add(item))
    }
    return elems
}
//just in case
const selectItem = mode_selectItem

/**
 * Deselects an item
 * @param {InfoEntry} item
 */
function mode_deselectItem(item: InfoEntry) {
    for (let mode of mode_listOpen()) {
        mode.sub(item)
    }
}

//just in case
const deselectItem = mode_deselectItem

/**
 * Selects a list of items to be selected within {mode} or all openViewModes if not given
 * side effects:
 * - updates stats (if updateStats is true)
 * @param {InfoEntry[]} itemList
 * @param {Mode} [mode=undefined]
 */
function mode_selectItemList(itemList: InfoEntry[], mode?: Mode) {
    if (mode) {
        mode.addList(itemList)
    } else {
        for (let mode of mode_listOpen()) {
            mode.addList(itemList)
        }
    }
}

/**
 * Clears selected items within a mode
 * also updates stats
 *
 * @see ui_modeclear(), which clears miscellanious nodes from modes
 */
function mode_clearItems() {
    for (const mode of mode_listOpen()) {
        mode.clearSelected()
    }
}

const mode_map = () => new Map<string, ModeConstructor<Mode>>([
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
function mode_name2cls(name: string): ModeConstructor<Mode> {
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
        const toDel = []
        for (const [mode, properties] of openViewModes) {
            if (mode.win === win && properties.closable) {
                mode.close()
                toDel.push(mode)
            }
        }

        for(let m of toDel) {
            openViewModes.delete(m)
        }

        const m = new (newMode as any)(undefined, win)
        mode_add(m)
        m.addList(items_getSelected())
    } catch (err) {
        console.error(err)
    }

    let toggle = win.document.getElementById("view-toggle") as HTMLSelectElement
    if(toggle)
        toggle.value = name
}

