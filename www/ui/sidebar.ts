type SidebarMode = {
    itemsOnScreen: Set<HTMLElement>
    observer: IntersectionObserver

    _resizeTO: number
    _setToNone: boolean

    renderBacklog: InfoEntry[]

    resizeHandler(): any
    focusNthItem(n: number): any
    selectFocusedItem(): any
    focusNextItem(backward: boolean): any
    selectNth(n: Number): any
    reorder(itemOrder: bigint[], select?: boolean): any
    render(entries: InfoEntry[], clearRendered?: boolean, select?: boolean): any

    updateThumbnail(id: bigint, src: string): any
    mkobserver(): any
} & Mode

var SidebarMode: ModeConstructor<SidebarMode> = function(this: SidebarMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)

    this.itemsOnScreen = new Set

    this.mkobserver()

    this.renderBacklog = []

    this._resizeTO = 0
    this._setToNone = false
    this.win.addEventListener("resize", this.resizeHandler.bind(this))
} as any

SidebarMode.prototype.NAME = 'sidebar-list'

SidebarMode.prototype.resizeHandler = function() {
    if (!this._setToNone && this.output) {
        for (let sidebarEntry of this.output.querySelectorAll("sidebar-entry") as NodeListOf<HTMLElement>) {
            if (this.itemsOnScreen.has(sidebarEntry)) continue
            sidebarEntry.style.display = 'none'
        }
        this._setToNone = true
    }

    if (this._resizeTO) {
        clearTimeout(this._resizeTO)
    }
    this._resizeTO = setTimeout(() => {
        this._setToNone = false
        this._resizeTO = 0
        if(!this.output) return
        for (let sidebarEntry of this.output.querySelectorAll("sidebar-entry") as NodeListOf<HTMLElement>) {
            if (this.itemsOnScreen.has(sidebarEntry)) continue
            sidebarEntry.style.display = ''
        }
    }, 200)
}

SidebarMode.prototype.mkobserver = function(this: SidebarMode) {
    if (this.output instanceof this.win.HTMLElement) {
        this.observer = new IntersectionObserver(entries => {
            for (let entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.dispatchEvent(new Event("on-screen-appear"))
                    this.itemsOnScreen.add(entry.target as HTMLElement)
                } else if (this.itemsOnScreen.has(entry.target as HTMLElement)) {
                    this.itemsOnScreen.delete(entry.target as HTMLElement)
                }
            }
        }, {
            root: this.output,
            rootMargin: "0px",
            threshold: 0.1
        })
    }
}

SidebarMode.prototype.add = function(this: SidebarMode, item: InfoEntry) {
    return renderSidebarItem.call(this, item, this.output)
}

SidebarMode.prototype.addList = function(this: SidebarMode, items: InfoEntry[]) {
    (async () => {
        for (let i = 0; i < items.length; i++) {
            if (i !== 0 && i % 20 == 0 && "scheduler" in window) {
                //@ts-ignore
                await scheduler.yield()
            }
            this.add(items[i])
        }
    })()
}

SidebarMode.prototype.sub = function(this: SidebarMode, item: InfoEntry) {
    this.output.querySelector(`[data-entry-id="${item.ItemId}"]`)?.remove()
}

SidebarMode.prototype.subList = function(this: SidebarMode, items: InfoEntry[]) {
    for (let entry of items) {
        this.sub(entry)
    }
}

SidebarMode.prototype.close = function(this: SidebarMode) {
    if (this.container)
        this.container.remove()
    this.clearSelected()
    this.observer.disconnect()
    //@ts-ignore
    this.win.removeEventListener("resize", this.resizeHandler)
}

SidebarMode.prototype.chwin = function(this: SidebarMode, win: Window & typeof globalThis) {
    const newOutput = ModePrimitives.chwin.call(this, win)
    this.output = newOutput
    this.observer.disconnect()
    this.mkobserver()
    return newOutput
}

SidebarMode.prototype.clearSelected = function(this: SidebarMode) {
    while (this.output.firstElementChild) {
        this.observer.unobserve(this.output.firstElementChild)
        this.output.firstElementChild.remove()
    }
}

