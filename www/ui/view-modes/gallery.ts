function renderGalleryItem(item: InfoEntry, parent: HTMLElement | DocumentFragment) {
    const entry = document.createElement("gallery-entry")
    const root = entry.shadowRoot
    if(!root) {
        alert("Could not add gallery item, gallery-entry has no shadowroot")
        return entry
    }

    entry.setAttribute("data-item-id", String(item.ItemId))

    let meta = findMetadataById(item.ItemId)
    if (meta?.Thumbnail) {
        const thumb = fixThumbnailURL(meta.Thumbnail)

        const thumbImg = root.querySelector("#thumbnail") as HTMLImageElement
        thumbImg.src = thumb
    }

    parent.appendChild(entry)
    updateDeclarativeDSL({
        openitem: target => {
            const root = target.getRootNode() as ShadowRoot
            const id = BigInt(root.host.getAttribute("data-item-id") || 0)
            if(!id) return
            openDisplayWinUI(id)
        }
    }, item, findUserEntryById(item.ItemId), meta, root)
    return entry
}

class GalleryMode extends Mode {
    NAME = "gallery-output"
    constructor(output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        win ||= window
        let c = null
        if(!output) {
            output = document.createElement("div")
            c = output
            output.classList.add("overflow")
            output.id = 'gallery-output'
            output.innerHTML = `<div id="gallery-items"></div>`
            const o = getElementOrThrowUI("#viewing-area", null, win.document)
            o.append(output)
            output = output.firstElementChild as HTMLElement
        }
        super(output, win, c)
    }

    removeGalleryItem(entry: InfoEntry) {
        let el = this.output.querySelector(`[data-item-id="${entry.ItemId}"]`)
        el?.remove()
    }

    add(entry: InfoEntry) {
        return renderGalleryItem(entry, this.output)
    }

    sub(entry: InfoEntry) {
        this.removeGalleryItem(entry)
    }

    addList(entry: InfoEntry[]) {
        for (let item of entry) {
            renderGalleryItem(item, this.output)
        }
    }

    subList(entry: InfoEntry[]) {
        for (let item of entry) {
            this.removeGalleryItem(item)
        }
    }

    refresh(id: bigint) {
        const entry = items_getEntry(id)
        let el = this.output.querySelector(`[data-item-id="${entry.ItemId}"]`)
        if(!el) {
            console.error("Failed to refresh gallery item")
            return
        }
        const frag = new DocumentFragment()
        renderGalleryItem(entry.info, frag)
        this.output.replaceChild(frag, el)
    }

    clearSelected() {
        for (let child of this.output.querySelectorAll(`[data-item-id]`)) {
            child.remove()
        }
    }

    chwin(win: Window & typeof globalThis) {
        this.win.close()
        this.win = win
        this.output = win.document.getElementById("gallery-items") as HTMLDivElement
    }
    close() {
        if(this.container)
            this.container.remove()
        this.clearSelected()
    }
}
