const displayItems = document.getElementById("entry-output") as HTMLElement

let displayQueue: InfoEntry[] = []

async function itemIdentification(form: HTMLFormElement) {
    form.parentElement?.hidePopover()
    let data = new FormData(form)

    let provider = data.get("provider") as string

    let queryType = data.get("query-type") as "by-title" | "by-id"

    let search = data.get("search") as string

    let shadowRoot = form.getRootNode() as ShadowRoot

    let itemId = shadowRoot.host.getAttribute("data-item-id")

    if (!itemId) {
        alert("Could not get item id")
        return
    }

    let finalItemId = ""

    switch (queryType) {
        case "by-title":
            let titleSearchContainer = shadowRoot.getElementById("identify-items") as HTMLDialogElement
            finalItemId = await titleIdentification(provider, search, titleSearchContainer) || ""

            if (!finalItemId) {
                alert("Failed to identify item")
                return
            }

            break
        case "by-id":
            finalItemId = search
            break
    }

    api_finalizeIdentify(finalItemId, provider, BigInt(itemId))
        .then((res) => res?.text())
        .then((json) => {
            if (!json) {
                alert(`Failed to reload meta: ${json}, please refresh`)
                return
            }

            const newMeta = [...api_deserializeJsonl(json)][0]

            //if the provider also has a location provider might as well get the location for it
            if (["steam", "sonarr"].includes(provider)) {
                fetchLocationUI(BigInt(itemId), provider)
            }

            updateInfo2({
                [String(itemId)]: {
                    meta: newMeta
                }
            })
        })
}

async function titleIdentification(provider: string, search: string, selectionElemOutput: HTMLElement): Promise<string | null> {
    let res = await api_identify(search, provider)
    if (!res) {
        return null
    }
    let text = await res.text()
    let [_, rest] = text.split("\x02")

    let items: any[]
    try {
        items = rest.split("\n").filter(Boolean).map(v => JSON.parse(v))
    }
    catch (err) {
        console.error("Could not parse json", rest.split('\n'))
        return ""
    }

    while (selectionElemOutput.children.length) {
        selectionElemOutput.firstChild?.remove()
    }

    selectionElemOutput.showPopover()

    return await new Promise(RETURN => {
        for (let result of items) {
            let fig = document.createElement("figure")

            let img = document.createElement("img")
            img.src = result.Thumbnail
            img.style.cursor = "pointer"
            img.width = 100

            img.addEventListener("click", _e => {
                selectionElemOutput.hidePopover()
                RETURN(result.ItemId)
            })

            let title = document.createElement("h3")
            title.innerText = result.Title || result.Native_Title
            title.title = result.Native_Title || result.Title

            fig.append(title)
            fig.append(img)
            selectionElemOutput.append(fig)
        }
    })
}


function saveItemChanges(root: ShadowRoot, itemId: bigint) {
    if (!confirm("Are you sure you want to save changes?")) {
        return
    }

    let userEntry = findUserEntryById(itemId)
    if (!userEntry) return

    let infoTable = root.getElementById("info-raw")
    let metaTable = root.getElementById("meta-info-raw")
    let userTable = root.getElementById("user-info-raw")

    const updateWithTable: (table: Element, item: InfoEntry | MetadataEntry | UserEntry) => void = (table, item) => {
        for (let row of table?.querySelectorAll("tr") || []) {
            let nameChild = row.firstElementChild as HTMLElement
            let valueChild = row.firstElementChild?.nextElementSibling as HTMLElement
            let name = nameChild.innerText.trim()
            let value = valueChild.innerText.trim()
            if (!(name in item)) {
                console.log(`${name} NOT IN ITEM`)
                continue
            } else if (name === "ItemId") {
                console.log("Skipping ItemId")
                continue
            }
            let ty = item[name as keyof typeof item]?.constructor
            if (!ty) continue
            //@ts-ignore
            item[name] = ty(value)
        }
    }

    let info = findInfoEntryById(itemId)
    if (!info) return
    if (infoTable) {
        updateWithTable(infoTable, info)
    }

    let meta = findMetadataById(itemId)
    if (!meta) return

    if (metaTable)
        updateWithTable(metaTable, meta)

    if (userTable)
        updateWithTable(userTable, userEntry)

    const customStylesElem = root.getElementById("style-editor")
    const customTemplElem = root.getElementById("template-editor")

    if (customStylesElem && "value" in customStylesElem)
        setUserExtra(userEntry, "styles", String(customStylesElem.value))

    if (customTemplElem && "value" in customTemplElem) {
        let val = String(customTemplElem.value).trim()
        setUserExtra(userEntry, "template", val)
    }

    api_setItem("engagement/", userEntry)
        .then(res => res?.text())
        .then(console.log)
        .catch(console.error)
    api_setItem("", info)
        .then(res => res?.text())
        .then(console.log)
        .catch(console.error)

    api_setItem("metadata/", meta)
        .then(res => res?.text())
        .then(console.log)
        .catch(console.error)


    updateInfo2({
        [String(itemId)]: {
            info,
            meta,
            user: userEntry
        }
    })
}

function changeDisplayItemData(item: InfoEntry, user: UserEntry, meta: MetadataEntry, events: UserEvent[], el: HTMLElement) {
    const e = new CustomEvent("data-changed", {
        detail: {
            item,
            user,
            meta,
            events,
        }
    })
    el.dispatchEvent(e)
    el.setAttribute("data-item-id", String(item.ItemId))
}

function mkGenericTbl(root: HTMLElement, data: Record<any, any>) {
    let html = `
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
            `

    for (let key in data) {
        html += `<tr><td>${key}</td><td contenteditable>${data[key]}</td></tr>`
    }
    html += "</tbody>"
    root.innerHTML = html
}

const displayEntryIntersected: Set<string> = new Set()

function onIntersection(entries: IntersectionObserverEntry[]) {
    for (let entry of entries) {
        const entryId = entry.target.getAttribute("data-item-id") || "NA"
        if (entry.isIntersecting && displayQueue.length && !displayEntryIntersected.has(entryId)) {
            displayEntryIntersected.add(entryId)

            let newItem = displayQueue.shift()
            if (!newItem) continue
            modeDisplayEntry.add(newItem, false)
        }
    }
}

