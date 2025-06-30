function renderGalleryItem(item: InfoEntry, parent: HTMLElement | DocumentFragment) {
    let el = new Image()
    let meta = findMetadataById(item.ItemId)
    if (meta?.Thumbnail) {
        el.src = fixThumbnailURL(meta.Thumbnail)
    }
    el.title = item.En_Title
    el.setAttribute("data-item-id", String(item.ItemId))

    parent.appendChild(el)
    return el
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
