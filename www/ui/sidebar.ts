const sidebarItems = document.getElementById("sidebar-items") as HTMLElement

const sidebarIntersected: Set<string> = new Set()
const sidebarObserver = new IntersectionObserver((entries) => {
    for (let entry of entries) {
        if (entry.isIntersecting) {
            entry.target.dispatchEvent(new Event("on-screen-appear"))
        }
    }
}, {
    root: document.getElementById("sidebar"),
    rootMargin: "0px",
    threshold: 0.1
})

function clearSidebar() {

    sidebarIntersected.clear()

    while (sidebarItems.firstElementChild) {
        sidebarObserver.unobserve(sidebarItems.firstElementChild)
        sidebarItems.firstElementChild.remove()
    }
}

function refreshSidebarItem(itemId: bigint) {
    //DO NOT REFRESH if this item is not a result, otherwise it'll add unecessary sidebar items
    if(!globalsNewUi.results.find(v => v.ItemId === itemId)) {
        return
    }
    let el = document.querySelector(`sidebar-entry[data-entry-id="${itemId}"]`) as HTMLElement
    let item = findInfoEntryById(itemId)
    if (el) {
        changeSidebarItemData(itemId, el)
    } else {
        renderSidebarItem(item)
    }

    let meta = findMetadataById(itemId)
    if (meta)
        updateSidebarThumbnail(itemId, meta?.Thumbnail)
}


function removeSidebarItem(item: InfoEntry) {
    sidebarIntersected.delete(String(item.ItemId))

    sidebarItems.querySelector(`[data-entry-id="${item.ItemId}"]`)?.remove()
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
        clearItems()
    }
    if (viewAllElem.checked) {
        selectItemList(entries, mode)
    } else {
        selectItem(entries[0], mode)
    }
}

function reorderSidebar(itemOrder: bigint[], select = true) {
    let elems = []
    for (let item of itemOrder) {
        let elem = sidebarItems.querySelector(`[data-entry-id="${item}"]`) as HTMLElement
        if (!elem) continue
        elems.push(elem)
    }
    sidebarItems.replaceChildren(...elems)

    if (select) {
        selectSidebarItems(itemOrder.map(v => findInfoEntryById(v)))
    }
}

function changeSidebarItemData(id: bigint, el: HTMLElement) {
    updateSidebarEntryContents(findInfoEntryById(id), findUserEntryById(id), findMetadataById(id), el.shadowRoot as ShadowRoot)
    el.setAttribute("data-entry-id", String(id))
}

function sidebarEntryOpenMultiple(item: InfoEntry, mode: DisplayMode) {
    clearItems()
    selectItem(item, mode)
}

function sidebarEntryOpenOne(item: InfoEntry) {
    toggleItem(item)
}

function updateSidebarThumbnail(id: bigint, src: string) {
    const elem = sidebarItems.querySelector(`[data-entry-id="${id}"]`)
    if (!elem) return
    let img = elem.shadowRoot?.querySelector("img") as HTMLImageElement
    img.src = fixThumbnailURL(src)
}

/**
  * @description below is an itemid that the item gets rendered below
*/
function renderSidebarItem(item: InfoEntry, sidebarParent: HTMLElement | DocumentFragment = sidebarItems, options?: {
    below?: string,
    renderImg?: boolean
}) {
    let elem = document.createElement("sidebar-entry")

    let meta = findMetadataById(item.ItemId)
    let user = findUserEntryById(item.ItemId)
    if (!user || !meta || !elem.shadowRoot) return elem

    if (options?.below) {
        const renderBelow = sidebarParent.querySelector(`[data-entry-id="${options.below}"]`) as HTMLElement
        renderBelow?.insertAdjacentElement("afterend", elem)
    } else {
        sidebarParent.append(elem)
    }

    let img = elem.shadowRoot.querySelector("[part=\"thumbnail\"]") as HTMLImageElement
    if (img) {
        img.addEventListener("mousedown", e => {
            if (e.ctrlKey) {
                sidebarEntryOpenOne(item)
            } else {
                sidebarEntryOpenMultiple(item, mode)
            }
        })

        if (options?.renderImg && meta.Thumbnail) {
            img.src = fixThumbnailURL(meta.Thumbnail)
        } else {
            sidebarObserver.observe(elem)
        }
    }

    let title = elem.shadowRoot?.getElementById("sidebar-title") as HTMLInputElement
    if (title) {
        title.onchange = function() {
            if (title.value)
                api_updateInfoTitle(item.ItemId, title.value)
        }
    }

    elem.addEventListener("on-screen-appear", async function(e) {
        let meta = await findMetadataByIdAtAllCosts(item.ItemId)
        if (img.src !== fixThumbnailURL(meta.Thumbnail)) {
            img.src = fixThumbnailURL(meta.Thumbnail)
        }
    })

    changeSidebarItemData(item.ItemId, elem)

    return elem
}

function renderSidebar(entries: InfoEntry[], clearRendered = true) {
    if (!entries.length) return
    if (clearRendered) {
        clearSidebar()
    }
    for (let i = 0; i < entries.length; i++) {
        renderSidebarItem(entries[i])
    }
    selectSidebarItems(entries, clearRendered)
}