function displayEntryNewEvent(form: HTMLFormElement) {
    const data = new FormData(form)
    const name = data.get("name")
    if (name == null) {
        alert("Name required")
        return
    }
    const tsStr = data.get("timestamp")
    const aftertsStr = data.get("after")
    //@ts-ignore
    let ts = new Date(tsStr).getTime()
    if (isNaN(ts)) {
        ts = 0
    }
    //@ts-ignore
    let afterts = new Date(aftertsStr).getTime()
    if (isNaN(afterts)) {
        afterts = 0
    }
    const itemId = getIdFromDisplayElement(form)
    api_registerEvent(itemId, name.toString(), ts, afterts)
        .then(res => res?.text())
        .then(() => {
            updateInfo2({
                [String(itemId)]: {
                    events: [
                        {
                            Timestamp: ts,
                            After: afterts,
                            Event: name.toString(),
                            ItemId: itemId,
                            TimeZone: ""
                        }
                    ]
                }
            })
            form.parentElement?.hidePopover()
        })
        .catch(alert)
    //TODO: should be a modal thing for date picking
}

const observer = new IntersectionObserver(onIntersection, {
    root: document.getElementById("entry-output"),
    rootMargin: "0px",
    threshold: 0.1
})

const modeDisplayEntry: DisplayMode = {
    add(entry, updateStats = true, parent?: HTMLElement | DocumentFragment) {
        updateStats && changeResultStatsWithItem(entry)
        return renderDisplayItem(entry.ItemId, parent)
    },

    sub(entry, updateStats = true) {
        updateStats && changeResultStatsWithItem(entry, -1)
        removeDisplayItem(entry.ItemId)
    },

    refresh(id) {
        let el = document.querySelector(`display-entry[data-item-id="${id}"]`) as HTMLElement
        //only refresh if the item is on screen
        if (el)
            refreshDisplayItem(id)
    },

    addList(entry, updateStats = true) {
        displayEntryIntersected.clear()

        updateStats && changeResultStatsWithItemList(entry, 1)
        for (let i = 0; i < entry.length; i++) {
            if (i > 5) {
                displayQueue.push(entry[i])
            } else {
                renderDisplayItem(entry[i].ItemId)
            }
        }
    },

    subList(entry, updateStats = true) {
        updateStats && changeResultStatsWithItemList(entry, -1)

        const itemIdsToRemove = entry.map(v => v.ItemId)
        displayQueue = displayQueue.filter(i => !itemIdsToRemove.includes(i.ItemId))

        for (let item of entry) {
            removeDisplayItem(item.ItemId)
        }
    },

    putSelectedInCollection() {
        const selected = globalsNewUi.selectedEntries
        const collectionName = prompt("Id of collection")
        if (!collectionName) return

        let waiting = []
        for (let item of selected) {
            waiting.push(api_setParent(item.ItemId, BigInt(collectionName)))
        }
        Promise.all(waiting).then(res => {
            for (let r of res) {
                console.log(r?.status)
            }
        })
    },

    addTagsToSelected() {
        const tags = prompt("tags (, seperated)")
        if (!tags) return

        const tagsList = tags.split(",")
        for (let item of globalsNewUi.selectedEntries) {
            api_addEntryTags(item.ItemId, tagsList)
        }
        //FIXME: tags do not update immediately
    },

    put(html: string | HTMLElement | ShadowRoot) {
        if (typeof html === 'string') {
            return
        }
        displayItems.append(html)
    },

    clear() {
        for(let child of displayItems.querySelectorAll(":not(display-entry)")) {
            child.remove()
        }
    }
}

function hookActionButtons(shadowRoot: ShadowRoot, itemId: bigint) {

    let multiActionButton = shadowRoot.querySelector('[data-action="Begin+Pause+Resume"]')

    if (multiActionButton) {
        multiActionButton.addEventListener("click", _ => {
            const item = findInfoEntryById(itemId) as InfoEntry

            let user = findUserEntryById(itemId)
            if (!user) return

            let action = ""

            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

            if (canBegin(user.Status)) {
                action = "begin"
            } else if (canResume(user.Status)) {
                action = "resume"
            } else if (canPause(user.Status)) {
                action = "pause"
            }

            if (!action) {
                alert("Cannot begin, resume, or pause")
                return
            }

            if (!confirm(`Are you sure you want to ${action} this entry`)) {
                return
            }

            authorizedRequest(`${apiPath}/engagement/${action?.toLowerCase()}-media?id=${user.ItemId}&timezone=${encodeURIComponent(tz)}`)
                .then(res => {
                    if (res && res.status === 200) {
                        updateStatusDisplay(action, shadowRoot)
                    } else if (!res) {
                        alert("Could not update status")
                        return ""
                    }
                    return res.text()
                })
                .then(text => {
                    alert(text)

                    Promise.all([loadUserEvents(getUidUI()), items_refreshUserEntries(getUidUI())]).then(() =>
                        updateInfo2({
                            [String(item.ItemId)]: {
                                user: findUserEntryById(item.ItemId)
                            }
                        })
                    )
                })
        })
    }

    for (let btn of shadowRoot.querySelectorAll("[data-action]") || []) {
        let action = btn.getAttribute("data-action") as string

        //this action does multiple things
        if (action?.includes("+")) continue

        btn.addEventListener("click", _ => {
            const item = findInfoEntryById(itemId) as InfoEntry

            if (!confirm(`Are you sure you want to ${action} this entry`)) {
                return
            }

            let queryParams = `?id=${item.ItemId}`
            if (action === "Finish") {
                let rating = promptNumber("Rating", "Not a number\nRating")
                if (rating !== null) {
                    queryParams += `&rating=${rating}`
                }
            }

            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
            authorizedRequest(`${apiPath}/engagement/${action?.toLowerCase()}-media${queryParams}&timezone=${encodeURIComponent(tz)}`)
                .then(res => {
                    if (res && res.status === 200) {
                        updateStatusDisplay(action, shadowRoot)
                    } else if (!res) {
                        alert("Could not update status")
                        return ""
                    }
                    return res.text()
                })
                .then(text => {
                    alert(text)
                    Promise.all([loadUserEvents(getUidUI()), items_refreshUserEntries(getUidUI())]).then(() =>
                        updateInfo2({
                            [String(item.ItemId)]: {
                                user: findUserEntryById(item.ItemId),
                                events: findUserEventsById(item.ItemId),
                            }
                        })
                    )
                })
        })
    }


    let imgEl = shadowRoot.getElementById("thumbnail")
    const fileUpload = shadowRoot.getElementById("thumbnail-file-upload")

    if (fileUpload && "files" in fileUpload && Array.isArray(fileUpload.files)) {
        fileUpload.onchange = async function(_) {
            const item = findInfoEntryById(itemId) as InfoEntry

            const reader = new FileReader()
            const blob = (fileUpload.files as Array<Blob>)?.[0]
            if (!blob) return
            reader.readAsDataURL(blob)
            reader.onload = () => {
                if (!reader.result) return
                let result = reader.result.toString()
                api_setThumbnail(item.ItemId, result)
                    .then(() => {
                        let meta = findMetadataById(item.ItemId)
                        meta.Thumbnail = result
                        updateInfo2({
                            [String(item.ItemId)]: {
                                meta
                            }
                        })
                    })
            }
        }
    }

    if (imgEl) {
        imgEl.onclick = function(_) {
            if (!fileUpload || !("value" in fileUpload)) return

            fileUpload.click()
        }
    }
}

