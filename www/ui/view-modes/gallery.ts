let galleryItems = document.getElementById("gallery-items") as HTMLDivElement

function renderGalleryItem(item: InfoEntry, parent: HTMLElement | DocumentFragment = galleryItems) {
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

function removeGalleryItem(entry: InfoEntry) {
    let el = galleryItems.querySelector(`[data-item-id="${entry.ItemId}"]`)
    el?.remove()
}

const modeGallery: DisplayMode = {
    add(entry, parent?: HTMLElement | DocumentFragment) {
        return renderGalleryItem(entry, parent)
    },

    sub(entry) {
        removeGalleryItem(entry)
    },

    addList(entry) {
        for (let item of entry) {
            renderGalleryItem(item)
        }
    },

    subList(entry) {
        for (let item of entry) {
            removeGalleryItem(item)
        }
    },

    clearSelected() {
        for (let child of galleryItems.querySelectorAll(`[data-item-id]`)) {
            child.remove()
        }
    },

    chwin(win) {
        galleryItems = win.document.getElementById("gallery-items") as HTMLDivElement
    },
}