SidebarMode.prototype.mkcontainer = function(this: SidebarMode) {
    return this.win.document.createElement("sidebar-items")
}

SidebarMode.prototype.mkcontainers = function(this: SidebarMode, into: HTMLElement | DocumentFragment) {
    const c = this.mkcontainer()
    into.appendChild(c)
    return { container: c, output: c }
}

SidebarMode.prototype.refresh = function(this: SidebarMode, itemId: bigint) {
    if (!items_getResults().find(v => v.ItemId === itemId)) {
        return
    }

    if(items_getEntry(itemId).info.Library != items_getCurrentLibrary()) {
        this.sub(items_getEntry(itemId).info)
    }

    let el = document.querySelector(`sidebar-entry[data-entry-id="${itemId}"]`) as HTMLElement
    if (el) {
        _changeSidebarItemData(itemId, el)
        let meta = findMetadataById(itemId)
        if (meta)
            this.updateThumbnail(itemId, meta?.Thumbnail)
    }
}

SidebarMode.prototype.updateThumbnail = function(this: SidebarMode, id: bigint, src: string) {
    const elem = this.output.querySelector(`[data-entry-id="${id}"]`)
    if (!elem) return
    let img = elem.shadowRoot?.querySelector("img") as HTMLImageElement
    img.src = fixThumbnailURL(src)
}

SidebarMode.prototype.focusNthItem = function(n: number) {
    dom_getelorthrow(`:nth-child(${n})`, this.win.HTMLElement, this.output)?.focus()
}

SidebarMode.prototype.selectNth = function(n: number) {
    const el = dom_getel(`:nth-child(${n})`, this.win.HTMLElement, this.output)
    if (!el) return
    const id = BigInt(el.getAttribute("data-entry-id") || 0)
    if (id == 0n) return
    el.focus()

    selectUI(findInfoEntryById(id))
}

SidebarMode.prototype.selectFocusedItem = function() {
    if (this.win.document.activeElement?.tagName !== "SIDEBAR-ENTRY") return

    const id = this.win.document.activeElement.getAttribute("data-entry-id") as string
    selectUI(findInfoEntryById(BigInt(id)))
}

SidebarMode.prototype.focusNextItem = function(backward: boolean = false) {
    const active = this.win.document.activeElement
    if (!active) return
    const next = backward
        ? active.previousElementSibling
        : active.nextElementSibling
    if (next && next instanceof HTMLElement)
        next.focus()
}

SidebarMode.prototype.reorder = function(this: SidebarMode, itemOrder: bigint[], select = true) {
    this.render(itemOrder.map(v => findInfoEntryById(v)), true, select)
}

SidebarMode.prototype.render = function(this: SidebarMode, entries: InfoEntry[], clearRendered = true, select = true) {
    this.renderBacklog = []
    if (!entries.length) return

    const chunksize = 75
    const fragments = []
    for (let i = 0; i < Math.min(entries.length, chunksize); i++) {
        const frag = new DocumentFragment
        renderSidebarItem.call(this, entries[i], frag)
        fragments.push(frag)
    }

    this.output.replaceChildren(...fragments)

    if(entries.length > chunksize) {
        const btn = document.createElement("button")
        this.output.append(btn)

        btn.append("Load the rest")
        btn.addEventListener("click", e => {
            this.addList(this.renderBacklog)
            btn.remove()
        })

        this.renderBacklog = entries.slice(chunksize)
    }
    selectSidebarItems(entries, clearRendered)
}

/**
 * select the focused sidebar item
 */
function sidebar_selectFocused() {
    if (document.activeElement?.tagName !== "SIDEBAR-ENTRY") return

    const id = document.activeElement.getAttribute("data-entry-id") as string
    selectUI(findInfoEntryById(BigInt(id)))
}

var selectFocusedSidebarItem = sidebar_selectFocused