function updateCostDisplay(el: ShadowRoot, itemId: bigint) {
    const costEl = el.getElementById("cost")
    if (!costEl) return

    const info = findInfoEntryById(itemId)
    if (!info) return

    //@ts-ignore
    const includeSelf = (el.getElementById("include-self-in-cost"))?.checked
    //@ts-ignore
    const includeChildren = (el.getElementById("include-children-in-cost"))?.checked
    //@ts-ignore
    const includeCopies = (el.getElementById("include-copies-in-cost"))?.checked

    let costTotal = 0
    if (includeSelf) {
        costTotal += info.PurchasePrice
    }
    if (includeChildren) {
        let children = Object.values(globalsNewUi.entries).filter(v => v.info.ParentId === itemId)
        for (let child of children) {
            costTotal += child.info.PurchasePrice
        }
    }
    if (includeCopies) {
        let copies = Object.values(globalsNewUi.entries).filter(v => v.info.CopyOf === itemId)
        for (let copy of copies) {
            costTotal += copy.info.PurchasePrice
        }
    }
    costEl.innerText = String(costTotal)
}

function createRelationButtons(elementParent: HTMLElement, relationGenerator: Generator<Item>, relationType: "descendants" | "copies") {
    let relationships = relationGenerator.toArray()
    let titles = relationships.map(i => i.info.En_Title)
    relationships = relationships.sort((a, b) => {
        return (sequenceNumberGrabber(a.info.En_Title, titles) || 0) - (sequenceNumberGrabber(b.info.En_Title, titles) || 0)
    })
    for (let child of relationships) {
        let meta = findMetadataById(child.ItemId)
        let el: HTMLElement
        if (meta?.Thumbnail) {
            el = document.createElement("img")
            formatToName(child.info.Format).then(name => {
                el.title = `${child.info.En_Title} (${typeToSymbol(child.info.Type)} on ${name})`
            })
            //@ts-ignore
            el.src = fixThumbnailURL(meta.Thumbnail)
        } else {
            el = document.createElement("button")
            el.innerText = child.info.En_Title
        }
        elementParent.append(el)
        el.addEventListener("click", (e) => {
            toggleItem(child.info)
        })
        el.addEventListener("contextmenu", e => {
            e.preventDefault()
            const confirmationText = {
                "descendants": "Would you like to remove this item as a descendant of it's parent",
                "copies": "Would you like to remove this item as a copy"
            }
            if (confirm(confirmationText[relationType])) {
                let thisId: bigint
                switch (relationType) {
                    case "copies":
                        thisId = child.info.CopyOf
                        child.info.CopyOf = 0n
                        break
                    case "descendants":
                        thisId = child.info.ParentId
                        child.info.ParentId = 0n
                        break
                }
                api_setItem("", child.info).then((res) => {
                    if (!res || res.status !== 200) {
                        alert("Failed to update item")
                        return
                    }
                    updateInfo2({
                        [String(child.ItemId)]: { info: child.info }
                    })
                    refreshDisplayItem(thisId)
                })
            }
        })
    }
}

function updateStatusDisplay(newStatus: string, el: ShadowRoot) {
    const statusText = el.getElementById("status-selector")
    if (!statusText || !("value" in statusText)) return

    statusText.value = newStatus
    // statusText.innerText = newStatus
}

function updateObjectTbl(obj: object, el: ShadowRoot, clear = true) {
    const objectTbl = el.getElementById("display-info-object-tbl") as HTMLTableElement

    if (clear) {
        const firstTr = objectTbl.firstElementChild
        //remove all rows except the first
        while (objectTbl.lastElementChild && objectTbl.lastElementChild !== firstTr) {
            objectTbl.removeChild(objectTbl.lastElementChild)
        }
    }

    for (let key in obj) {
        let val = obj[key as keyof typeof obj] as any
        //if the key alr is in the table, and we aren't clearing, then skip
        //otherwise the key will get duplicated
        if (objectTbl.querySelector(`[data-keyname="${key}"]`) && !clear) {
            continue;
        }
        const tr = document.createElement("tr")
        const nameTd = document.createElement("td")
        const valTd = document.createElement("td")

        nameTd.setAttribute("data-keyname", key)
        nameTd.innerText = key

        valTd.setAttribute("data-type", typeof val)
        if (typeof val !== 'string' && typeof val !== 'number') {
            val = JSON.stringify(val)
        }
        valTd.innerText = val

        valTd.contentEditable = "true"
        nameTd.contentEditable = "true"

        tr.append(nameTd)
        tr.append(valTd)

        objectTbl.append(tr)
    }
}

function getCurrentObjectInObjEditor(itemId: bigint, el: ShadowRoot) {
    const editedObject = (el.getElementById("current-edited-object") as HTMLSelectElement).value
    const user = findUserEntryById(itemId) as UserEntry
    const meta = findMetadataById(itemId) as MetadataEntry

    switch (editedObject) {
        case "user-extra":
            return user.Extra || "{}"
        case "meta-datapoints":
            return meta.Datapoints || "{}"
        case "meta-media-dependant":
            return meta.MediaDependant || "{}"
        default:
            return "{}"
    }

}

