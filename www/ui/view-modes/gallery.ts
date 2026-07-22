function renderGalleryItem(item: InfoEntry, parent: HTMLElement | DocumentFragment) {
    const entry = document.createElement("gallery-entry")
    parent.appendChild(entry)

    const root = entry.shadowRoot
    if (!root) {
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


    const pbars = dom_getel("#progress-bars", null, root)
    if(pbars) {
        const user = findUserEntryById(item.ItemId)
        const parts = items_getProgressParts(user.CurrentPosition)
        let lengthInNumber = items_getLength(JSON.parse(meta["MediaDependant"] || "{}"))[0] || 0
        for (let part of parts) {
            if (!part) continue
            let label = part[1]

            let container = document.createElement("de-progress")

            pbars.append(container)

            let max =
                //if there's no label, and no total is given
                //use the mediaDependant determined length
                !label && part[3] === undefined
                    ? (lengthInNumber || 0)
                    : (part[3] || 0) //part[3] could be empty string

            let p = dom_getel(
                "progress",
                currentWindow().HTMLProgressElement,
                container
            )
            if(!p) break
            p.setAttribute("data-status", user.Status)
            p.max = parseFloat(String(max))
            p.value = parseFloat(part[2])

            let c = dom_getel(
                ".entry-progressbar-position-label",
                null,
                container
            )
            if(!c) continue
            const node = document.createTextNode(`${label || ""}${part[2]}`)
            if (max) {
                node.appendData(`/${max}`)
            }
            c.append(node)

            const upHint = dom_getel(
                "#user-progress-hint",
                null,
                c
            )
            if(!upHint) continue
            upHint.innerHTML = `${(Math.round(parseFloat(part[2]) / parseInt(String(max)) * 1000) / 10) || 0}%`
        }
    }

    updateDeclarativeDSL({
        setprogress: () => {},
        openitem: target => {
            const root = target.getRootNode() as ShadowRoot
            const id = BigInt(root.host.getAttribute("data-item-id") || 0)
            if (!id) return
            openDisplayWinUI(id)
        }
    }, settings_get(getUserUID(), "enable_unsafe"), item, findUserEntryById(item.ItemId), meta, root)
    return entry
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