function _updateSidebarEntryContents(item: InfoEntry, user: UserEntry, meta: MetadataEntry, el: ShadowRoot) {
    const titleEl = el.getElementById("sidebar-title") as HTMLInputElement
    const imgEl = el.getElementById("sidebar-thumbnail") as HTMLImageElement

    //Title
    titleEl.value = item.En_Title
    titleEl.title = meta.Title
    titleEl.ariaLabel = `Editable title: ${item.En_Title}`

    //thumbnail source is updated in `on-screen-appear` event as to make sure it doesn't request 300 images at once
    imgEl.alt = "thumbnail"

    //Type
    let typeIcon = typeToSymbol(String(item.Type))
    titleEl.setAttribute("data-type-icon", typeIcon)

    //Release year
    if (meta.ReleaseYear)
        titleEl.setAttribute("data-release-year", String(meta.ReleaseYear))
    else
        titleEl.setAttribute("data-release-year", "unknown")

    //uid
    const uidEl = dom_getel("#sidebar-item-uid", null, el)
    if(uidEl && item.Uid !== getUidUI()) {
        uidEl.innerHTML = uid2username(item.Uid)
    }


    //position
    const posEl = dom_getel("#progress", null, el)
    pos: if(posEl) {
        if (!("max" in posEl &&
            "value" in posEl)) break pos
        posEl.setAttribute("data-status", user.Status)
        try {
            var mediaDependant = JSON.parse(meta.MediaDependant || "{}")
        } catch (err) {
            console.error("Could not parse media dependant meta info json")
            break pos
        }
        let lengthInNumber = items_getLength(mediaDependant)[0] || 0
        let userPos = parseInt(user.CurrentPosition)
        posEl.max = lengthInNumber || 1
        posEl.value = userPos || 0
    }

    updateDeclarativeDSL({}, settings_get(getUserUID(), "enable_unsafe"), item, user, meta, el) 
}

/**
 * Given a list of info entries, select them
 * @param {InfoEntry[]} entries
 * @param {boolean} [clearSelected=true]
 */
function sidebar_selectList(entries: InfoEntry[], clearSelected: boolean = true) {
    if (clearSelected) {
        clearUI()
    }
    if (isViewingAllUI()) {
        selectListUI(entries)
    } else {
        selectUI(entries[0])
    }
}
var selectSidebarItems = sidebar_selectList

function _changeSidebarItemData(id: bigint, el: HTMLElement) {
    _updateSidebarEntryContents(findInfoEntryById(id), findUserEntryById(id), findMetadataById(id), el.shadowRoot as ShadowRoot)
    el.setAttribute("data-entry-id", String(id))
}

/**
 * Clears all selected items, and selects one new one
 * @param {InfoEntry} item
 */
function sidebar_openOne(item: InfoEntry) {
    clearUI()
    selectUI(item)

    setViewingAllUI(false)
}
var sidebarEntryOpenOne = sidebar_openOne

/**
 * renders a list of sidebar entry elements into parent
 * <code>this</code> must be set to an instance of SidebarMode (usually components.sidebarUI)
 * @param {SidebarMode} this must be set with .call, .apply, .bind, ...
 * @param {InfoEntry[]} items
 * @param {HTMLElement | DocumentFragment} parent
 * @param {Partial<{below: string, renderImg: boolean}>} options below is an entry id to render below, renderImg controls whether the image should be rendered immediately or later
*/
async function sidebar_renderItemList(
    this: SidebarMode,
    items: InfoEntry[],
    parent: HTMLElement | DocumentFragment,
    options?: {
        below?: string,
        renderImg?: boolean
    }
) {
    for (let i = 0; i < items.length; i++) {
        if (i !== 0 && i % 20 == 0 && "scheduler" in window) {
            //@ts-ignore
            await scheduler.yield()
        }
        renderSidebarItem.call(this, items[i], parent, options)
    }
}

var renderSidebarItemList = sidebar_renderItemList

/**
 * Renders a sidebar item into parent with fake data
 * @param {InfoEntry} item
 * @param {HTMLElement | DocumentFragment} parent
 * @returns {HTMLElement}
 */