/**
 * @description updates all put-data elements with their respective contents
 */
function updateBasicDisplayEntryContents(item: InfoEntry, user: UserEntry, meta: MetadataEntry, root: ShadowRoot) {
    //put-data, for basic data such as `put-data=Rating` or `put-data=info.En_Title,meta.Title`
    for (let elem of root.querySelectorAll("[put-data]")) {
        let keys = elem.getAttribute("put-data")?.split(",")
        if (!keys || !keys.length) continue

        for (let key of keys) {
            let data

            if (key.includes(".")) {
                let [from, realKey] = key.split(".")
                switch (from.toLowerCase()) {
                    case "info":
                        data = item[realKey as keyof typeof item]
                        break
                    case "meta":
                        data = meta[realKey as keyof typeof meta]
                        break
                    case "user":
                        data = user[realKey as keyof typeof user]
                        break
                }

            } else if (key in item) {
                data = String(item[key as keyof typeof item])
            } else if (key in meta) {
                data = String(meta[key as keyof typeof meta])
            } else if (key in user) {
                data = String(user[key as keyof typeof user])
            }

            if (!data) continue

            if (elem.getAttribute("put-data-mode") === "html") {
                elem.innerHTML = String(data)
            } else {
                elem.textContent = String(data)
                // elem.append(String(data))
            }

            break
        }
    }

    //put-tbl, for raw objects such as user.Extra
    for (let elem of root.querySelectorAll("[put-tbl]")) {
        let requestedObj = elem.getAttribute("put-tbl") || ""

        switch (requestedObj) {
            case "user.Extra":
            case "Extra":
                mkGenericTbl(elem as HTMLElement, JSON.parse(user.Extra))
                break
            case "Datapoints":
            case "meta.Datapoints":
                mkGenericTbl(elem as HTMLElement, JSON.parse(meta.Datapoints))
                break
            case "MediaDependant":
            case "meta.MediaDependant":
                mkGenericTbl(elem as HTMLElement, JSON.parse(meta.MediaDependant))
                break
            case "info":
                mkGenericTbl(elem as HTMLElement, item)
                break
            case "user":
                mkGenericTbl(elem as HTMLElement, user)
                break
            case "meta":
                mkGenericTbl(elem as HTMLElement, meta)
                break
            default:
                elem.append(`Invalid object: ${requestedObj}`)

        }
    }

    function renderVal(val: Type, output: HTMLElement) {
        if(val instanceof Elem) {
            output.append(val.el)
        } else if (val instanceof Arr) {
            for(let item of val.jsValue) {
                renderVal(item, output)
            }
        } else {
            output.innerHTML += val.jsStr()
        }
    }

    for (let elem of root.querySelectorAll("script[type=\"application/x-aiol\"]")) {
        let script = elem.textContent
        if (!script) continue

        let symbols = new CalcVarTable()
        symbols.set("root", new Elem(root as unknown as HTMLElement))
        symbols.set("results", new Arr(globalsNewUi.results.map(v => new Entry(v.info))))
        symbols.set("this", new Entry(item))
        let res = parseExpression(script, symbols)

        let outputId = elem.getAttribute("data-output")
        if (outputId) {
            let outputEl = root.querySelector(`[id="${outputId}"]`) as HTMLElement
            if (outputEl) {
                //clear html
                outputEl.innerHTML = ""
                renderVal(res, outputEl)
            }
        }
    }
}

/**
 * @description updates special-case legacy elements
 */
