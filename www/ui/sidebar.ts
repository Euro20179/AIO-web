const sidebarItems = document.getElementById("sidebar-items") as HTMLElement

const sidebarItemsOnScreen: Set<HTMLElement> = new Set()

const sidebarObserver = new IntersectionObserver((entries) => {
    for (let entry of entries) {
        if (entry.isIntersecting) {
            entry.target.dispatchEvent(new Event("on-screen-appear"))
            sidebarItemsOnScreen.add(entry.target as HTMLElement)
        } else if (sidebarItemsOnScreen.has(entry.target as HTMLElement)) {
            sidebarItemsOnScreen.delete(entry.target as HTMLElement)
        }
    }
}, {
    root: document.getElementById("sidebar"),
    rootMargin: "0px",
    threshold: 0.1
})

let resizeTO = 0
let setToNone = false
addEventListener("resize", () => {
    if (!setToNone) {
        for (let sidebarEntry of document.querySelectorAll("sidebar-entry") as NodeListOf<HTMLElement>) {
            if (sidebarItemsOnScreen.has(sidebarEntry)) continue
            sidebarEntry.style.display = 'none'
        }
        setToNone = true
    }

    if (resizeTO) {
        clearTimeout(resizeTO)
    }
    resizeTO = setTimeout(() => {
        setToNone = false
        resizeTO = 0
        for (let sidebarEntry of document.querySelectorAll("sidebar-entry") as NodeListOf<HTMLElement>) {
            if (sidebarItemsOnScreen.has(sidebarEntry)) continue
            sidebarEntry.style.display = ''
        }
    }, 200)
})

//@ts-ignore
addEventListener("modes.update-item", (e: CustomEvent) => {
    const id = e.detail
    refreshSidebarItem(BigInt(id))
})

function focusNthSidebarItem(n: number) {
    //@ts-ignore
    sidebarItems.querySelector(`:nth-child(${n})`)?.focus()
}

function selectFocusedSidebarItem() {
    if (document.activeElement?.tagName !== "SIDEBAR-ENTRY") return

    const id = document.activeElement.getAttribute("data-entry-id") as string
    mode_selectItem(findInfoEntryById(BigInt(id)))
}

function focusNextSidebarItem(backward: boolean = false) {
    const active = document.activeElement
    if (!active) return
    const next = backward
        ? active.previousElementSibling
        : active.nextElementSibling
    if (next && next instanceof HTMLElement)
        next.focus()
}

function clearSidebar() {

    while (sidebarItems.firstElementChild) {
        sidebarObserver.unobserve(sidebarItems.firstElementChild)
        sidebarItems.firstElementChild.remove()
    }
}

function refreshSidebarItem(itemId: bigint) {
    //DO NOT REFRESH if this item is not a result, otherwise it'll add unecessary sidebar items
    if (!items_getResults().find(v => v.ItemId === itemId)) {
        return
    }
    let el = document.querySelector(`sidebar-entry[data-entry-id="${itemId}"]`) as HTMLElement
    if (el) {
        changeSidebarItemData(itemId, el)
        let meta = findMetadataById(itemId)
        if (meta)
            updateSidebarThumbnail(itemId, meta?.Thumbnail)
    }
}


function removeSidebarItem(item: InfoEntry) {
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
        mode_clearItems()
    }
    if (viewAllElem.checked) {
        mode_selectItemList(entries)
    } else {
        mode_selectItem(entries[0])
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

function sidebarEntryOpenOne(item: InfoEntry) {
    mode_clearItems()
    mode_selectItem(item)
}

/**
 * selects the nth sidebar entry, where n starts at 1
 */
function sidebarSelectNth(n: number) {
    const el = sidebarItems.querySelector(`:nth-child(${n})`)
    if (!el) return
    const id = BigInt(el.getAttribute("data-entry-id") || 0)
    if (id == 0n) return

    mode_selectItem(findInfoEntryById(id))
}

function sidebarEntryOpenMultiple(item: InfoEntry) {
    mode_toggleItem(item)
}

function updateSidebarThumbnail(id: bigint, src: string) {
    const elem = sidebarItems.querySelector(`[data-entry-id="${id}"]`)
    if (!elem) return
    let img = elem.shadowRoot?.querySelector("img") as HTMLImageElement
    img.src = fixThumbnailURL(src)
}

async function renderSidebarItemList(items: InfoEntry[], sidebarParent: HTMLElement | DocumentFragment = sidebarItems, options?: {
    below?: string,
    renderImg?: boolean
}) {
    for (let i = 0; i < items.length; i++) {
        if (i !== 0 && i % 20 == 0 && "scheduler" in window) {
            await scheduler.yield()
        }
        renderSidebarItem(items[i], sidebarParent, options)
    }
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

    elem.shadowRoot.querySelector("figure")?.setAttribute("aria-label", `${item.En_Title || item.Native_Title} thumbnail`)

    if (options?.below) {
        const renderBelow = sidebarParent.querySelector(`[data-entry-id="${options.below}"]`) as HTMLElement
        renderBelow?.insertAdjacentElement("afterend", elem)
    } else {
        sidebarParent.append(elem)
    }

    let img = elem.shadowRoot.querySelector("[part=\"thumbnail\"]") as HTMLImageElement
    if (img) {

        if (options?.renderImg && meta.Thumbnail) {
            img.src = fixThumbnailURL(meta.Thumbnail)
        } else {
            sidebarObserver.observe(elem)
        }
    }
    function handleMouse(button: number, altKey: boolean, ctrlKey: boolean) {
        if (button === 1) {
            displayItemInWindow(item.ItemId)
        }
        else if (altKey) {
            displayItemInWindow(item.ItemId, "_blank", true)
        }
        else if (ctrlKey) {
            sidebarEntryOpenMultiple(item)
        } else {
            sidebarEntryOpenOne(item)
        }
    }

    const btn = elem.shadowRoot.querySelector("button") as HTMLButtonElement
    btn.addEventListener("mousedown", e => {
        if (e.button === 1 || e.button === 0) {
            handleMouse(e.button, e.altKey, e.ctrlKey)
            e.preventDefault()
        }
    })
    btn.addEventListener("keydown", e => {
        if (e.key === " " || e.key === "Enter") {
            handleMouse(0, e.altKey, e.ctrlKey)
            e.preventDefault()
        }
    })

    let title = elem.shadowRoot?.getElementById("sidebar-title") as HTMLInputElement
    title && (
        title.onchange = (e) =>
            e.target instanceof HTMLInputElement &&
            updateUserTitleUI(item.ItemId, e.target.value)
    )

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
    const fragments = []
    for (let i = 0; i < entries.length; i++) {
        const frag = new DocumentFragment
        renderSidebarItem(entries[i], frag)
        fragments.push(frag)
    }
    sidebarItems.replaceChildren(...fragments)
    selectSidebarItems(entries, clearRendered)
}
