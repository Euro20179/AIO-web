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

async function refreshMetadataItem(out: HTMLElement, meta: MetadataEntry, win: Window & typeof globalThis = window) {
    const el = out.shadowRoot
    if (!el) {
        throw new Error("out does not contain a shadowroot")
    }

    component_render(el, "#provider", l => {
        if("value" in l)
            l.value = meta.Provider
    }, [meta.Provider])

    component_render(el, "#rating-percent", l => {
        l.innerText = String(meta.Rating / (meta.RatingMax || 1) * 100)
    }, [meta.Rating, meta.RatingMax])

    component_render(el, "#thumbnail", l => {
        if(!("src" in l)) return
        l.src = fixThumbnailURL(meta.Thumbnail)
    }, [meta.Thumbnail])

    component_render(el, "#create-genre", l => {
        l.onclick = async () => {
            inputItemUI(l, 'genre', (e, genre) => {
                let genres = JSON.parse(meta.Genres) as string[]
                if(genres.includes(genre)) {
                    alert(`${genre} is already added as a genre`)
                    return
                }
                genres.push(genre)
                setPropUI(meta, "Genres", JSON.stringify(genres), `add genre: ${genre}`)
            })
        }
    }, 1)

    component_render(el, "#genres", l => {
        component_renderList(l, JSON.parse(meta.Genres || "[]"), (e, tag) => {
            if (!(e.target instanceof win.HTMLElement) || e.target.parentElement !== l) return
            ui_search(`#g:${tag}`)
        })
    }, [meta.Genres])

    component_render(el, "#media-dependant", l => {
        let body = dom_getelorthrow("tbody", win.HTMLTableSectionElement, l)
        let md = JSON.parse(meta.MediaDependant)

        body.replaceChildren()

        for(let key in md) {
            let val = md[key]
            let r = body.insertRow()
            let k = r.insertCell()
            let v = r.insertCell()

            k.contentEditable = 'true'
            v.contentEditable = 'true'

            k.setAttribute("entry-action", "savetable")
            k.setAttribute("entry-action-target", "#media-dependant")
            k.setAttribute("entry-action-trigger", "blur")
            k.setAttribute("entry-action-save-as", "MediaDependant")
            v.setAttribute("entry-action", "savetable")
            v.setAttribute("entry-action-target", "#media-dependant")
            v.setAttribute("entry-action-trigger", "blur")
            v.setAttribute("entry-action-save-as", "MediaDependant")

            k.append(key)
            v.append(val)
        }
    }, [meta.MediaDependant])

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

    function saveTable(l: HTMLElement) {
        let t = l.getAttribute("entry-action-target")
        if (!t) {
            throw new Error("No entry-action-target given for addrow")
        }
        let prop = l.getAttribute("entry-action-save-as")
        let sr = l.getRootNode() as ShadowRoot
        let el = dom_getelorthrow(t, win.HTMLElement, sr)
        let j: Record<string, string> = {}
        for(let row of el.querySelectorAll("tbody tr")) {
            let k = dom_getelorthrow("td:first-of-type", win.HTMLTableCellElement, row)
            let v = dom_getelorthrow("td:last-of-type", win.HTMLTableCellElement, row)
            let key = k.innerText
            let val = v.innerText
            if(!key.trim()) continue
            j[key.trim()] = val
        }

        if(prop !== "MediaDependant") {
            throw new Error(`${prop} is not a json metdata key`)
        }

        setPropUI(meta, prop, JSON.stringify(j), `set ${prop}`)
    }

    updateDeclarativeDSL(
        {
            editdescription(l, e) {
                let descel = (l.getRootNode() as ShadowRoot).querySelector('[put-data="Description"]')
                if(!descel) return
                let te = document.createElement("textarea")
                meta = items_getMetadata(meta.ItemId)
                te.id = 'edit-description'
                te.value = meta.Description
                te.cols = 70
                te.rows = 10
                const saveDesc = () => {
                    meta = items_getMetadata(meta.ItemId)
                    setPropUI(meta, "Description", te.value, "update description").then(() => {
                        descel.innerHTML = meta.Description
                        te.replaceWith(descel)
                    })
                }
                l.onclick = saveDesc
                te.onchange = saveDesc
                descel.replaceWith(te)
            },
            deletetag(l, e) {
                let target = e.target
                if (!target || !(target instanceof win.HTMLElement)) return
                const tag = target.getAttribute("tag-name")
                if (!tag) {
                    console.warn("The target with entry-aciton=deletetag has no tag-name")
                    alert("This button is not hooked up to a genre")
                    return
                }

                confirmUI(`Are you sure you want to delete the genre: ${tag}`)
                    .then(res => {
                        if(!res) return
                        let genres = JSON.parse(meta.Genres) as string[]
                        genres = genres.filter(k => k != tag)
                        return setPropUI(meta, "Genres", JSON.stringify(genres), `remove genre: ${tag}`)
                    })
                    .then(res => {
                        if (res?.status !== 200) return ""
                        alert("Removed genre")
                    })
            },
            addrow(l) {
                let t = l.getAttribute("entry-action-target")
                if (!t) {
                    throw new Error("No entry-action-target given for addrow")
                }
                let sr = l.getRootNode() as ShadowRoot
                let el = dom_getelorthrow(t, win.HTMLTableSectionElement, sr)
                let r = el.insertRow()
                let k = r.insertCell()
                let v = r.insertCell()
                v.append("VALUE")
                v.contentEditable = 'true'
                k.append("NAME")
                k.contentEditable = 'true'

                k.onblur = (e) => {
                    saveTable(k)
                }
                v.onblur = e => {
                    saveTable(v)
                }
                k.setAttribute("entry-action-target", "#media-dependant")
                k.setAttribute("entry-action-save-as", "MediaDependant")
                v.setAttribute("entry-action-target", "#media-dependant")
                v.setAttribute("entry-action-save-as", "MediaDependant")
            },

            setthumbnail: function() {
                const fileUpload = el.getElementById("thumbnail-file-upload")
                if (!fileUpload || !("value" in fileUpload)) return

                fileUpload.click()
            },

            savetable(l) {
                saveTable(l)
            },

            save: (el, event) => {
                let property = el.getAttribute("entry-action-save") || el.getAttribute("put-data")
                if (!property || !(property in meta)) {
                    alert("Failed to save, unknown property, THIS SHOULD NEVER OCCUR")
                    throw new Error(`Failed to save, unknown property ${property}`)
                }
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

MetadataMode.prototype.add = function(this: MetadataMode, entry: InfoEntry, options?: {
    meta?: MetadataEntry
}) {
    const out = document.createElement("metadata-item")
    this.output.append(out)
    if (options?.meta) {
        out.setAttribute("data-item-id", String(options.meta.ItemId))
        refreshMetadataItem(out, options.meta, this.win)
    } else {
        items_getMetadataById(entry.ItemId).then(meta => {
            out.setAttribute("data-item-id", String(meta.ItemId))
            refreshMetadataItem(out, meta, this.win)
        })
    }
    return out
}

MetadataMode.prototype.addList = function(this: MetadataMode, entries: InfoEntry[]) {
    for(let entry of entries) {
        this.add(entry)
    }
}

MetadataMode.prototype.sub = function(this: MetadataMode, entry: InfoEntry) {
    let el = this.output.querySelector(`metadata-item[data-item-id=${entry.MetadataId}]`)
    if(el) el.remove()
}

MetadataMode.prototype.subList = function(this: MetadataMode, entries: InfoEntry[]) {
    for(let e of entries) {
        this.sub(e)
    }
}

MetadataMode.prototype.refresh = function(this: MetadataMode, id: bigint) {
    let el = this.output.querySelector(`metadata-item[data-item-id="${id}"]`) as HTMLElement
    if(el)
        refreshMetadataItem(el, findMetadataById(id), this.win)
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