function updateDisplayEntryContents(item: InfoEntry, user: UserEntry, meta: MetadataEntry, events: UserEvent[], el: ShadowRoot) {
    updateBasicDisplayEntryContents(item, user, meta, el)

    const displayEntryTitle = el.getElementById("main-title")
    const displayEntryNativeTitle = el.getElementById("official-native-title")
    const imgEl = el.getElementById("thumbnail")
    const notesEl = el.getElementById('notes')
    const ratingEl = el.getElementById('user-rating')
    const audienceRatingEl = el.getElementById('audience-rating')
    const viewCountEl = el.getElementById('view-count')
    const progressEl = el.getElementById("entry-progressbar")
    const captionEl = el.getElementById("entry-progressbar-position-label")
    const mediaInfoTbl = el.getElementById("media-info")
    const eventsTbl = el.getElementById("user-actions")
    const customStyles = el.getElementById("custom-styles")

    const notesEditBox = el.getElementById("notes-edit-box")

    //object editor table
    updateObjectTbl(JSON.parse(getCurrentObjectInObjEditor(item.ItemId, el)), el)

    //status
    updateStatusDisplay(user.Status, el)

    //Cost
    updateCostDisplay(el, item.ItemId)

    let userExtra = getUserExtra(user, "styles")
    let styles = userExtra || ""
    if (customStyles) {
        customStyles.innerText = styles
    }

    //tags
    const tagsRoot = el.getElementById("tags")
    if (tagsRoot) {
        tagsRoot.innerHTML = ""
        for (let tag of item.Tags || []) {
            tag = tag.trim()
            if (!tag) continue
            const outer = document.createElement("div")

            const del = document.createElement("button")
            del.innerText = "🗑"
            del.classList.add("delete")

            del.onclick = function() {
                api_deleteEntryTags(item.ItemId, [tag])
                    .then(res => {
                        if (res?.status !== 200) return ""
                        res.text().then(() => {
                            item.Tags = item.Tags.filter((t: string) => t != tag)
                            changeDisplayItemData(item, user, meta, events, el.host as HTMLElement)
                        })
                    })
                    .catch(console.error)
            }

            outer.append(del)

            const btn = document.createElement("button")
            btn.classList.add("tag")
            btn.innerText = tag
            outer.append(btn)

            btn.onclick = function(e) {
                let btn = e.target as HTMLButtonElement
                let tag = btn.innerText
                mkSearchUI({
                    ["search-query"]: `#tag:${tag}`
                })
            }

            tagsRoot?.append(outer)
        }
    }

    //type icon
    let typeIcon = typeToSymbol(item.Type)
    displayEntryTitle?.setAttribute("data-type-icon", typeIcon)


    //format
    formatToName(item.Format).then(name => {
        displayEntryTitle?.setAttribute("data-format-name", name)
    })


    //Title
    if (displayEntryTitle)
        displayEntryTitle.innerText = meta.Title || item.En_Title
    //only set the title of the heading to the user's title if the metadata title exists
    //otherwise it looks dumb
    if (displayEntryTitle && meta.Title && item.En_Title) {
        displayEntryTitle.title = item.En_Title
    }

    //Native title
    if (displayEntryNativeTitle)
        displayEntryNativeTitle.innerText = meta.Native_Title || item.Native_Title
    //Same as with the regular title
    if (displayEntryNativeTitle && meta.Native_Title && item.Native_Title) {
        displayEntryNativeTitle.title = item.Native_Title
    }

    //Thumbnail
    if (imgEl && imgEl.tagName === "IMG") {
        //@ts-ignore
        imgEl.alt = meta.Title || item.En_Title
        //@ts-ignore
        imgEl.src = fixThumbnailURL(meta.Thumbnail)
    }

    //Notes
    if (notesEditBox && "value" in notesEditBox)
        notesEditBox.value = user.Notes
    if (notesEl)
        notesEl.innerHTML = parseNotes(user.Notes)

    //Rating
    if (ratingEl && user.UserRating) {
        applyUserRating(user.UserRating, ratingEl)
        ratingEl.innerHTML = String(user.UserRating)
    } else if (ratingEl) {
        ratingEl.innerText = "Unrated"
    }

    //Audience Rating
    let max = meta.RatingMax
    if (meta.Rating && audienceRatingEl) {
        let rating = meta.Rating
        let normalizedRating = rating
        if (max !== 0) {
            normalizedRating = rating / max * 100
        }
        applyUserRating(normalizedRating, audienceRatingEl)
        audienceRatingEl.innerHTML = String(rating)
    } else if (audienceRatingEl) {
        audienceRatingEl.innerText = "Unrated"
    }

    //Info table raw
    // if (infoRawTbl) mkGenericTbl(infoRawTbl, item)

    //Meta table raw
    let data = meta
    let mediaDependant
    try {
        mediaDependant = JSON.parse(data["MediaDependant"] || "{}")
    } catch (err) {
        console.error("Could not parse media dependant meta info json")
        return
    }

    //View count
    let viewCount = user.ViewCount
    if (viewCountEl && viewCount) {
        viewCountEl.setAttribute("data-time-spent", String(Number(viewCount) * Number(mediaDependant["Show-length"] || mediaDependant["Movie-length"] || 0) / 60 || "unknown"))
        viewCountEl.innerText = String(viewCount)
    }


    //Media dependant
    let type = String(item.Type)

    if (mediaInfoTbl) {
        //remove the <Media>- part from the key looks ugly
        let modifiedKeys: { [k: string]: string } = {}
        for (let key in mediaDependant) {
            const val = mediaDependant[key]
            key = key.split("-").slice(1).join(" ")
            modifiedKeys[key] = val
        }
        mkGenericTbl(mediaInfoTbl, modifiedKeys)
    }


    let userPos = parseInt(user.CurrentPosition)

    el.host.setAttribute("data-user-status", user.Status)
    if (progressEl && "max" in progressEl && "value" in progressEl && mediaDependant[`${type}-episodes`] && user.Status === "Viewing") {
        progressEl.max = mediaDependant[`${type}-episodes`]

        progressEl.value = userPos

    }
    if (captionEl) {
        captionEl.innerText = `${user.CurrentPosition}/${mediaDependant[`${type}-episodes`]}`
        captionEl.title = `${Math.round(userPos / parseInt(mediaDependant[`${type}-episodes`]) * 1000) / 10}%`
    }

    //relation elements
    for (let relationship of [["descendants", findDescendants], ["copies", findCopies]] as const) {
        let relationshipEl = el.getElementById(relationship[0])
        if (!relationshipEl) continue

        relationshipEl.innerHTML = ""
        createRelationButtons(relationshipEl, relationship[1](item.ItemId), relationship[0])
    }

    //Events
    if (eventsTbl && events.length) {
        let html = `
            <thead>
                <tr>
                    <!-- this nonsense is so that the title lines up with the events -->
                    <th>
                        <div class="grid column">
                            <button popovertarget="new-event-form">➕︎</button><span style="text-align: center">Event</span>
                        </div>
                    </th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
        `
        for (let event of events) {
            const ts = event.Timestamp
            const afterts = event.After
            const timeZone = event.TimeZone || "UTC"
            const name = event.Event

            let date = new Date(event.Timestamp)
            let afterDate = new Date(event.After)
            let timeTd = ""
            if (ts !== 0) {
                let time = date.toLocaleTimeString("en", { timeZone })
                let dd = date.toLocaleDateString("en", { timeZone })
                timeTd = `<td title="${time} (${timeZone})">${dd}</td>`
            } else if (afterts !== 0) {
                let time = afterDate.toLocaleTimeString("en", { timeZone })
                let dd = afterDate.toLocaleDateString("en", { timeZone })
                timeTd = `<td title="${time} (${timeZone})">after: ${dd}</td>`
            } else {
                timeTd = `<td title="unknown">unknown</td>`
            }
            html += `<tr>
                        <td>
                            <div class="grid column">
                                <button class="delete" onclick="deleteEvent(this, ${ts}, ${afterts})">🗑</button>
                                ${name}
                            </div>
                        </td>
                            ${timeTd}
                        </tr>`
        }
        html += "</tbody>"
        eventsTbl.innerHTML = html
    } else if (eventsTbl) {
        //there are no events
        eventsTbl.innerHTML = ""
    }
}

