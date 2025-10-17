class DisplayMode extends Mode {
    NAME = "entry-output"

    displayQueue: InfoEntry[]
    constructor(parent?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        super(parent || "#entry-output", win)
        this.win.document.getElementById("entry-output")?.classList.add("open")
        this.displayQueue = []

        if (this.parent instanceof HTMLElement) {
            this.parent.addEventListener("scroll", (e) => {
                //@ts-ignore
                if (this.parent.scrollHeight - this.parent.scrollTop > innerHeight + 1000) return

                if (this.displayQueue.length) {
                    const item = this.displayQueue.shift()
                    if (item?.ItemId) {
                        renderDisplayItem.call(this, item.ItemId)
                    }
                }
            })
        }
    }

    displayEntryAction(func: (this: DisplayMode, item: InfoEntry, root: ShadowRoot, target: HTMLElement) => any) {
        return function(this: DisplayMode, elem: HTMLElement) {
            let id = getIdFromDisplayElement(elem)
            let item;
            (item = findInfoEntryById(id)) && func.call(this, item, elem.getRootNode() as ShadowRoot, elem)
        }.bind(this)
    }

    close() {
        this.win.document.getElementById("entry-output")?.classList.remove("open")
        this.displayQueue = []
        this.clear()
        this.clearSelected()
    }

    de_actions = { //{{{
        delete: this.displayEntryAction(item => deleteEntryUI(item)),
        refresh: this.displayEntryAction((item, root) => overwriteEntryMetadataUI(root, item)),
        fetchlocation: this.displayEntryAction((item) => _fetchLocation.call(this, item.ItemId)),
        save: this.displayEntryAction((item, root) => saveItemChanges(root, item.ItemId)),
        close: this.displayEntryAction(item => deselectItem(item)),
        copythis: this.displayEntryAction(item => copyThis.call(this, item)),
        setthumbnail: this.displayEntryAction((item, _, target) => {
            const fileUpload = target.getRootNode().getElementById("thumbnail-file-upload")
            if (!fileUpload || !("value" in fileUpload)) return

            fileUpload.click()
        }),
        setdigitization: this.displayEntryAction((item, _, target) => {
            if (!target || !(target instanceof HTMLInputElement)) return
            if (target.checked) {
                item.Format |= DIGI_MOD
            } else if (items_isDigitized(item.Format)) {
                item.Format -= DIGI_MOD
            }
            api_setItem("", item).then(() => {
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
        }),
        toggle: this.displayEntryAction((item, root, elem) => {
            let id = elem.getAttribute("elem-id")
            if (!id) return
            let toShow = root.getElementById(id)
            if (!toShow) return
            if (toShow instanceof this.win.HTMLDialogElement) {
                if (toShow.open) {
                    toShow.close()
                } else {
                    toShow.showModal()
                }
            } else {
                toShow.hidden = !toShow.hidden
            }
        }),
        setformat: this.displayEntryAction((item, _, target) => {
            if (!("value" in target)) return
            api_listFormats().then(formats => {
                if (!Object.keys(formats).includes(String(target.value))) return
                item.Format = Number(target.value)
                api_setItem("", item)
                    .catch(console.error)
                    .then(alert.bind(window, `Switched format to: ${formats[Number(target.value)]}`))
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
        }),
        settype: this.displayEntryAction((item, _, target) => {
            if (!("value" in target)) return
            api_listTypes().then(types => {
                if (!types.includes(target.value as EntryType)) return
                item.Type = target.value as EntryType
                api_setItem("", item)
                    .catch(console.error)
                    .then(alert.bind(window, `Switched type to: ${target.value}`))
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
        }),
        //TODO: this function is a disaster, each edited object should probably get its own save function
        saveobject: this.displayEntryAction((item, root) => {
            const tbl = root.getElementById("display-info-object-tbl")

            const editedObject = (root.getElementById("current-edited-object") as HTMLSelectElement).value

            let into: Record<string, any> = {}
            let keyName
            let endpoint: Parameters<typeof api_setItem>["0"] = ""
            switch (editedObject) {
                case "meta":
                    endpoint = "metadata/"
                    break
                case "entry":
                    endpoint = ""
                    break
                case "user":
                    endpoint = "engagement/"
                    break
                case "user-extra":
                    into = findUserEntryById(item.ItemId) as UserEntry
                    keyName = "Extra"
                    endpoint = "engagement/"
                    break
                case "meta-datapoints":
                    into = findMetadataById(item.ItemId) as MetadataEntry
                    keyName = "Datapoints"
                    endpoint = "metadata/"
                    break
                case "meta-media-dependant":
                    into = findMetadataById(item.ItemId) as MetadataEntry
                    keyName = "MediaDependant"
                    endpoint = "metadata/"
                    break
                case "aio-web":
                    keyName = "_AIOWEB"
                    endpoint = "engagement/"
                    break
                default:
                    alert(`${editedObject} saving is not implemented yet`)
                    return
            }

            let newObj: Record<string, any> = {}
            for (let row of tbl?.querySelectorAll("tr:has(td)") || []) {
                let key = row.firstElementChild?.textContent || ""
                //invalid key
                if (editedObject === "entry" && key === "Tags") continue

                let valueEl = row.firstElementChild?.nextElementSibling
                if (!valueEl) continue
                let value = valueEl?.textContent || ""
                if (key == "") continue

                let valueType = valueEl.getAttribute("data-type")
                if (valueType === 'bigint') {
                    newObj[key] = BigInt(value)
                } else if (valueType === 'number') {
                    newObj[key] = Number(value)
                } else {
                    newObj[key] = value
                }
            }

            if (keyName && keyName !== "_AIOWEB")
                into[keyName] = JSON.stringify(newObj)
            else if (keyName === "_AIOWEB") {
                let user = findUserEntryById(item.ItemId)
                let extra = JSON.parse(user.Extra || "{}")
                extra["AIOWeb"] = newObj
                user.Extra = JSON.stringify(extra)
                into = user
                updateInfo2({
                    [String(item.ItemId)]: { user }
                })
            }
            else into = newObj

            if (editedObject === "entry") {
                into["Tags"] = findInfoEntryById(into["ItemId"]).Tags
            }

            const strId = String(item.ItemId)
            api_setItem(endpoint, into as UserEntry)
                .then(res => res?.text())
                .then(console.log)
                .catch(console.error)
            if (editedObject === "user-extra" || editedObject === "user") {
                updateInfo2({
                    [strId]: { user: into as UserEntry }
                })
            } else if (editedObject === "entry") {
                updateInfo2({
                    [strId]: { info: into as InfoEntry }
                })
            } else if (probablyMetaEntry(into)) {
                updateInfo2({
                    [strId]: { meta: into as MetadataEntry }
                })
            }
        }),
        newobjectfield: this.displayEntryAction(async (item, root) => {
            const name = await promptUI("Field name")
            if (!name) return

            const obj: any = getCurrentObjectInObjEditor(item.ItemId, root)
            if (name in obj) return

            obj[name] = ""

            const objectTbl = root.getElementById("display-info-object-tbl") as HTMLTableElement
            updateObjectTbl(obj, objectTbl, false)
        }),
        selectnewchild: this.displayEntryAction(item => {
            selectItemUI().then(id => {
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
        }),
        editstyles: this.displayEntryAction((item, root, elem) => {
            const styleEditor = root.getElementById("style-editor")
            if (!styleEditor) return
            if ("value" in styleEditor) {
                styleEditor.value = getUserExtra(findUserEntryById(item.ItemId), "styles")
            }
            styleEditor.hidden = !styleEditor.hidden
            styleEditor.onchange = util_debounce(() => {
                this.de_actions["save"](elem)
                alert("saved styles")
            }, 3000)
        }),
        edittemplate: this.displayEntryAction((item, root, elem) => {
            const templEditor = root.getElementById("template-editor")
            if (!templEditor) return

            templEditor.hidden = !templEditor.hidden
        }),
        previewtemplate: this.displayEntryAction(function(item, root) {
            const templEditor = root.getElementById("template-editor")
            if (!templEditor || !(templEditor instanceof this.win.HTMLTextAreaElement)) return

            const urlParams = new URLSearchParams(location.search)
            urlParams.set("item-id", String(item.ItemId))
            const preview = this.parent.ownerDocument.open(location.pathname + "?" + urlParams.toString(), "_blank", "popup=true")
            if (!preview) return

            preview.onload = () => {
                preview.document.title = `${item.En_Title} PREVIEW`
                //this tells the new window that this is the template to use for this item no matter what
                preview.self.GLOBAL_TEMPLATE = {[`${item.ItemId}`]: templEditor.value}
            }

            templEditor.onkeyup = () => {
                preview.self.GLOBAL_TEMPLATE = {[`${item.ItemId}`]: templEditor.value}
                preview.self.deselectItem(item, false)
                preview.self.selectItem(item, false)
            }
        }),
        copyto: this.displayEntryAction(async (item) => {
            let id = await promptNumber("Copy user info to (item id)", "Not a number, mmust be item id number", BigInt)
            if (id === null) return
            let idInt = BigInt(id)

            api_copyUserInfo(item.ItemId, idInt)
                .then(res => res?.text())
                .then(console.log)
        }),
        setviewcount: this.displayEntryAction(async (item) => {
            let count = await promptNumber("New view count", 'Not a number, view count')
            if (count === null) return

            authorizedRequest(`${apiPath}/engagement/mod-entry?id=${item.ItemId}&view-count=${count}`)
                .then(res => res?.text())
                .then(alert)
                .then(() => {
                    let user = findUserEntryById(item.ItemId)
                    if (!user) {
                        refreshInfo(getUidUI()).then(() => {
                            refreshDisplayItem.call(this, item.ItemId)
                        })
                    } else {
                        user.ViewCount = Number(count)
                        updateInfo2({
                            [String(item.ItemId)]: { user }
                        })
                    }
                })
                .catch(console.error)
        }),
        setprogress: this.displayEntryAction(async (item, root) => {
            let newEp = await promptUI("Current position")
            if (!newEp) return

            await api_setPos(item.ItemId, String(newEp))
            const user = findUserEntryById(item.ItemId) as UserEntry
            user.CurrentPosition = String(newEp)
            updateInfo2({
                [String(item.ItemId)]: { user }
            })
        }),
        setrating: this.displayEntryAction(async (item) => {
            let user = findUserEntryById(item.ItemId)
            if (!user) {
                alert("Failed to get current rating")
                return
            }
            let newRating = await promptUI("New rating")
            if (!newRating || isNaN(Number(newRating))) {
                return
            }

            api_setRating(item.ItemId, newRating)
                .then(async () => {
                    let user = findUserEntryById(item.ItemId)
                    await loadUserEvents(item.Uid)
                    user.UserRating = Number(newRating)
                    updateInfo2({
                        [String(item.ItemId)]: { user, events: findUserEventsById(item.ItemId) }
                    })
                })
                .catch(console.error)
            api_registerEvent(item.ItemId, `rating-change - ${user?.UserRating} -> ${newRating}`, Date.now(), 0)
                .then(() => {
                    _reloadEvents(item.ItemId)
                })
                .catch(console.error)
        }),
    } as const //}}}

    add(entry: InfoEntry) {
        return renderDisplayItem.call(this, entry.ItemId)
    }

    sub(entry: InfoEntry) {
        removeDisplayItem.call(this, entry.ItemId)
    }

    chwin(win: Window & typeof globalThis) {
        if (win === window) {
            this.win.close()
        }
        let newOutput = win.document.getElementById("entry-output")
        this.win = win
        if (newOutput) {
            this.parent = newOutput
            if (newOutput instanceof HTMLElement) {
                newOutput.addEventListener("scroll", (e) => {
                    if (newOutput.scrollHeight - newOutput.scrollTop > innerHeight + 1000) return

                    if (this.displayQueue.length) {
                        const item = this.displayQueue.shift()
                        if (item?.ItemId) {
                            renderDisplayItem.call(this, item.ItemId)
                        }
                    }
                })
            }
        }
    }

    refresh(id: bigint) {
        let el = this.parent.ownerDocument.querySelector(`display-entry[data-item-id="${id}"]`) as HTMLElement
        //only refresh if the item is on screen
        if (el)
            refreshDisplayItem.call(this, id)
    }

    addList(entry: InfoEntry[]) {
        (async () => {
            for (let i = 0; i < entry.length; i++) {
                if ("scheduler" in window && i % 20 === 0 && i !== 0) {
                    //@ts-ignore
                    await window.scheduler.yield()
                } else if (i > 5 && !("scheduler" in window)) {
                    this.displayQueue.push(entry[i])
                } else {
                    renderDisplayItem.call(this, entry[i].ItemId)
                }
            }
        })()
    }

    subList(entry: InfoEntry[]) {
        const itemIdsToRemove = entry.map(v => v.ItemId)
        this.displayQueue = this.displayQueue.filter(i => !itemIdsToRemove.includes(i.ItemId))

        for (let item of entry) {
            removeDisplayItem.call(this, item.ItemId)
        }
    }

    putSelectedInCollection() {
        const selected = items_getSelected()
        promptUI("Id of collection").then(collectionName => {
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
        })
    }

    addTagsToSelected() {
        promptUI("tags (, seperated)").then(tags => {
            if (!tags) return
            const tagsList = tags.split(",")
            //FIXME: tags do not update immediately
            for (let item of items_getSelected()) {
                item.Tags = item.Tags.concat(tagsList)
                api_addEntryTags(item.ItemId, tagsList)
            }
        })
    }

    put(html: string | HTMLElement | ShadowRoot) {
        // if (typeof html === 'string') {
        //     return
        // }
        this.parent.append(html)
    }

    clearSelected() {
        this.displayQueue.length = 0
        // displayEntryIntersected.clear()
        for (let child of this.parent.querySelectorAll("display-entry")) {
            const itemId = child.getAttribute("data-item-id")
            if (!itemId) continue
            removeDisplayItem.call(this, BigInt(itemId))
        }
    }

    clear() {
        for (let child of this.parent.childNodes) {
            if(child.nodeName === 'DISPLAY-ENTRY') continue
            child.remove()
        }
    }
}

async function itemIdentification(form: HTMLFormElement) {
    closeModalUI("item-identification-form", form.getRootNode() as ShadowRoot)
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

            const newMeta = [...api_deserializeJsonl<MetadataEntry>(json)][0]

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

    let obj = Object.fromEntries(items.map(v => [String(v.ItemId), v]))
    const container = fillItemListingUI(obj)
    let item = await selectItemUI({
        container,
        async onsearch(query) {
            let res = await api_identify(query, provider)
            if (!res) return document.createElement("div")
            let text = await res.text()
            let [_, rest] = text.split("\x02")
            let items = rest.split("\n").filter(Boolean).map(v => JSON.parse(v))
            let obj = Object.fromEntries(items.map(v => [String(v.ItemId), v]))
            return fillItemListingUI(obj)
        },
    })
    return item ? String(item) : null
}


function saveItemChanges(root: ShadowRoot, itemId: bigint) {
    let userEntry = findUserEntryById(itemId)
    if (!userEntry) return

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
        .then(() => alert("saved user info"))
        .catch(console.error)

    updateInfo2({
        [String(itemId)]: {
            user: userEntry
        }
    })
}

function changeDisplayItemData(this: DisplayMode, item: InfoEntry, user: UserEntry, meta: MetadataEntry, events: UserEvent[], el: HTMLElement) {
    updateDisplayEntryContents.call(this, item, user, meta, events, el.shadowRoot as ShadowRoot)
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
        html += `<tr><td>${key}</td><td>${data[key]}</td></tr>`
    }
    html += "</tbody>"
    root.innerHTML = html
}

function de_newevent(form: HTMLFormElement) {
    const data = new FormData(form)
    const name = data.get("name")
    if (name == null) {
        alert("Name required")
        return
    }
    const tsStr = data.get("timestamp")
    const aftertsStr = data.get("after")
    const beforetsStr = data.get("before")
    const timezoneData = data.get("timezone")
    const timezone = (timezoneData
        ? timezoneData.toString()
        : Intl.DateTimeFormat().resolvedOptions().timeStyle
    ) || ""
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
    //@ts-ignore
    let beforets = new Date(beforetsStr).getTime()
    if (isNaN(beforets)) {
        beforets = 0
    }
    const itemId = getIdFromDisplayElement(form)
    api_registerEvent(itemId, name.toString(), ts, afterts, timezone, beforets)
        .then(res => res?.text())
        .then(() => {
            _reloadEvents(itemId)
            form.parentElement?.hidePopover()
        })
        .catch(alert)
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

        btn.addEventListener("click", async (_) => {
            const item = findInfoEntryById(itemId) as InfoEntry

            if (!confirm(`Are you sure you want to ${action} this entry`)) {
                return
            }

            let queryParams = `?id=${item.ItemId}`
            if (action === "Finish") {
                let rating = await promptNumber("Rating", "Not a number\nRating")
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
                    Promise.all([loadUserEvents(item.Uid), items_refreshUserEntries(item.Uid)]).then(() =>
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


    const fileUpload = shadowRoot.getElementById("thumbnail-file-upload")

    if (fileUpload instanceof HTMLInputElement && "files" in fileUpload) {
        fileUpload.onchange = async function(_) {
            const item = findInfoEntryById(itemId) as InfoEntry

            const reader = new FileReader()
            const blob = (fileUpload.files)?.[0]
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
}


function whatToInclude(el: ShadowRoot): { self: boolean, children: boolean, copies: boolean, recursive: boolean } {
    const self = (el.getElementById("include-self-in-cost") as HTMLInputElement)?.checked
    const children = (el.getElementById("include-children-in-cost") as HTMLInputElement)?.checked
    const copies = (el.getElementById("include-copies-in-cost") as HTMLInputElement)?.checked
    const recursive = (el.getElementById("include-recusively-in-cost") as HTMLInputElement)?.checked
    return {
        self,
        children,
        copies,
        recursive
    }
}

function updateCostDisplay(el: ShadowRoot, itemId: bigint) {
    const costEl = el.getElementById("cost")
    if (!costEl) return

    const info = findInfoEntryById(itemId)
    if (!info) return

    const { self, children, copies, recursive } = whatToInclude(el)

    costEl.innerText = String(items_calculateCost(itemId, self, children, copies, recursive))
}

function updateEventsDisplay(this: DisplayMode, el: ShadowRoot, itemId: bigint) {
    const eventsTbl = el.getElementById("user-actions")
    if (!eventsTbl || !(eventsTbl instanceof this.win.HTMLTableElement)) return

    const { self, children, copies, recursive } = whatToInclude(el)

    const eventsToLookAt = items_findAllEvents(itemId, self, children, copies, recursive)
        .sort(items_compareEventTiming).reverse()

    if (!eventsToLookAt.length) {
        //there are no events
        eventsTbl.innerHTML = ""
        return
    }

    let html = `
            <thead>
                <tr>
                    <!-- this nonsense is so that the title lines up with the events -->
                    <th>
                        <div class="grid column">
                            <button onclick="openModalUI('new-event-form', this.getRootNode())">➕︎</button><span style="text-align: center">Event</span>
                        </div>
                    </th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
        `
    for (let event of eventsToLookAt) {
        let name = event.ItemId === itemId
            ? event.Event
            : `(${findInfoEntryById(event.ItemId).En_Title}) ${event.Event}`

        let timeTd = `<td>${items_eventTSHTML(event)}</td>`

        html += `<tr>
                        <td>
                            <div class="grid column">
                                <button class="delete" onclick="deleteEventByEventId(${event.EventId}).then(res => res && _reloadEvents(${event.ItemId}n))">🗑</button>
                                ${name}
                            </div>
                        </td>
                            ${timeTd}
                        </tr>`
    }
    html += "</tbody>"
    eventsTbl.innerHTML = html
}

function createRelationButtons(this: DisplayMode, elementParent: HTMLElement, relationGenerator: Generator<items_Entry>, relationType: "descendants" | "copies") {
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
                    refreshDisplayItem.call(this, thisId)
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

function updateObjectTbl(obj: object, objectTbl: HTMLTableElement, clear = true) {

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
        if (typeof val === 'bigint') {
            val = String(val)
        }
        else if (typeof val !== 'string' && typeof val !== 'number') {
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

function getCurrentObjectInObjEditor(itemId: bigint, el: ShadowRoot): object {
    const editedObject = (el.getElementById("current-edited-object") as HTMLSelectElement).value
    const user = findUserEntryById(itemId) as UserEntry
    const meta = findMetadataById(itemId) as MetadataEntry

    switch (editedObject) {
        case "user-extra":
            return JSON.parse(user.Extra) || {}
        case "meta-datapoints":
            return JSON.parse(meta.Datapoints) || {}
        case "meta-media-dependant":
            return JSON.parse(meta.MediaDependant) || {}
        case "aio-web":
            return getAIOWeb(user)
        case "user":
            return user || {}
        case "meta":
            return meta || {}
        case "entry":
            return findInfoEntryById(itemId) || {}
        default:
            return {}
    }
}

/**
 * @description updates all put-data elements with their respective contents
 */
function updateBasicDisplayEntryContents(this: DisplayMode, item: InfoEntry, user: UserEntry, meta: MetadataEntry, root: ShadowRoot) {
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
                data = item[key as keyof typeof item]
            } else if (key in meta) {
                data = meta[key as keyof typeof meta]
            } else if (key in user) {
                data = user[key as keyof typeof user]
            }

            if (!data) {
                const fallback = elem.getAttribute("put-data-fallback")
                if (fallback !== null) {
                    data = fallback
                }
            } else {
                data = String(data)
            }

            if (elem.getAttribute("put-data-mode") === "html") {
                elem.innerHTML = String(data)
            } else {
                elem.textContent = String(data)
                // elem.append(String(data))
            }
            break
        }
    }

    for (let actionEl of root.querySelectorAll("[entry-action]")) {
        let event = actionEl.getAttribute("entry-action-trigger") || "click"
        //@ts-ignore
        //use on_ instead of addEventListener because if the entry is refreshed, it will add multiple event listeners
        actionEl[`on${event}`] = e => {
            //@ts-ignore
            let actionFn = this.de_actions[actionEl.getAttribute("entry-action") as keyof typeof de_actions];
            if (actionFn)
                actionFn(e.target as HTMLElement)
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

    function renderVal(val: Type | string, output: HTMLElement) {
        if (val instanceof Elem) {
            output.append(val.el)
        } else if (val instanceof Arr) {
            for (let item of val.jsValue) {
                renderVal(item, output)
            }
        } else if (val instanceof Type) {
            output.innerHTML += val.jsStr()
        } else {
            output.innerHTML += val
        }
    }

    if (settings_get("enable_unsafe"))
        for (let elem of root.querySelectorAll("script")) {
            let script = elem.textContent
            if (!script) continue

            let res: string | Type

            if (elem.getAttribute("type") === "application/x-aiol") {
                let symbols = new CalcVarTable()
                symbols.set("root", new Elem(root as unknown as HTMLElement))
                symbols.set("results", new Arr(items_getResults().map(v => new EntryTy(v.info))))
                symbols.set("this", new EntryTy(item))
                res = parseExpression(script, symbols)
            } else {
                res = new this.win.Function("root", "results", script).bind(item)(root, items_getResults().map(v => v.info), item)
            }
            let outputId = elem.getAttribute("data-output")
            if (outputId) {
                let outputEl = root.querySelector(`[id="${outputId}"]`) as HTMLElement
                if (outputEl) {
                    outputEl.innerHTML = ""
                    renderVal(res, outputEl)
                }
            }
        }
}

/**
 * @description updates special-case legacy elements
 */
async function updateDisplayEntryContents(this: DisplayMode, item: InfoEntry, user: UserEntry, meta: MetadataEntry, events: UserEvent[], el: ShadowRoot) {
    //just in case we have generic metadata
    //if meta is not generic, this operation is cheap, no need for a guard
    meta = await findMetadataByIdAtAllCosts(meta.ItemId)

    updateBasicDisplayEntryContents.call(this, item, user, meta, el)

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
    const customStyles = el.getElementById("custom-styles")
    const locationEl = el.getElementById("location-link")
    const tzEl = el.getElementById("tz-selector")
    const typeSelector = el.getElementById("type-selector")
    const formatSelector = el.getElementById("format-selector")
    const notesEditBox = el.getElementById("notes-edit-box")
    const onFormat = el.getElementById("on-format")
    const digitized = el.getElementById("format-digitized")
    const genresRoot = el.getElementById("genres")
    const tagsRoot = el.getElementById("tags")
    const requiredItemsEl = el.getElementById("required-items")

    //object editor table
    const objectTbl = el.getElementById("display-info-object-tbl") as HTMLTableElement
    updateObjectTbl(getCurrentObjectInObjEditor(item.ItemId, el), objectTbl)

    //status
    updateStatusDisplay(user.Status, el)

    //Cost
    updateCostDisplay(el, item.ItemId)

    //Set the user's default timezone in the tz selector
    if (tzEl && tzEl instanceof HTMLSelectElement) {
        tzEl.value = Intl.DateTimeFormat().resolvedOptions().timeZone
    }

    //Art Style
    api_listArtStyles().then(as => {
        for (let a in as) {
            const cb = el.getElementById(`is-${as[a]}`)
            if (!cb || !(cb instanceof HTMLInputElement)) continue
            if (items_hasArtStyle(item, Number(a) as ArtStyle)) {
                cb.checked = true
            }
        }
    })

    //Location
    if (item.Location !== '' && locationEl && "value" in locationEl) {
        let loc = item.Location
        locationEl.value = loc
    }

    //user styles
    let userExtra = getUserExtra(user, "styles")
    let styles = userExtra || ""
    if (customStyles) {
        customStyles.innerText = styles
    }

    //type selector
    if (typeSelector && (typeSelector instanceof this.win.HTMLSelectElement)) {
        fillTypeSelectionUI(typeSelector).then(() => {
            typeSelector.value = item.Type
        })
    }

    //format selector
    if (formatSelector && (formatSelector instanceof this.win.HTMLSelectElement)) {
        fillFormatSelectionUI(formatSelector).then(() => {
            if (items_isDigitized(item.Format)) {
                formatSelector.value = String(item.Format - DIGI_MOD)
            } else {
                formatSelector.value = String(item.Format)
            }
        })
    }

    if (onFormat && !(await formatToName(item.Format)).startsWith("UNOWNED")) {
        onFormat.innerHTML = formatToSymbolUI(item.Format)
    }

    if (digitized && (digitized instanceof this.win.HTMLInputElement)) {
        digitized.checked = items_isDigitized(item.Format)
    }

    if (genresRoot) {
        const genres = JSON.parse(meta.Genres || "[]")
        const children = []
        for (let genre of genres) {
            const el = document.createElement("button")
            el.classList.add("tag")
            el.onclick = function() {
                ui_search(`#g:${genre.replaceAll(" ", "\\ ")}`)
            }
            el.append(genre)
            children.push(el)
        }
        genresRoot.replaceChildren(...children)
    }

    //tags
    if (tagsRoot) {
        tagsRoot.innerHTML = ""
        const tagTempl = el.querySelector("template#tag") as HTMLTemplateElement
        if (tagTempl)
            for (let tag of item.Tags || []) {
                tag = tag.trim()
                if (!tag) continue

                const copy = tagTempl.content.cloneNode(true) as HTMLElement
                const del = copy.querySelector("#delete-tag") as HTMLElement

                //TODO: make this and the btn.onclick a generic de_action
                //also put copy through updateBasicDisplayEntryContents that way
                //the tag template can be fully declarative
                del && (del.onclick = () => {
                    const info = findInfoEntryById(item.ItemId)
                    api_deleteEntryTags(info.ItemId, [tag])
                        .then(res => {
                            if (res?.status !== 200) return ""
                            res.text().then(() => {
                                info.Tags = info.Tags.filter((t: string) => t != tag)
                                changeDisplayItemData.call(this, info, user, meta, events, el.host as HTMLElement)
                            })
                        })
                        .catch(console.error)
                })

                const btn = copy.querySelector("#tag-name") as HTMLElement
                btn.innerText = tag

                btn.onclick = function(e) {
                    let btn = e.target as HTMLButtonElement
                    let tag = btn.innerText
                    mkSearchUI({
                        ["search-query"]: `#tag:${tag}`
                    })
                }

                tagsRoot?.append(copy)
            }
    }

    //type icon
    let typeIcon = typeToSymbol(item.Type)
    displayEntryTitle?.setAttribute("data-type-icon", typeIcon)

    if (getUidUI() === 0)
        displayEntryTitle?.setAttribute("data-owner", ACCOUNTS[item.Uid])

    let formatIcon = formatToSymbolUI(item.Format)
    displayEntryTitle?.setAttribute("data-format-icon", formatIcon)


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
    if (imgEl && imgEl instanceof this.win.HTMLImageElement) {
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
    if (ratingEl) {
        applyUserRating(user.UserRating, ratingEl)
        ratingEl.innerHTML = user.UserRating ? String(user.UserRating) : "Unrated"
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
    if (viewCountEl && (viewCount || user.Minutes)) {
        const user = findUserEntryById(item.ItemId)
        let mins = user.Minutes
            || Number(viewCount) * Number(mediaDependant["Show-length"] || mediaDependant["Movie-length"] || 0)

        viewCountEl.title = String(mins) + " minutes"

        let minutesRounded = String(Math.round(mins / 0.6) / 100 || "unknown")
        if (mins > 0 && user.Minutes !== mins && getUserExtra(user, "allow-minutes-override") === "true") {
            user.Minutes = mins
            api_setItem("engagement/", user).then(() => alert(`Updated viewing minutes to: ${mins}`))
        }
        viewCountEl.setAttribute("data-time-spent", minutesRounded)
        viewCountEl.innerText = String(viewCount)
    }


    //Media dependant
    let type = String(item.Type)

    if (mediaInfoTbl) {
        //remove the <Media>- part from the key looks ugly
        let modifiedKeys: { [k: string]: string } = {}
        for (let key in mediaDependant) {
            const val = mediaDependant[key]
            modifiedKeys[key] = val
        }
        mkGenericTbl(mediaInfoTbl, modifiedKeys)
    }


    //TODO:
    //for each [P]x[/y] in userPos create a progress element
    //for example "10, S1/3" would use 10 in the standard progress bar, then create a new progress bar for S with a max of 3 and value of 1
    //"10/30, S1/3" would use the standard progress bar for 10 but override lengthInNumber with 30, then create a second bar for S with max of 3 and value of 1
    //"10 S3" would create 2 progress bars, the first uses lengthInNumber as max, the 2nd uses 0 as max, so it would be S3/0
    //"," is optional
    let userPos = parseInt(user.CurrentPosition)

    el.host.setAttribute("data-user-status", user.Status)

    const lengthInNumber =
        mediaDependant[`${type}-episodes`]
        || mediaDependant[`${type}-volumes`]
        || mediaDependant[`${type}-chapters`]
        || mediaDependant[`${type}-page-count`]
        || 0

    if (progressEl && "max" in progressEl && "value" in progressEl && user.Status === "Viewing") {
        progressEl.max = lengthInNumber || 1

        progressEl.value = userPos || 0

    }
    if (captionEl) {
        captionEl.innerText = `${user.CurrentPosition}/${lengthInNumber}`
        captionEl.title = `${Math.round(userPos / parseInt(lengthInNumber) * 1000) / 10}%`
    }

    //relation elements
    for (let relationship of [["descendants", findDescendants], ["copies", findCopies]] as const) {
        let relationshipEl = el.getElementById(relationship[0])
        if (!relationshipEl) continue

        relationshipEl.innerHTML = ""
        createRelationButtons.call(this, relationshipEl, relationship[1](item.ItemId), relationship[0])
    }

    //Required items
    if (requiredItemsEl && item.Requires !== 0n) {
        const requiredItem = findInfoEntryById(item.Requires)
        let meta = findMetadataById(requiredItem.ItemId)
        let el = requiredItemsEl.querySelector("#required-item") as HTMLElement
        if (el instanceof HTMLImageElement) {
            formatToName(requiredItem.Format).then(name => {
                el.title = `${requiredItem.En_Title} (${typeToSymbol(requiredItem.Type)} on ${name})`
            })
            el.src = fixThumbnailURL(meta.Thumbnail)
            el.alt = requiredItem.En_Title || requiredItem.Native_Title
        } else {
            formatToName(requiredItem.Format).then(name => {
                el.title = `${requiredItem.En_Title} (${typeToSymbol(requiredItem.Type)} on ${name})`
            })
            el.innerText = requiredItem.En_Title || requiredItem.Native_Title
        }
        el.onclick = () => toggleItem(requiredItem)
        requiredItemsEl.appendChild(el)
    }

    //Events
    updateEventsDisplay.call(this, el, user.ItemId)
}

function displayItemInWindow(itemId: bigint, target: string = "_blank", popup: boolean = false) {
    return open(`/ui/display.html?item-id=${itemId}`, target, popup ? "popup=true" : undefined)
}

function renderDisplayItem(this: DisplayMode, itemId: bigint, template?: string): HTMLElement {
    let el = document.createElement("display-entry")
    let root = el.shadowRoot as ShadowRoot
    if (!root) return el

    let user = findUserEntryById(itemId) as UserEntry

    //use the dumbest hack imaginable to allow the previewtemplate function to force the window it opens to do the rendering
    //that hack being setting a global variable called GLOBAL_TEMPLATE which is the template to use
    //@ts-ignore
    if(self.GLOBAL_TEMPLATE && String(itemId) in self.GLOBAL_TEMPLATE) {
        //@ts-ignore
        template = self.GLOBAL_TEMPLATE[String(itemId)]
    }

    if (template || (user && (template = getUserExtra(user, "template")?.trim()))) {
        (root.getElementById("root") as HTMLDivElement).innerHTML =  template
    }

    let meta = findMetadataById(itemId)
    let events = findUserEventsById(itemId)
    const item = findInfoEntryById(itemId)

    if (!item || !user || !meta || !events) return el

    this.parent.append(el)

    api_listArtStyles().then(as => {
        for (let a in as) {
            const cb = root.getElementById(`is-${as[a]}`)
            if (!cb || !(cb instanceof HTMLInputElement)) continue
            cb.onchange = (e) => {
                const itemNew = findInfoEntryById(item.ItemId)
                const cb = e.target as HTMLInputElement
                const name = cb.getAttribute("id")?.slice(3) as ASName
                if (cb.checked) {
                    items_setArtStyle(itemNew, name)
                } else {
                    items_unsetArtStyle(itemNew, name)
                }

                api_setItem("", itemNew).then(() => {
                    alert(cb.checked ? `${name} set` : `${name} unset`)
                    updateInfo2({
                        [String(itemNew.ItemId)]: {
                            info: itemNew
                        }
                    })
                })
            }
        }
    })

    const currentEditedObj = root.getElementById("current-edited-object")
    if (currentEditedObj && "value" in currentEditedObj) {
        currentEditedObj.onchange = function() {
            const objectTbl = root.getElementById("display-info-object-tbl") as HTMLTableElement
            //these may or may not load in time by the time we get to this closure
            user = findUserEntryById(item.ItemId)
            meta = findMetadataById(item.ItemId)
            switch (currentEditedObj.value) {
                case "user-extra":
                    updateObjectTbl(JSON.parse(user.Extra), objectTbl)
                    break
                case "meta-datapoints":
                    updateObjectTbl(JSON.parse(meta.Datapoints), objectTbl)
                    break
                case "meta-media-dependant":
                    updateObjectTbl(JSON.parse(meta.MediaDependant), objectTbl)
                    break
                case "aio-web":
                    updateObjectTbl(getAIOWeb(user), objectTbl)
                    break
                case "user":
                    updateObjectTbl(user, objectTbl)
                    break
                case "meta":
                    updateObjectTbl(meta, objectTbl)
                    break
                case "entry":
                    updateObjectTbl(item, objectTbl)
                    break

            }
        }
    }

    for (let input of ["include-self-in-cost", "include-copies-in-cost", "include-children-in-cost", "include-recusively-in-cost"]) {
        const el = root.getElementById(input)
        if (!el) continue
        el.onchange = () => {
            updateCostDisplay(root, item.ItemId)
            updateEventsDisplay.call(this, root, item.ItemId)
        }
    }

    for (let popout of root.querySelectorAll("button.popout") as NodeListOf<HTMLElement>) {
        const parent = popout.parentElement
        if (!parent) continue
        popout.onclick = function() {
            let win = open("", "_blank", "popup=true")
            if (!win) return
            win.document.write(`<!DOCTYPE html>
<head style='height: 100dvh'>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel='stylesheet' href='/css/colors.css'>
    <link rel='stylesheet' href='/css/general.css'>
<style>
body {
margin: 0;
height: 100%;
}
</style>
</head>
<body>
    ${parent.outerHTML}
</body>`)
            //@ts-ignore
            let watcher: CloseWatcher | null = null
            if ("CloseWatcher" in window) {
                //@ts-ignore
                watcher = new win.CloseWatcher
                watcher.onclose = () => {
                    parent.classList.remove("none")
                    win.close()
                    watcher.destroy()
                }
            }
            //@ts-ignore
            win.document.body.querySelector("button.popout").onclick = () => {
                win.close()
                parent.classList.remove("none")
                if (watcher) watcher.destroy()
            }

            win.onbeforeunload = function() {
                if (watcher) watcher.destroy()
                parent.classList.remove("none")
            }
            parent.classList.add("none")
        }
    }

    const statusSelector = root.getElementById("status-selector")
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
    if (styleEditor && styleEditor instanceof this.win.HTMLTextAreaElement) {
        (styleEditor as HTMLTextAreaElement).value = extra || ""
        styleEditor.addEventListener("change", e => {
            const customStyles = root.getElementById("custom-styles") as HTMLStyleElement
            customStyles.innerText = (styleEditor as HTMLTextAreaElement).value
        })
    }
    let templEditor = root.getElementById("template-editor")
    if (templEditor && templEditor instanceof this.win.HTMLTextAreaElement) {
        (templEditor as HTMLTextAreaElement).value = getUserExtra(user, "template") || ""
    }

    let newChildButton = root.getElementById("new-child")
    if (newChildButton) {
        newChildButton.addEventListener("click", e => {
            const newEntryDialog = this.parent.ownerDocument.getElementById("new-entry") as HTMLDialogElement
            const parentIdInput = newEntryDialog.querySelector(`[name="parentId"]`) as HTMLInputElement
            parentIdInput.value = String(item.ItemId)
            newEntryDialog.showModal()
        })
    }

    let newCopyButton = root.getElementById("new-copy")
    if (newCopyButton) {
        newCopyButton.addEventListener("click", e => {
            const newEntryDialog = this.parent.ownerDocument.getElementById("new-entry") as HTMLDialogElement
            const parentIdInput = newEntryDialog.querySelector(`[name="copyOf"]`) as HTMLInputElement
            parentIdInput.value = String(item.ItemId)
            newEntryDialog.showModal()
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

    if (notesEditBox && "value" in notesEditBox) {
        notesEditBox.onchange = () => {
            const user = findUserEntryById(item.ItemId)
            user.Notes = String(notesEditBox.value)

            const userStringified = api_serializeEntry(user)

            updateInfo2({
                [String(item.ItemId)]: { user }
            })

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
        }
    }

    const cost = root.getElementById("cost")
    if (cost) {
        cost.onclick = async function() {
            const newPrice = await promptNumber("New cost", "not a number", parseFloat)
            if (newPrice === null) return
            let item = findInfoEntryById(itemId)
            item.PurchasePrice = newPrice as number
            api_setItem("", item).then(res => {
                if (res === null || res.status !== 200) {
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
        newTag.onclick = async () => {
            const name = await promptUI("Tag name (, seperated)")
            if (!name) return
            let names = name.split(",")
            const info = findInfoEntryById(item.ItemId)
            info.Tags = info.Tags?.concat(names) || names
            api_addEntryTags(info.ItemId, name.split(","))
                .then(res => {
                    if (res?.status !== 200) return ""
                    res.text().then(() => changeDisplayItemData.call(this, info, user, meta, events, el))
                })
                .catch(console.error)
        }
    }

    const locationEl = root.getElementById("location-link")
    if (locationEl && 'value' in locationEl) {
        locationEl.onchange = async () => {
            const info = findInfoEntryById(item.ItemId)
            info.Location = String(locationEl.value)
            await api_setItem("", info)
            updateInfo2({
                [String(info.ItemId)]: {
                    info: info
                }
            })
        }
    }

    changeDisplayItemData.call(this, item, user, meta, events, el)
    return el
}

function removeDisplayItem(this: DisplayMode, itemId: bigint) {
    // displayEntryIntersected.delete(String(itemId))
    const el = this.parent.querySelector(`[data-item-id="${itemId}"]`)
    if (!el) return
    el.remove()
}

function refreshDisplayItem(this: DisplayMode, itemId: bigint) {
    let el = this.parent.ownerDocument.querySelector(`display-entry[data-item-id="${itemId}"]`) as HTMLElement
    let info = findInfoEntryById(itemId)
    if (!info) return

    if (el) {
        let user = findUserEntryById(itemId)
        let events = findUserEventsById(itemId)
        let meta = findMetadataById(itemId)
        if (!info || !user || !events || !meta) return
        changeDisplayItemData.call(this, info, user, meta, events, el)
    } else {
        renderDisplayItem.call(this, itemId)
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

function _fetchLocationBackup(this: DisplayMode, itemId: bigint) {
    const item = findInfoEntryById(itemId) as InfoEntry

    let provider = item.Type === "Show" ? "sonarr" : "radarr"
    alert(`Using ${provider} to find location`)

    const popover = this.parent.ownerDocument.getElementById("items-listing") as HTMLDivElement

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
        const metaInfo = [...api_deserializeJsonl<MetadataEntry>(metaText.trim().split("\n"))]

        //TODO: if the length is 0, ask the user for a search query

        if (metaInfo.length === 1) {
            api_fetchLocation(item.ItemId, getUidUI(), provider, String(metaInfo[0].ItemId)).then(onfetchLocation)
            return
        }

        const metaRecord = Object.fromEntries(metaInfo.map(v => [v.ItemId, v]))

        const container = fillItemListingUI(metaRecord)

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

function _fetchLocation(this: DisplayMode, itemId: bigint) {
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
                    _fetchLocationBackup.call(this, itemId)
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

function copyThis(this: DisplayMode, item: InfoEntry) {
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
        requires: item.Requires || undefined,
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
                items_getAllEntries()[String(itemCopy.ItemId)].info = itemCopy
                items_getAllEntries()[String(itemCopy.ItemId)].user = userCopy
                items_getAllEntries()[String(itemCopy.ItemId)].meta = metaCopy
                for (let event of events) {
                    let eventCopy = { ...event }
                    eventCopy.ItemId = itemCopy.ItemId
                    items_getAllEntries()[String(itemCopy.ItemId)].events.push(eventCopy)
                }
                selectItem(itemCopy, true, this)
                renderSidebarItem(itemCopy, sidebarItems, { below: String(item.ItemId) })
            })
            .catch(console.error)
    })
}


async function deleteEventByEventId(eventId: number) {
    const uid = getUidUI()
    if (!confirm("Are you sure you want to delete this event")) {
        return false
    }

    const res = await api_deleteEventV2(eventId, uid)
    if (res?.status !== 200) {
        alert(res?.text() || "Failed to delete event")
        return true
    }
    alert("Successfully deleted event")
    return true
}

function _reloadEvents(itemId: bigint) {
    loadUserEvents(getUidUI())
        .then(() => {
            updateInfo2({
                [String(itemId)]: items_getAllEntries()[String(itemId)]
            })
        })
}

function deleteEventForItemId(itemId: bigint, ts: number, after: number, before: number) {
    if (!confirm("Are you sure you would like to delete this event")) {
        return
    }
    api_deleteEvent(itemId, ts, after, before)
        .then(res => res?.text())
        .then((text) =>
            loadUserEvents(getUidUI())
                .then(() => {
                    updateInfo2({
                        [String(itemId)]: items_getAllEntries()[String(itemId)]
                    })
                })
        )
        .catch(alert)
}

function deleteEvent(el: HTMLElement, ts: number, after: number, before: number) {
    deleteEventForItemId(getIdFromDisplayElement(el), ts, after, before)
}
