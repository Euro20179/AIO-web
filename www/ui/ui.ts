/*
 * This file is for functions that should be called by the ui to handle api operations
 * with client-side inputs
*/

function getUidUI() {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement
    return Number(uidSelector.value)
}

function getSearchDataUI() {
    let form = document.getElementById("sidebar-form") as HTMLFormElement
    let data = new FormData(form)
    return data
}

function deleteEntryUI(item: InfoEntry) {
    if (!confirm("Are you sure you want to delete this item")) {
        return
    }

    api_deleteEntry(item.ItemId).then(res => {
        if (res?.status != 200) {
            console.error(res)
            alert("Failed to delete item")
            return
        }
        alert(`Deleted: ${item.En_Title} (${item.Native_Title} : ${item.ItemId})`)
        updateInfo2({
            [String(item.ItemId)]: { info: item }
        }, true)
        deselectItem(item)
        removeSidebarItem(item)
    })
}

async function fetchLocationUI(id: bigint, provider?: string) {
    let res = await api_fetchLocation(id, getUidUI(), provider)
    if (res?.status !== 200) {
        alert("Failed to get location")
        return
    }

    let newLocation = await res.text()

    let item = findInfoEntryById(id) as InfoEntry

    item.Location = newLocation

    updateInfo2({
        [String(item.ItemId)]: { info: item }
    })
    alert(`Location set to: ${newLocation}`)
}

function overwriteEntryMetadataUI(_root: ShadowRoot, item: InfoEntry) {
    if (!confirm("Are you sure you want to overwrite the metadata with a refresh")) {
        return
    }

    api_overwriteMetadataEntry(item.ItemId).then(res => {
        if (res?.status !== 200) {
            console.error(res)
            alert("Failed to get metadata")
            return
        }

        alert("Metadata set")

        res.json().then((newMeta: MetadataEntry) => {
            let sId = String(item.ItemId)
            updateInfo2({ [sId]: { meta: newMeta } })

            if (newMeta.Provider === "steam") {
                fetchLocationUI(item.ItemId, "steam")
            }
        })
    })
}

async function newEntryUI(form: HTMLFormElement) {
    document.getElementById("new-entry")?.hidePopover()
    const data = new FormData(form)

    let artStyle = 0

    const styles = ['is-anime', 'is-cartoon', 'is-handrawn', 'is-digital', 'is-cgi', 'is-live-action']
    for (let i = 0; i < styles.length; i++) {
        let style = styles[i]
        if (data.get(style)) {
            artStyle |= 2 ** i
            data.delete(style)
        }
    }

    let validEntries: Record<string, FormDataEntryValue> = {}
    for (let [name, value] of data.entries()) {
        if (value == "") continue
        validEntries[name] = value
    }

    if (validEntries["libraryId"] && validEntries["libraryId"] == "0") {
        delete validEntries["libraryId"]
    }

    const queryString = "?" + Object.entries(validEntries).map(v => `${v[0]}=${encodeURIComponent(String(v[1]))}`).join("&") + `&art-style=${artStyle}`

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

    let res = await authorizedRequest(`${apiPath}/add-entry${queryString}&timezone=${encodeURIComponent(tz)}`)
    let text = await res?.text()
    if (res?.status !== 200 || !text) {
        alert(text)
        return
    }

    let json = api_deserializeJsonl(text).next().value
    api_getEntryMetadata(json.ItemId, getUidUI()).then(async (res) => {
        if (res.status !== 200) {
            alert("Failed to load new item metadata, please reload")
            return
        }

        const data = api_deserializeJsonl(await res.text()).next().value

        updateInfo2({
            [json.ItemId]: {
                meta: data
            }
        })

        clearItems()

        selectItem(json, mode, true)

        clearSidebar()
        renderSidebarItem(json)
    }).catch(() => {
        alert("Failed to load new item metadata, please reload")
    })
}
const newItemForm = document.getElementById("new-item-form") as HTMLFormElement
newItemForm.onsubmit = function() {
    newEntryUI(newItemForm)
}

function fillItemListing(entries: Record<string, MetadataEntry>) {
    const popover = document.getElementById("items-listing") as HTMLDivElement
    popover.innerHTML = ""

    const container = popover.querySelector("div") || document.createElement("div")
    container.classList.add("grid")
    container.classList.add("center")
    container.style.gridTemplateColumns = "1fr 1fr 1fr"

    for (let id in entries) {
        //no need to re-render the element (thumbnail or title might be different, that's ok)
        if (container.querySelector(`[data-item-id="${id}"]`)) {
            continue
        }

        const entry = entries[id]


        const title = entry.Title || entry.Native_Title || "unknown"

        const fig = document.createElement("figure")

        fig.style.cursor = "pointer"

        fig.setAttribute("data-item-id", String(id))

        const img = document.createElement("img")
        img.src = fixThumbnailURL(entry.Thumbnail)
        img.width = 100
        img.loading = "lazy"
        const caption = document.createElement("figcaption")
        caption.innerText = title

        fig.append(img)
        fig.append(caption)

        container.append(fig)
    }

    popover.append(container)
    return container
}

async function selectExistingItem(): Promise<null | bigint> {
    const popover = document.getElementById("items-listing") as HTMLDivElement

    const container = fillItemListing(items_getAllMeta())

    popover.showPopover()

    return await new Promise((res, rej) => {
        for (let fig of container.querySelectorAll("figure")) {
            const id = fig.getAttribute("data-item-id")
            fig.onclick = () => {
                popover.hidePopover()
                res(BigInt(id as string))
            }
        }

        setTimeout(() => {
            rej(null)
            popover.hidePopover()
        }, 60000)
    })
}

async function signinUI(reason: string): Promise<string> {
    const loginPopover = document.getElementById("login") as HTMLDialogElement
    (loginPopover.querySelector("#login-reason") as HTMLParagraphElement)!.innerText = reason || ""

    //if the popover is already open, something already called this function for the user to sign in
    if (loginPopover.matches(":popover-open")) {
        return await new Promise((res, rej) => {
            //wait until the user finally does sign in, and the userAuth is set, when it is set, the user has signed in and this function can return the authorization
            setInterval(() => {
                let auth = sessionStorage.getItem("userAuth")
                if (auth) {
                    res(auth)
                }
            }, 16)
        })
    }

    loginPopover.showPopover()
    return await new Promise((res, rej) => {
        const form = loginPopover.querySelector("form") as HTMLFormElement
        form.onsubmit = function() {
            let data = new FormData(form)
            let username = data.get("username")
            let password = data.get("password")
            loginPopover.hidePopover()
            res(btoa(`${username}:${password}`))
        }

        setTimeout(() => {
            loginPopover.hidePopover()
            rej(null)
        }, 60000)
    })
}
