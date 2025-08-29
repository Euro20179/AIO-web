function renderGalleryItem(item: InfoEntry, parent: HTMLElement | DocumentFragment) {
    const entry = document.createElement("gallery-entry")
    const root = entry.shadowRoot
    if(!root) {
        alert("Could not add gallery item, gallery-entry has no shadowroot")
        return
    }

    entry.setAttribute("data-item-id", String(item.ItemId))

    let meta = findMetadataById(item.ItemId)
    if (meta?.Thumbnail) {
        const thumb = fixThumbnailURL(meta.Thumbnail)

        const thumbImg = root.querySelector("#thumbnail") as HTMLImageElement
        thumbImg.src = thumb
    }

    const title = item.En_Title || meta.Title || item.Native_Title || meta.Native_Title
    const titleE = root.querySelector("#title") as HTMLElement
    titleE.append(title)

    const rating = findUserEntryById(item.ItemId).UserRating
    const ratingE = root.querySelector("#rating") as HTMLSpanElement
    ratingE.append(String(rating))

    parent.appendChild(entry)
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