function renderDisplayItem(itemId: bigint, parent: HTMLElement | DocumentFragment = displayItems) {
    let el = document.createElement("display-entry")
    let root = el.shadowRoot as ShadowRoot
    if (!root) return el

    let user = findUserEntryById(itemId) as UserEntry

    let template;
    if (user && (template = getUserExtra(user, "template")?.trim())) {
        (root.getElementById("root") as HTMLDivElement).innerHTML = template
    }

    let meta = findMetadataById(itemId)
    let events = findUserEventsById(itemId)
    const item = findInfoEntryById(itemId)

    if (!item || !user || !meta || !events) return el

    parent.append(el)


    const currentEditedObj = root.getElementById("current-edited-object")
    if (currentEditedObj && "value" in currentEditedObj) {
        currentEditedObj.onchange = function() {
            switch (currentEditedObj.value) {
                case "user-extra":
                    updateObjectTbl(JSON.parse(user.Extra), root)
                    break
                case "meta-datapoints":
                    updateObjectTbl(JSON.parse(meta.Datapoints), root)
                    break
                case "meta-media-dependant":
                    updateObjectTbl(JSON.parse(meta.MediaDependant), root)
                    break
            }
        }
    }

    const includeSelf = root.getElementById("include-self-in-cost")
    const includeChildren = root.getElementById("include-children-in-cost")
    const includeCopies = root.getElementById("include-copies-in-cost")
    const statusSelector = root.getElementById("status-selector")

    for (let input of [includeSelf, includeCopies, includeChildren]) {
        if (!input) continue
        input.onchange = function() {
            updateCostDisplay(root, item.ItemId)
        }
    }

    statusSelector && (statusSelector.onchange = function(e) {
        const selector = e.target as HTMLSelectElement
        const info = findInfoEntryById(item.ItemId) as InfoEntry
        const user = findUserEntryById(item.ItemId) as UserEntry

        user.Status = selector.value as UserStatus
        const infoStringified = api_serializeEntry(user)
        authorizedRequest(`${apiPath}/engagement/set-entry`, {
            body: infoStringified,
            method: "POST"
        })
            .then(res => {
                if (!res) {
                    alert("Could not update status")
                    return
                }
                if (res.status !== 200) {
                    alert("Failed to update status")
                    return
                }
                res.text().then(() => alert(`Updated status to ${user.Status}`))
                updateInfo2({
                    [String(info.ItemId)]: { user },
                })
            })
            .catch(console.error)
    });


    let extra = getUserExtra(user, "styles")

    let styleEditor = root.getElementById("style-editor")
    if (styleEditor && styleEditor.tagName === "TEXTAREA") {
        (styleEditor as HTMLTextAreaElement).value = extra || ""
        styleEditor.addEventListener("change", e => {
            const customStyles = root.getElementById("custom-styles") as HTMLStyleElement
            customStyles.innerText = (styleEditor as HTMLTextAreaElement).value
        })
    }
    let templEditor = root.getElementById("template-editor")
    if (templEditor && templEditor.tagName === "TEXTAREA") {
        (templEditor as HTMLTextAreaElement).value = getUserExtra(user, "template") || ""
    }

    let newChildButton = root.getElementById("new-child")
    if (newChildButton) {
        newChildButton.addEventListener("click", e => {
            const newEntryDialog = document.getElementById("new-entry") as HTMLDialogElement
            const parentIdInput = newEntryDialog.querySelector(`[name="parentId"]`) as HTMLInputElement
            parentIdInput.value = String(item.ItemId)
            newEntryDialog.showPopover()
        })
    }

    const newChildByIdInput = root.getElementById("new-child-by-id")

    if (newChildByIdInput && "value" in newChildByIdInput) {
        newChildByIdInput.onchange = function() {
            let childId = BigInt(String(newChildByIdInput.value))
            let info = findInfoEntryById(childId)
            info.ParentId = item.ItemId
            api_setParent(childId, item.ItemId).then(() => {
                updateInfo2({
                    [String(item.ItemId)]: { info: item },
                    [String(newChildByIdInput.value)]: { info }
                })
            })
        }
    }

    hookActionButtons(root, itemId)

    const notesEditBox = root.getElementById("notes-edit-box")

    let editTO: number | undefined;
    if (notesEditBox && "value" in notesEditBox) {
        notesEditBox.onchange = function() {
            user.Notes = String(notesEditBox.value)

            const userStringified = api_serializeEntry(user)

            updateInfo2({
                [String(item.ItemId)]: { user }
            })

            if (editTO) {
                clearTimeout(editTO)
            }
            editTO = setTimeout(() => {
                authorizedRequest(`${apiPath}/engagement/set-entry`, {
                    body: userStringified,
                    method: "POST",
                    "signin-reason": "save notes"
                })
                    .then(res => {
                        if (res?.status === 200) {
                            alert("Notes saved")
                        } else {
                            alert("Failed to save notes")
                        }
                    })
                    .catch(() => alert("Failed to save notes"))
            }, 1000)
        }
    }

    const cost = root.getElementById("cost")
    if(cost) {
        cost.onclick = function() {
            const newPrice = promptNumber("New cost", "not a number", parseFloat)
            if(newPrice === null) return
            let item = findInfoEntryById(itemId)
            item.PurchasePrice = newPrice as number
            api_setItem("", item).then(res => {
                if(res === null || res.status !== 200) {
                    alert("Failed to set price")
                    return
                }
                updateInfo2({ 
                    [String(itemId)]: {
                        info: item
                    }
                })
            })
        }
    }

    const newTag = root.getElementById("create-tag")
    if (newTag) {
        newTag.onclick = function() {
            const name = prompt("Tag name (, seperated)")
            if (!name) return
            let names = name.split(",")
            item.Tags = item.Tags?.concat(names) || names
            api_addEntryTags(item.ItemId, name.split(","))
                .then(res => {
                    if (res?.status !== 200) return ""
                    res.text().then(() => changeDisplayItemData(item, user, meta, events, el))
                })
                .catch(console.error)
        }
    }

    el.addEventListener("data-changed", function(_e) {
        let e = _e as CustomEvent
        const event = e
        const item = /**@type {InfoEntry}*/(event.detail.item)
        const user = /**@type {UserEntry}*/(event.detail.user)
        const meta = /**@type {MetadataEntry}*/(event.detail.meta)
        const events = /**@type {UserEvent[]}*/(event.detail.events)
        updateDisplayEntryContents(item, user, meta, events, el.shadowRoot as ShadowRoot)
    })

    changeDisplayItemData(item, user, meta, events, el)
    return el
}

function removeDisplayItem(itemId: bigint) {
    displayEntryIntersected.delete(String(itemId))
    const el = /**@type {HTMLElement}*/(displayItems.querySelector(`[data-item-id="${itemId}"]`))
    if (!el) return
    el.remove()
    observer.unobserve(el)
}

