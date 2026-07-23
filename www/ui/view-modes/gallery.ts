function renderGalleryItem(item: InfoEntry, parent: HTMLElement | DocumentFragment) {
    const card = mkItemCardUI(item.ItemId)
    dom_getel("h2", null, card.shadowRoot!)?.remove()
    parent.append(card)
    return card
}

type GalleryMode = {
    removeGalleryItem(entry: InfoEntry): any
} & Mode

var GalleryMode: ModeConstructor<GalleryMode> = function(this: GalleryMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)
} as any

GalleryMode.prototype.mkcontainers = function(this: GalleryMode, into: HTMLElement | DocumentFragment) {
    const c = this.mkcontainer()
    into.append(c)
    return { container: c, output: dom_getelorthrow(":first-child", null, c) }
}

GalleryMode.prototype.mkcontainer = function(this: GalleryMode, ) {
    const c = document.createElement("div")
    c.innerHTML = '<div id="gallery-items"></div>'
    c.id = 'gallery-output'
    c.classList.add("overflow")
    return c
}

GalleryMode.prototype.removeGalleryItem = function(this: GalleryMode, entry: InfoEntry) {
    let el = this.output.querySelector(`[data-item-id="${entry.ItemId}"]`)
    el?.remove()
}

GalleryMode.prototype.add = function(this: GalleryMode, entry: InfoEntry) {
    return renderGalleryItem(entry, this.output)
}

GalleryMode.prototype.sub = function(this: GalleryMode, entry: InfoEntry) {
    this.removeGalleryItem(entry)
}

GalleryMode.prototype.addList = function(this: GalleryMode, entry: InfoEntry[]) {
    for (let item of entry) {
        renderGalleryItem(item, this.output)
    }
}

GalleryMode.prototype.subList = function(this: GalleryMode, entry: InfoEntry[]) {
    for (let item of entry) {
        this.removeGalleryItem(item)
    }
}

GalleryMode.prototype.refresh = function(this: GalleryMode, id: bigint) {
    const entry = items_getEntry(id)
    let el = this.output.querySelector(`[data-item-id="${entry.ItemId}"]`)
    if (!el) {
        return
    }
    const frag = new DocumentFragment()
    renderGalleryItem(entry.info, frag)
    this.output.replaceChild(frag, el)
}

GalleryMode.prototype.clearSelected = function(this: GalleryMode, ) {
    for (let child of this.output.querySelectorAll(`[data-item-id]`)) {
        child.remove()
    }
}

GalleryMode.prototype.chwin = function(this: GalleryMode, win: Window & typeof globalThis) {
    const container = ModePrimitives.chwin.call(this, win)
    this.win = win
    this.output = container.querySelector("#gallery-items") as HTMLDivElement
    return container
}
GalleryMode.prototype.close = function(this: GalleryMode, ) {
    if (this.container)
        this.container.remove()
    else this.clearSelected()
    this.clearSelected()
}
