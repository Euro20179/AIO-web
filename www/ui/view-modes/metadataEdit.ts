type MetadataMode = {
} & Mode

var MetadataMode: ModeConstructor<MetadataMode> =
function(this: MetadataMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)
} as any

MetadataMode.prototype.mkcontainers = function(this: MetadataMode, into: HTMLElement | DocumentFragment) {
    const c = this.mkcontainer()
    into.append(c)
    return { container: c, output: c }
}

MetadataMode.prototype.mkcontainer = function(this: MetadataMode) {
    const c = this.win.document.createElement("div")
    c.id = 'metadata-items'
    c.classList.add("overflow")
    return c
}

async function renderMetadataItem(out: HTMLElement, meta: MetadataEntry) {
    const el = out.shadowRoot
    if (!el) {
        throw new Error("out does not contain a shadowroot")
    }

    const renderComponent = (query: string,
        fill: (element: HTMLElement, itemId: bigint) => any) => {
        for (let l of el.querySelectorAll(query)) {
            fill(l as HTMLElement, meta.ItemId)
        }
    }

    renderComponent("#provider", l => {
        if("value" in l)
            l.value = meta.Provider
    })

    renderComponent("#rating-percent", l => {
        l.innerText = String(meta.Rating / (meta.RatingMax || 1) * 100)
    })

    renderComponent("#thumbnail", l => {
        if(!("src" in l)) return
        l.src = fixThumbnailURL(meta.Thumbnail)
    })

    const fileUpload = el.getElementById("thumbnail-file-upload")

    if (fileUpload instanceof HTMLInputElement && "files" in fileUpload) {
        fileUpload.onchange = async function(_) {
            const reader = new FileReader()
            const blob = (fileUpload.files)?.[0]
            if (!blob) return
            reader.readAsDataURL(blob)
            reader.onload = () => {
                if (!reader.result) return
                let result = reader.result.toString()
                meta = items_getMetadata(meta.ItemId)
                setPropUI(meta, "Thumbnail", result, "set thumbnail")
            }
        }
    }

    updateDeclarativeDSL(
        {
            setthumbnail: function() {
                const fileUpload = el.getElementById("thumbnail-file-upload")
                if (!fileUpload || !("value" in fileUpload)) return

                fileUpload.click()
            },

            save: (el, event) => {
                let property = el.getAttribute("entry-action-save") || el.getAttribute("put-data")
                if (!property || !(property in meta)) {
                    alert("Failed to save, unknown property, THIS SHOULD NEVER OCCUR")
                    throw new Error(`Failed to save, unknown property ${property}`)
                }
                console.log(el)
                meta = items_getMetadata(meta.ItemId)
                let val: string | number = el.innerText.trim()
                if("value" in el && el.value) {
                    val = el.value.toString()
                }
                if (el.getAttribute("type") === "number") {
                    val = Number(val)
                }
                setPropUI(meta, property as keyof typeof meta, val, `set ${property}`)
            }
        },
        settings_get(getUserUID(), "enable_unsafe"),
        items_meta2info(meta),
        items_meta2user(meta),
        meta,
        el
    )
}

MetadataMode.prototype.add = function(this: MetadataMode, entry: InfoEntry) {
    const out = document.createElement("metadata-item")
    this.output.append(out)
    items_getMetadataById(entry.ItemId).then(meta => {
        out.setAttribute("data-item-id", String(meta.ItemId))
        renderMetadataItem(out, meta)
    })
    return out
}

MetadataMode.prototype.addList = function(this: MetadataMode, entries: InfoEntry[]) {
    for(let entry of entries) {
        this.add(entry)
    }
}


MetadataMode.prototype.clearSelected = function(this: MetadataMode) {
    for(let item of this.win.document.querySelectorAll("metadata-item")) {
        item.remove()
    }
}

MetadataMode.prototype.close = function(this: MetadataMode) {
    if(this.container)
        this.container.remove()
    this.clearSelected()
}

MetadataMode.prototype.chwin = function(this: GalleryMode, win: Window & typeof globalThis) {
    const container = ModePrimitives.chwin.call(this, win)
    this.win = win
    this.output = container.querySelector("#metadata-items") as HTMLDivElement
    return container
}
mode_register("metadata", MetadataMode)