function refreshDisplayItem(itemId: bigint) {
    let el = document.querySelector(`display-entry[data-item-id="${itemId}"]`) as HTMLElement
    let info = findInfoEntryById(itemId)
    if (!info) return

    if (el) {
        let user = findUserEntryById(itemId)
        let events = findUserEventsById(itemId)
        let meta = findMetadataById(itemId)
        if (!info || !user || !events || !meta) return
        changeDisplayItemData(info, user, meta, events, el)
    } else {
        renderDisplayItem(itemId)
    }
}

function getIdFromDisplayElement(element: HTMLElement) {
    let rootNode = element.getRootNode() as ShadowRoot
    let host = rootNode.host
    if (!host) {
        return 0n
    }
    return BigInt(String(host.getAttribute("data-item-id")))
}

function displayEntryAction(func: (item: InfoEntry, root: ShadowRoot) => any) {
    return function(elem: HTMLElement) {
        let id = getIdFromDisplayElement(elem)
        let item;
        (item = findInfoEntryById(id)) && func(item, elem.getRootNode() as ShadowRoot)
    }
}

function _fetchLocationBackup(itemId: bigint) {
    const listing = document.getElementById("items-listing")

    const item = findInfoEntryById(itemId) as InfoEntry

    let provider = item.Type === "Show" ? "sonarr" : "radarr"
    alert(`Using ${provider} to find location`)

    const popover = document.getElementById("items-listing") as HTMLDivElement

    async function onfetchLocation(res: Response | null) {
        if (!res) {
            alert("Failed to set location")
            return
        }
        if (res.status !== 200) {
            console.error(await res.text())
            alert("Failed to set location")
            return
        }

        const newLocation = await res.text()
        alert(`Location set to: ${newLocation}`)
        item.Location = newLocation
        updateInfo2({
            [String(item.ItemId)]: { info: item }
        })
        popover.hidePopover()
    }

    api_identify(item.En_Title || item.Native_Title, provider).then(async (res) => {
        if (!res) return

        if (res.status !== 200) {
            alert("Failed to find entries")
            return
        }

        const [_, metaText] = (await res.text()).split("\x02")
        const metaInfo = [...api_deserializeJsonl(metaText.trim().split("\n"))]

        //TODO: if the length is 0, ask the user for a search query

        if (metaInfo.length === 1) {
            api_fetchLocation(item.ItemId, getUidUI(), provider, metaInfo[0].ItemId).then(onfetchLocation)
            return
        }

        const metaRecord = Object.fromEntries(metaInfo.map(v => [v.ItemId, v]))

        console.table(metaRecord)
        const container = fillItemListing(metaRecord)

        const figs = container.querySelectorAll("figure")
        for (const fig of figs) {
            fig.onclick = function() {
                const id = fig.getAttribute("data-item-id") as string
                api_fetchLocation(item.ItemId, getUidUI(), provider, id)
                    .then(onfetchLocation)
            }
        }

        popover.showPopover()
    })
}

function _fetchLocation(itemId: bigint) {
    api_fetchLocation(itemId, getUidUI())
        .then(async (res) => {
            if (res == null) {
                alert("Failed to get location")
                return
            }

            let newLocation = await res.text()

            if (res.status !== 200) {
                alert("Failed to get location, loading possible options")
                if (newLocation.includes("could not")) {
                    _fetchLocationBackup(itemId)
                }
                return
            }

            const info = findInfoEntryById(itemId) as InfoEntry
            info.Location = newLocation

            updateInfo2({
                [String(itemId)]: { info }
            })
            alert(`Location set to: ${newLocation}`)
        })
}

function copyThis(item: InfoEntry) {
    const user = findUserEntryById(item.ItemId) as UserEntry
    const meta = findMetadataById(item.ItemId) as MetadataEntry
    const events = findUserEventsById(item.ItemId) as UserEvent[]

    api_createEntry({
        title: item.En_Title,
        "native-title": item.Native_Title,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        format: item.Format,
        price: item.PurchasePrice,
        "art-style": item.ArtStyle,
        libraryId: item.Library || undefined,
        copyOf: item.ItemId,
        parentId: item.ParentId || undefined,
        tags: item.Collection,
        location: item.Location,
        "user-notes": user.Notes,
        "user-status": user.Status,
        "user-view-count": user.ViewCount,
        "user-rating": user.UserRating,
        "get-metadata": false,
        type: item.Type,
    }).then(async (res) => {
        if (!res || res.status !== 200) {
            alert("failed to create copy")
            return
        }

        const text = await res.text()
        const itemCopy = api_deserializeJsonl(text.trim()).next().value as InfoEntry
        const userCopy = { ...user }
        userCopy.ItemId = itemCopy.ItemId
        const metaCopy = { ...meta }
        metaCopy.ItemId = itemCopy.ItemId

        const promises = []
        promises.push(api_setItem("", itemCopy))
        promises.push(api_setItem("engagement/", userCopy))
        promises.push(api_setItem("metadata/", metaCopy))
        for (let event of events) {
            promises.push(api_registerEvent(metaCopy.ItemId, event.Event, event.Timestamp, event.After, event.TimeZone))
        }
        Promise.all(promises)
            .then(responses => {
                for (let res of responses) {
                    if (res?.status !== 200) {
                        alert("Failed to make a complete copy")
                        return
                    }
                }
                alert(`Coppied: ${item.En_Title}`)
                globalsNewUi.entries[String(itemCopy.ItemId)].info = itemCopy
                globalsNewUi.entries[String(itemCopy.ItemId)].user = userCopy
                globalsNewUi.entries[String(itemCopy.ItemId)].meta = metaCopy
                for (let event of events) {
                    let eventCopy = { ...event }
                    eventCopy.ItemId = itemCopy.ItemId
                    globalsNewUi.entries[String(itemCopy.ItemId)].events.push(eventCopy)
                }
                mode.add(itemCopy, true)
                renderSidebarItem(itemCopy, sidebarItems, { below: String(item.ItemId) })
            })
            .catch(console.error)
    })
}

