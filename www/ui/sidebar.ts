type SidebarMode = {
    itemsOnScreen: Set<HTMLElement>
    observer: IntersectionObserver

    _resizeTO: number
    _setToNone: boolean

    resizeHandler(): any
    focusNthItem(n: number): any
    selectFocusedItem(): any
    focusNextItem(backward: boolean): any
    selectNth(n: Number): any
    reorder(itemOrder: bigint[], select?: boolean): any
    render(entries: InfoEntry[], clearRendered?: boolean): any

    updateThumbnail(id: bigint, src: string): any
    modesUpdateHandler(e: CustomEvent): any
    mkobserver(): any
} & Mode

function SidebarMode(this: SidebarMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)

    this.itemsOnScreen = new Set

    this.mkobserver()

    //@ts-ignore
    addEventListener("modes.update-item", this.modesUpdateHandler)

    this._resizeTO = 0
    this._setToNone = false
    this.win.addEventListener("resize", this.resizeHandler)
}

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

SidebarMode.prototype.modesUpdateHandler = function(this: SidebarMode, e: CustomEvent) {
    const id = e.detail
    this.refresh?.(BigInt(id))
}

SidebarMode.prototype.add = function(this: SidebarMode, item: InfoEntry) {
    return renderSidebarItem.call(this, item, this.output)
}

