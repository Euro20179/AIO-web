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
            open(`/ui/display.php?item-id=${id}`, "_blank", "popup=true")
        }
    }, item, findUserEntryById(item.ItemId), meta, root)
    return entry
}

class GalleryMode extends Mode {
    NAME = "gallery-output"
    constructor(parent?: HTMLElement, win?: Window & typeof globalThis) {
        super(parent || "#gallery-items", win)
        this.win.document.getElementById("gallery-output")?.classList.add("open")
    }

    removeGalleryItem(entry: InfoEntry) {
        let el = this.parent.querySelector(`[data-item-id="${entry.ItemId}"]`)
        el?.remove()
    }

    add(entry: InfoEntry) {
        return renderGalleryItem(entry, this.parent)
    }

    sub(entry: InfoEntry) {
        this.removeGalleryItem(entry)
    }

    addList(entry: InfoEntry[]) {
        for (let item of entry) {
            renderGalleryItem(item, this.parent)
        }
    }

    subList(entry: InfoEntry[]) {
        for (let item of entry) {
            this.removeGalleryItem(item)
        }
    }

    refresh(id: bigint) {
        const entry = items_getEntry(id)
        let el = this.parent.querySelector(`[data-item-id="${entry.ItemId}"]`)
        if(!el) {
            console.error("Failed to refresh gallery item")
            return
        }
        const frag = new DocumentFragment()
        renderGalleryItem(entry.info, frag)
        this.parent.replaceChild(frag, el)
    }

    clearSelected() {
        for (let child of this.parent.querySelectorAll(`[data-item-id]`)) {
            child.remove()
        }
    }

    chwin(win: Window & typeof globalThis) {
        this.win.close()
        this.win = win
        this.parent = win.document.getElementById("gallery-items") as HTMLDivElement
    }
    close() {
        this.win.document.getElementById("gallery-output")?.classList.remove("open")
        this.clearSelected()
    }
}