const displayEntryDelete = displayEntryAction(item => deleteEntryUI(item))
const displayEntryRefresh = displayEntryAction((item, root) => overwriteEntryMetadataUI(root, item))
const displayEntryFetchLocation = displayEntryAction((item) => _fetchLocation(item.ItemId))
const displayEntrySave = displayEntryAction((item, root) => saveItemChanges(root, item.ItemId))
const displayEntryClose = displayEntryAction(item => deselectItem(item))
const displayEntryCopyThis = displayEntryAction(item => copyThis(item))

const displayEntrySaveObject = displayEntryAction((item, root) => {
    const tbl = root.getElementById("display-info-object-tbl")

    const editedObject = (root.getElementById("current-edited-object") as HTMLSelectElement).value

    let into: Record<string, any>
    let keyName
    if (editedObject === "user-extra") {
        into = findUserEntryById(item.ItemId) as UserEntry
        keyName = "Extra"
    } else if (editedObject === "meta-datapoints") {
        into = findMetadataById(item.ItemId) as MetadataEntry
        keyName = "Datapoints"
    } else if (editedObject === "meta-media-dependant") {
        into = findMetadataById(item.ItemId) as MetadataEntry
        keyName = "MediaDependant"
    } else {
        alert(`${editedObject} saving is not implemented yet`)
        return
    }

    let newObj: Record<string, any> = {}
    for (let row of tbl?.querySelectorAll("tr:has(td)") || []) {
        let key = row.firstElementChild?.textContent || ""
        let valueEl = row.firstElementChild?.nextElementSibling
        if (!valueEl) continue
        let value = valueEl?.textContent || ""
        if (key == "") continue

        let valueType = valueEl.getAttribute("data-type")
        if (valueType !== "string") {
            newObj[key] = JSON.parse(value)
        } else {
            newObj[key] = value
        }
    }

    into[keyName] = JSON.stringify(newObj)

    const strId = String(item.ItemId)
    if (editedObject === "user-extra") {
        api_setItem("engagement/", into as UserEntry)
            .then(res => res?.text())
            .then(console.log)
            .catch(console.error)
        updateInfo2({
            [strId]: { user: into as UserEntry }
        })
    } else {
        api_setItem("metadata/", into as MetadataEntry)
            .then(res => res?.text())
            .then(console.log)
            .catch(console.error)
        updateInfo2({
            [strId]: { meta: into as MetadataEntry }
        })
    }
})

const displayEntryNewObjectField = displayEntryAction((item, root) => {
    const name = prompt("Field name")
    if (!name) return

    const strObj = getCurrentObjectInObjEditor(item.ItemId, root) as string
    const obj = JSON.parse(strObj)
    if (name in obj) return

    obj[name] = ""

    updateObjectTbl(obj, root, false)
})

const displayEntryAddExistingItemAsChild = displayEntryAction(item => {
    selectExistingItem().then(id => {
        if (!id) {
            alert("Could not set child")
            return
        }
        api_setParent(id, item.ItemId).then(() => {
            let info = findInfoEntryById(id)
            if (!info) {
                alert("could not find child id")
                return
            }
            info.ParentId = item.ItemId
            updateInfo2({
                [String(item.ItemId)]: { info: item },
                [String(id)]: { info }
            })
        })
    })
})

const displayEntryEditStyles = displayEntryAction((item, root) => {
    const styleEditor = root.getElementById("style-editor")
    if (!styleEditor) return
    styleEditor.hidden = !styleEditor.hidden
})

const displayEntryEditTemplate = displayEntryAction((item, root) => {
    const templEditor = root.getElementById("template-editor")
    if (!templEditor) return
    templEditor.hidden = !templEditor.hidden
})

const displayEntryCopyTo = displayEntryAction(item => {
    let id = promptNumber("Copy user info to (item id)", "Not a number, mmust be item id number", BigInt)
    if (id === null) return
    let idInt = BigInt(id)

    api_copyUserInfo(item.ItemId, idInt)
        .then(res => res?.text())
        .then(console.log)
})

const displayEntryViewCount = displayEntryAction(item => {
    let count = promptNumber("New view count", 'Not a number, view count')
    if (count === null) return

    authorizedRequest(`${apiPath}/engagement/mod-entry?id=${item.ItemId}&view-count=${count}`)
        .then(res => res?.text())
        .then(alert)
        .then(() => {
            let user = findUserEntryById(item.ItemId)
            if (!user) {
                refreshInfo().then(() => {
                    refreshDisplayItem(item.ItemId)
                })
            } else {
                user.ViewCount = Number(count)
                updateInfo2({
                    [String(item.ItemId)]: { user }
                })
            }
        })
        .catch(console.error)
})

const displayEntryProgress = displayEntryAction(async (item, root) => {
    let newEp = prompt("Current position:")
    if (!newEp) return

    await api_setPos(item.ItemId, String(newEp))
    const user = findUserEntryById(item.ItemId) as UserEntry
    user.CurrentPosition = String(newEp)
    updateInfo2({
        [String(item.ItemId)]: { user }
    })
})

const displayEntryRating = displayEntryAction(item => {
    let user = findUserEntryById(item.ItemId)
    if (!user) {
        alert("Failed to get current rating")
        return
    }
    let newRating = prompt("New rating")
    if (!newRating || isNaN(Number(newRating))) {
        return
    }

    api_setRating(item.ItemId, newRating)
        .then(() => {
            let user = findUserEntryById(item.ItemId)
            if (!user) {
                return refreshInfo()
            }
            user.UserRating = Number(newRating)
            updateInfo2({
                [String(item.ItemId)]: { user }
            })
        })
        .catch(console.error)
    api_registerEvent(item.ItemId, `rating-change - ${user?.UserRating} -> ${newRating}`, Date.now(), 0).catch(console.error)
})

function deleteEvent(el: HTMLElement, ts: number, after: number) {
    if (!confirm("Are you sure you would like to delete this event")) {
        return
    }
    const itemId = getIdFromDisplayElement(el)
    api_deleteEvent(itemId, ts, after)
        .then(res => res?.text())
        .then(() =>
            loadUserEvents(getUidUI())
                .then(() => updateInfo2({
                    [String(itemId)]: globalsNewUi.entries[String(itemId)]
                }))
        )
        .catch(alert)

}