SidebarMode.prototype.addList = function(this: SidebarMode, items: InfoEntry[]) {
    console.log(items);
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
    removeEventListener("modes.update-item", this.modesUpdateHandler)
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

    let el = document.querySelector(`sidebar-entry[data-entry-id="${itemId}"]`) as HTMLElement
    if (el) {
        changeSidebarItemData(itemId, el)
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
    getElementOrThrow(`:nth-child(${n})`, this.win.HTMLElement, this.output)?.focus()
}

SidebarMode.prototype.selectNth = function(n: number) {
    const el = getElement(`:nth-child(${n})`, this.win.HTMLElement, this.output)
    if (!el) return
    const id = BigInt(el.getAttribute("data-entry-id") || 0)
    if (id == 0n) return
    el.focus()

    mode_selectItem(findInfoEntryById(id))
}

SidebarMode.prototype.selectFocusedItem = function() {
    if (this.win.document.activeElement?.tagName !== "SIDEBAR-ENTRY") return

    const id = this.win.document.activeElement.getAttribute("data-entry-id") as string
    mode_selectItem(findInfoEntryById(BigInt(id)))
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
    let elems = []
    for (let item of itemOrder) {
        let elem = this.output.querySelector(`[data-entry-id="${item}"]`) as HTMLElement
        if (!elem) continue
        elems.push(elem)
    }
    this.output.replaceChildren(...elems)

    if (select) {
        selectSidebarItems(itemOrder.map(v => findInfoEntryById(v)))
    }
}

SidebarMode.prototype.render = function(this: SidebarMode, entries: InfoEntry[], clearRendered = true) {
    if (!entries.length) return
    const fragments = []
    for (let i = 0; i < entries.length; i++) {
        const frag = new DocumentFragment
        renderSidebarItem.call(this, entries[i], frag)
        fragments.push(frag)
    }
    this.output.replaceChildren(...fragments)
    selectSidebarItems(entries, clearRendered)
}

function selectFocusedSidebarItem() {
    if (document.activeElement?.tagName !== "SIDEBAR-ENTRY") return

    const id = document.activeElement.getAttribute("data-entry-id") as string
    mode_selectItem(findInfoEntryById(BigInt(id)))
}


function updateSidebarEntryContents(item: InfoEntry, user: UserEntry, meta: MetadataEntry, el: ShadowRoot) {
    const titleEl = el.getElementById("sidebar-title") as HTMLInputElement
    const imgEl = el.getElementById("sidebar-thumbnail") as HTMLImageElement

    //Title
    titleEl.value = item.En_Title
    titleEl.title = meta.Title

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
}

function selectSidebarItems(entries: InfoEntry[], clearSelected = true) {
    if (clearSelected) {
        mode_clearItems()
    }
    if (isViewingAllUI()) {
        mode_selectItemList(entries)
    } else {
        mode_selectItem(entries[0])
    }
}

function changeSidebarItemData(id: bigint, el: HTMLElement) {
    updateSidebarEntryContents(findInfoEntryById(id), findUserEntryById(id), findMetadataById(id), el.shadowRoot as ShadowRoot)
    el.setAttribute("data-entry-id", String(id))
}

function sidebarEntryOpenOne(item: InfoEntry) {
    mode_clearItems()
    mode_selectItem(item)

    setViewingAllUI(false)
}

function sidebarEntryOpenMultiple(item: InfoEntry) {
    mode_toggleItem(item)
}

async function renderSidebarItemList(this: SidebarMode, items: InfoEntry[], sidebarParent: HTMLElement | DocumentFragment, options?: {
    below?: string,
    renderImg?: boolean
}) {
    for (let i = 0; i < items.length; i++) {
        if (i !== 0 && i % 20 == 0 && "scheduler" in window) {
            //@ts-ignore
            await scheduler.yield()
        }
        renderSidebarItem.call(this, items[i], sidebarParent, options)
    }
}

/**
 * Renders a sidebar item with fake data
 */
function renderFakeSidebarItem(item: InfoEntry, sidebarParent: HTMLElement | DocumentFragment): HTMLElement {
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
    sidebarParent.append(elem)
    return elem
}

/**
  * @description below is an itemid that the item gets rendered below
*/
function renderSidebarItem(this: SidebarMode, item: InfoEntry, sidebarParent?: HTMLElement | DocumentFragment, options?: {
    below?: string,
    renderImg?: boolean
}) {
    let elem = document.createElement("sidebar-entry")

    sidebarParent ||= this.output

    let meta = findMetadataById(item.ItemId)
    let user = findUserEntryById(item.ItemId)
    if (!user || !meta || !elem.shadowRoot) return elem

    elem.shadowRoot.querySelector("figure")?.setAttribute("aria-label", `${item.En_Title || item.Native_Title} thumbnail`)

    if (options?.below) {
        const renderBelow = sidebarParent.querySelector(`[data-entry-id="${options.below}"]`) as HTMLElement
        renderBelow?.insertAdjacentElement("afterend", elem)
    } else {
        sidebarParent.append(elem)
    }

    let img = elem.shadowRoot.querySelector("[part=\"thumbnail\"]") as HTMLImageElement
    if (img) {

        if (options?.renderImg && meta.Thumbnail) {
            img.src = fixThumbnailURL(meta.Thumbnail)
        } else {
            this.observer.observe(elem)
        }
    }
    function handleMouse(button: number, altKey: boolean, ctrlKey: boolean) {
        if (button === 1) {
            displayItemInWindow(item.ItemId)
        }
        else if (altKey) {
            displayItemInWindow(item.ItemId, "_blank", true)
        }
        else if (ctrlKey) {
            sidebarEntryOpenMultiple(item)
        } else {
            sidebarEntryOpenOne(item)
        }
    }

    const btn = elem.shadowRoot.querySelector("button") as HTMLButtonElement
    btn.addEventListener("mousedown", e => {
        if (e.button === 1 || e.button === 0) {
            elem.focus()
            handleMouse(e.button, e.altKey, e.ctrlKey)
            e.preventDefault()
        }
    })
    btn.addEventListener("keydown", e => {
        if (e.key === " " || e.key === "Enter") {
            handleMouse(0, e.altKey, e.ctrlKey)
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
        let meta = await findMetadataByIdAtAllCosts(item.ItemId)
        if (img.src !== fixThumbnailURL(meta.Thumbnail)) {
            img.src = fixThumbnailURL(meta.Thumbnail)
        }
    })

    changeSidebarItemData(item.ItemId, elem)

    return elem
}