function sidebar_renderFakeItem(
    item: InfoEntry,
    parent: HTMLElement | DocumentFragment
): HTMLElement {
    let elem = document.createElement("sidebar-entry")
    let title = elem.shadowRoot?.getElementById("sidebar-title") as HTMLInputElement
    let img = elem.shadowRoot?.querySelector("[part=\"thumbnail\"]") as HTMLImageElement
    if (img) {
        const x = document.createElement("p")
        x.innerHTML = "X"
        x.style.fontSize = "2rem"
        img.replaceWith(x)
    }
    title.value = item.En_Title
    parent.append(elem)
    return elem
}
var renderFakeSidebarItem = sidebar_renderFakeItem

/**
 * given an item, render it into parent
 * <code>this</code> must be set to an instance of SidebarMode, usually components.sidebarUI
 * @param {SidebarMode} this
 * @param {InfoEntry} item
 * @param {HTMLElement | DocumetnFragment} parent
 * @param {Partial<{below: string, renderImg: boolean}>} options same as sidebar_renderItemList
 */
function sidebar_renderItem(this: SidebarMode, item: InfoEntry, parent?: HTMLElement | DocumentFragment, options?: {
    below?: string,
    renderImg?: boolean
}) {
    let elem = document.createElement("sidebar-entry")

    parent ||= this.output

    let meta = findMetadataById(item.ItemId)
    let user = findUserEntryById(item.ItemId)
    if (!user || !meta || !elem.shadowRoot) return elem

    elem.shadowRoot.querySelector("figure")?.setAttribute("aria-label", `${item.En_Title || item.Native_Title} thumbnail`)

    if (options?.below) {
        const renderBelow = parent.querySelector(`[data-entry-id="${options.below}"]`) as HTMLElement
        renderBelow?.insertAdjacentElement("afterend", elem)
    } else {
        parent.append(elem)
    }

    let img = elem.shadowRoot.querySelector("[part=\"thumbnail\"]") as HTMLImageElement
    if (img) {

        if (options?.renderImg && meta.Thumbnail) {
            img.src = fixThumbnailURL(meta.Thumbnail)
        } else {
            this.observer.observe(elem)
        }
    }
    function handleMouse(button: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean) {
        if (button === 1) {
            displayItemInWindow(item.ItemId)
        }
        else if (altKey) {
            displayItemInWindow(item.ItemId, "_blank", true)
        }
        else if (ctrlKey) {
            toggleItemUI(item)
        } else if (shiftKey) {
            if(items_isSelected(item.ItemId)) {
                dom_getel(`display-entry[data-item-id="${item.ItemId}"]`)?.scrollIntoView({
                    behavior: "smooth"
                })
            } else {
                let els = selectUI(item)
                els[els.length - 1]?.scrollIntoView({
                    behavior: "smooth"
                })
            }
        } else {
            sidebarEntryOpenOne(item)
        }
    }

    const btn = elem.shadowRoot.querySelector("button") as HTMLButtonElement
    btn.addEventListener("mousedown", e => {
        if (e.button === 1 || e.button === 0) {
            elem.focus()
            handleMouse(e.button, e.altKey, e.ctrlKey, e.shiftKey)
            e.preventDefault()
        }
    })
    btn.addEventListener("keydown", e => {
        if (e.key === " " || e.key === "Enter") {
            handleMouse(0, e.altKey, e.ctrlKey, e.shiftKey)
            e.preventDefault()
        }
    })

    let title = elem.shadowRoot?.getElementById("sidebar-title") as HTMLInputElement
    title && (
        title.onchange = (e) =>
            e.target instanceof HTMLInputElement &&
            updateUserTitleUI(item.ItemId, e.target.value)
    )

    elem.addEventListener("on-screen-appear", async function(e) {
        let meta = await items_getMetadataById(item.ItemId)
        if (img.src !== fixThumbnailURL(meta.Thumbnail)) {
            img.src = fixThumbnailURL(meta.Thumbnail)
        }
    })

    _changeSidebarItemData(item.ItemId, elem)

    return elem
}

var renderSidebarItem = sidebar_renderItem

mode_register("sidebar", SidebarMode)
