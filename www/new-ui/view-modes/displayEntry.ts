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
            finalItemId = await titleIdentification(provider, search, titleSearchContainer)
            break
        case "by-id":
            finalItemId = search
            break
    }
    finalizeIdentify(finalItemId, provider, BigInt(itemId))
        .then(loadMetadata)
        .then(() => {
            let newItem = globalsNewUi.entries[itemId]
            updateInfo({ entries: { [String(itemId)]: newItem } })
        })
}

async function titleIdentification(provider: string, search: string, selectionElemOutput: HTMLElement): Promise<string> {
    let res = await identify(search, provider)
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


function saveItemChanges(root: ShadowRoot, item: InfoEntry) {
    if (!confirm("Are you sure you want to save changes?")) {
        return
    }

    let userEntry = findUserEntryById(item.ItemId)
    if (!userEntry) return

    const customStylesElem = root.getElementById("style-editor") as HTMLTextAreaElement

    setUserExtra(userEntry, "styles", customStylesElem.value)

    let infoTable = root.getElementById("info-raw")
    let metaTable = root.getElementById("meta-info-raw")
    if (!infoTable || !metaTable) return

    const updateWithTable: (table: Element, item: InfoEntry | MetadataEntry) => void = (table, item) => {
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

    updateWithTable(infoTable, item)
    let meta = findMetadataById(item.ItemId)
    if (!meta) return
    updateWithTable(metaTable, meta)


    const infoStringified = mkIntItemId(
        JSON.stringify(
            item,
            (_, v) => typeof v === 'bigint' ? String(v) : v
        )
    )

    const metaStringified = mkIntItemId(
        JSON.stringify(
            meta, (_, v) => typeof v === 'bigint' ? String(v) : v
        )
    )

    const userStringified = mkIntItemId(
        JSON.stringify(
            userEntry,
            (_, v) => typeof v === "bigint" ? String(v) : v
        )
    )

    let promises = []

    let engagementSet = authorizedRequest(`${apiPath}/engagement/set-entry`, {
        body: userStringified,
        method: "POST"
    })
        .then(res => res.text())
        .then(console.log)
        .catch(console.error)

    promises.push(engagementSet)

    let entrySet = authorizedRequest(`${apiPath}/set-entry`, {
        body: infoStringified,
        method: "POST"
    })
        .then(res => res.text())
        .then(console.log)
        .catch(console.error)

    promises.push(entrySet)

    let metaSet = authorizedRequest(`${apiPath}/metadata/set-entry`, {
        body: metaStringified,
        method: "POST"
    }).then(res => res.text())
        .then(console.log)
        .catch(console.error)

    promises.push(metaSet)
    updateInfo({
        entries: { [String(item.ItemId)]: item },
        userEntries: { [String(item.ItemId)]: userEntry },
        metadataEntries: { [String(item.ItemId)]: meta }
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

function newEvent(form: HTMLFormElement) {
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
    apiRegisterEvent(itemId, name.toString(), ts, afterts)
        .then(res => res.text())
        .then(() => {
            updateInfo({
                events: [
                    {
                        Timestamp: ts,
                        After: afterts,
                        Event: name.toString(),
                        ItemId: itemId,
                        TimeZone: ""
                    }
                ]
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
    add(entry, updateStats = true) {
        updateStats && changeResultStatsWithItem(entry)
        renderDisplayItem(entry)
    },

    sub(entry, updateStats = true) {
        updateStats && changeResultStatsWithItem(entry, -1)
        removeDisplayItem(entry)
    },

    refresh(id) {
        let info = findInfoEntryById(id)
        if (!info) return

        refreshDisplayItem(info)
    },

    addList(entry, updateStats = true) {
        displayEntryIntersected.clear()

        updateStats && changeResultStatsWithItemList(entry, 1)
        for (let i = 0; i < entry.length; i++) {
            if (i > 5) {
                displayQueue.push(entry[i])
            } else {
                renderDisplayItem(entry[i])
            }
        }
    },

    subList(entry, updateStats = true) {
        updateStats && changeResultStatsWithItemList(entry, -1)

        const itemIdsToRemove = entry.map(v => v.ItemId)
        displayQueue = displayQueue.filter(i => !itemIdsToRemove.includes(i.ItemId))

        for (let item of entry) {
            removeDisplayItem(item)
        }
    },

    putSelectedInCollection() {
        const selected = globalsNewUi.selectedEntries
        const collectionName = prompt("Id of collection")
        if (!collectionName) return

        let waiting = []
        for (let item of selected) {
            waiting.push(setParent(item.ItemId, BigInt(collectionName)))
        }
        Promise.all(waiting).then(res => {
            for (let r of res) {
                console.log(r.status)
            }
        })
    },

    addTagsToSelected() {
        const tags = prompt("tags (, seperated)")
        if (!tags) return

        const tagsList = tags.split(",")
        for (let item of globalsNewUi.selectedEntries) {
            addEntryTags(item.ItemId, tagsList)
        }
        //FIXME: tags do not update immediately
    }
}

function hookActionButtons(shadowRoot: ShadowRoot, item: InfoEntry) {

    let multiActionButton = shadowRoot.querySelector('[data-action="Begin+Pause+Resume"]')

    if (multiActionButton) {
        multiActionButton.addEventListener("click", _ => {
            let user = findUserEntryById(item.ItemId)
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
                .then(res => res.text())
                .then(text => {
                    alert(text)

                    loadUserEvents().then(() =>
                        updateInfo({
                            entries: {
                                [String(item.ItemId)]: item
                            },
                        })
                    )
                })
        })
    }

    for (let btn of shadowRoot.querySelectorAll("[data-action]") || []) {
        let action = btn.getAttribute("data-action")

        //this action does multiple things
        if (action?.includes("+")) continue

        btn.addEventListener("click", _ => {
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
                .then(res => res.text())
                .then(text => {
                    alert(text)
                    loadUserEvents().then(() =>
                        updateInfo({
                            entries: {
                                [String(item.ItemId)]: item
                            }
                        })
                    )
                })
        })
    }


    let imgEl = shadowRoot.getElementById("thumbnail") as HTMLImageElement
    const fileUpload = (shadowRoot.getElementById("thumbnail-file-upload")) as HTMLInputElement

    fileUpload.onchange = async function(_) {
        const reader = new FileReader()
        const blob = fileUpload.files?.[0]
        if (!blob) return
        reader.readAsDataURL(blob)
        reader.onload = () => {
            if (!reader.result) return
            let result = reader.result.toString()
            updateThumbnail(item.ItemId, result)
                .then(() => {
                    let meta = findMetadataById(item.ItemId)
                    if (!meta) {
                        refreshInfo().then(() => {
                            refreshDisplayItem(item)
                            refreshSidebarItem(item)
                        })
                    } else {
                        meta.Thumbnail = result
                        updateInfo({
                            entries: {
                                [String(item.ItemId)]: item
                            },
                            metadataEntries: {
                                [String(item.ItemId)]: meta
                            }
                        })
                    }
                })
        }
    }
    imgEl.onclick = function(_) {
        if (!fileUpload) return

        fileUpload.click()
        console.log(fileUpload.value)
    }
}

function updateCostDisplay(el: ShadowRoot, item: InfoEntry) {
    const costEl = el.getElementById("cost") as HTMLSpanElement

    const includeSelf = (el.getElementById("include-self-in-cost") as HTMLInputElement).checked
    const includeChildren = (el.getElementById("include-children-in-cost") as HTMLInputElement).checked
    const includeCopies = (el.getElementById("include-copies-in-cost") as HTMLInputElement).checked

    let costTotal = 0
    if (includeSelf) {
        costTotal += item.PurchasePrice
    }
    if (includeChildren) {
        let children = Object.values(globalsNewUi.entries).filter(v => v.ParentId === item.ItemId)
        for (let child of children) {
            costTotal += child.PurchasePrice
        }
    }
    if (includeCopies) {
        let copies = Object.values(globalsNewUi.entries).filter(v => v.CopyOf === item.ItemId)
        for (let copy of copies) {
            costTotal += copy.PurchasePrice
        }
    }
    costEl.innerText = String(costTotal)
}

function createRelationButtons(elementParent: HTMLElement, relationGenerator: Generator<InfoEntry>) {
    let relationships = relationGenerator.toArray()
    let titles = relationships.map(i => i.En_Title)
    relationships = relationships.sort((a, b) => {
        return (sequenceNumberGrabber(a.En_Title, titles) || 0) - (sequenceNumberGrabber(b.En_Title, titles) || 0)
    })
    for (let child of relationships) {
        let meta = findMetadataById(child.ItemId)
        let el: HTMLElement
        if (meta?.Thumbnail) {
            el = document.createElement("img")
            formatToName(child.Format).then(name => {
                el.title = `${child.En_Title} (${typeToSymbol(child.Type)} on ${name})`
            })
            //@ts-ignore
            el.src = fixThumbnailURL(meta.Thumbnail)
        } else {
            el = document.createElement("button")
            el.innerText = child.En_Title
        }
        elementParent.append(el)
        el.onclick = () => toggleItem(child)
    }
}

type TT = { t: "open-tag" | "close-tag" | "\\" | "whitespace" | "char", value: string }

function serializeTT(t: TT) {
    switch (t.t) {
        case "open-tag":
            return `[${t.value}]`
        case "close-tag":
            return `[/${t.value}]`
        case "\\":
            return `\\${t.value}`
        case "whitespace":
        case "char":
            return t.value
    }
}

class NotesLexer {
    notes: string
    #i: number
    constructor(notes: string) {
        this.notes = notes

        this.#i = -1
    }

    next() {
        this.#i++
        return this.notes[this.#i]
    }

    peek() {
        return this.notes[this.#i + 1]
    }

    back() {
        this.#i--
        return this.notes[this.#i]
    }

    get curChar() {
        return this.notes[this.#i]
    }

    tag(): ["open" | "close", string] {
        let name = ""
        let open = true
        if (this.peek() == "/") {
            this.next()
            open = false
        }

        while (this.next() && this.curChar != "]") {
            name += this.curChar
        }
        return [open ? "open" : "close", name]
    }

    lex() {
        const tokens: TT[] = []
        while (this.next()) {
            let ch = this.curChar
            if (ch.match(/\s/)) {
                tokens.push({ t: "whitespace", value: ch })
            } else {
                switch (ch) {
                    case "[":
                        //tag_pos is either open or close
                        let [tag_pos, name] = this.tag()
                        tokens.push({ t: `${tag_pos}-tag`, value: name })
                        break
                    case "\\":
                        tokens.push({ t: ch, value: ch })
                        break
                    default:
                        tokens.push({ t: "char", value: ch })
                }
            }
        }

        return tokens
    }
}

interface NotesNode {
    getHTML(): string
}

class NotesStringNode implements NotesNode {
    constructor(public value: string) { }

    getHTML(): string {
        return this.value
    }
}
class NotesTagNode implements NotesNode {
    constructor(public name: string, public innerText: string, public propertyValue: string) { }

    getHTML(): string {
        let startTag = ""
        let endTag = ""
        let selfClosing = false
        switch (this.name) {
            case "i":
                startTag = "<i>"
                endTag = "</i>"
                break
            case "b":
                startTag = "<b>"
                endTag = "</b>"
                break
            case "spoiler":
                startTag = "<span class='spoiler'>"
                endTag = "</span>"
                break
            case "color":
                startTag = `<span style="color:${this.propertyValue.replaceAll(/;"/g, "")}">`
                endTag = "</span>"
                break
            case "list":
                if (this.propertyValue === "numbered") {
                    let n = 0
                    this.innerText = this.innerText.replaceAll("-", () => {
                        n++
                        return `${n}. `
                    })
                } else {
                    this.innerText = this.innerText.replaceAll("-", "•")
                }
                break
            case "bgcolor":
                startTag = `<span style="background-color:${this.propertyValue.replaceAll(/;"/g, "")}">`
                endTag = "</span>"
                break
            case "hl":
                startTag = `<mark>`
                endTag = "</mark>"
                break
            case "size":
                let size = parseFloat(this.propertyValue)
                let unit = this.propertyValue.slice(Math.ceil(Math.log10(size)))
                if (unit)
                    startTag = `<span style="font-size: ${size}${unit.replaceAll('"', '')}">`
                else
                    //use old sizes since user did not specify a unit
                    startTag = `<font size=${size}>`
                endTag = "</span>"
                break
            case "img":
                let properties = this.propertyValue.split(",")
                let width = "", height = ""
                for (let prop of properties) {
                    let [key, value] = prop.split(":")
                    switch (key) {
                        case "id":
                            let id = value
                            //the thumbnail should be the item's thumbnail
                            this.propertyValue = findMetadataById(BigInt(id))?.Thumbnail || ""
                            break

                        case "w":
                            width = value + "px"
                            break
                        case "h":
                            height = value + "px"
                            break
                    }
                }
                startTag = `<img src="${this.propertyValue}" height="${height}" width="${width}" alt="${this.innerText.replaceAll('"', "")}" style="vertical-align: middle">`
                selfClosing = true
                break
            case "item":
                if (this.propertyValue.match(/[^\d]/)) {
                    startTag = "<span>"
                    this.innerText = "INVALID ID"
                    endTag = "</span>"
                } else {
                    startTag = `<button onclick="toggleItem(findInfoEntryById(${this.propertyValue}n))">`
                    endTag = "</button>"
                }
                break
        }
        if (!selfClosing) {
            return startTag + parseNotes(this.innerText) + endTag
        }
        return startTag
    }
}

class NotesParser {
    tokens: TT[]
    nodes: NotesNode[]
    #i: number
    constructor(tokens: TT[]) {
        this.tokens = tokens

        this.nodes = []

        this.#i = -1
    }

    next() {
        this.#i++
        return this.tokens[this.#i]
    }

    back() {
        this.#i--
        return this.tokens[this.#i]
    }

    get curTok() {
        return this.tokens[this.#i]
    }

    handleEscape(): NotesStringNode {
        return new NotesStringNode(this.next().value)
    }

    handleOpenTag(): NotesTagNode | NotesStringNode {
        let name = this.curTok.value
        let value = ""
        if (name.includes("=")) {
            [name, value] = name.split("=")
        }


        let ate = ""
        while (this.next() && !(this.curTok.t === "close-tag" && this.curTok.value === name)) {
            ate += serializeTT(this.curTok)
        };


        if (!this.curTok) {
            if (value)
                return new NotesStringNode(`[${name}=${value}]${ate}`)
            return new NotesStringNode(`[${name}]${ate}`)
        }

        return new NotesTagNode(name, ate.trim(), value)
    }

    handleString(): NotesStringNode {
        let text = this.curTok.value

        while (this.next() && this.curTok.t === "char") {
            text += this.curTok.value
        }
        //goes too far
        this.back()
        return new NotesStringNode(text)
    }

    parse() {
        while (this.next()) {
            switch (this.curTok.t) {
                case "\\":
                    this.nodes.push(this.handleEscape())
                    break
                case "open-tag":
                    this.nodes.push(this.handleOpenTag())
                    break
                case "char":
                    this.nodes.push(this.handleString())
                    break
                case "whitespace":
                    this.nodes.push(new NotesStringNode(this.curTok.value))
                    break
            }
        }
        return this.nodes
    }
}

function parseNotes(notes: string) {
    const l = new NotesLexer(notes)
    const tokens = l.lex()

    const p = new NotesParser(tokens)
    const nodes = p.parse()

    let text = ""
    for (let node of nodes) {
        text += node.getHTML()
    }
    return text
}

function updateDisplayEntryContents(item: InfoEntry, user: UserEntry, meta: MetadataEntry, events: UserEvent[], el: ShadowRoot) {
    const displayEntryTitle = el.getElementById("main-title") as HTMLHeadingElement
    const displayEntryNativeTitle = el.getElementById("official-native-title") as HTMLHeadingElement
    const imgEl = el.getElementById("thumbnail") as HTMLImageElement
    const descEl = el.getElementById("description") as HTMLParagraphElement
    const notesEl = el.getElementById("notes") as HTMLParagraphElement
    const ratingEl = el.getElementById("user-rating") as HTMLSpanElement
    const audienceRatingEl = el.getElementById("audience-rating") as HTMLElement
    const infoRawTbl = el.getElementById("info-raw") as HTMLTableElement
    const metaRawtbl = el.getElementById("meta-info-raw") as HTMLTableElement
    const viewCountEl = el.getElementById("view-count") as HTMLSpanElement
    const progressEl = el.getElementById("entry-progressbar") as HTMLProgressElement
    const captionEl = el.getElementById("entry-progressbar-position-label") as HTMLElement
    const mediaInfoTbl = el.getElementById("media-info") as HTMLTableElement
    const eventsTbl = el.getElementById("user-actions") as HTMLTableElement
    const customStyles = el.getElementById("custom-styles") as HTMLStyleElement

    const notesEditBox = el.getElementById("notes-edit-box") as HTMLTextAreaElement

    //Cost
    updateCostDisplay(el, item)

    let userExtra = getUserExtra(user, "styles")
    let styles = userExtra || ""
    customStyles.innerText = styles

    //tags
    const tagsRoot = el.getElementById("tags") as HTMLDivElement
    tagsRoot.innerHTML = ""
    for (let tag of item.Tags || []) {
        tag = tag.trim()
        if (!tag) continue
        const outer = document.createElement("div")

        const del = document.createElement("button")
        del.innerText = "🗑"
        del.classList.add("delete")

        del.onclick = function() {
            deleteEntryTags(item.ItemId, [tag])
                .then(res => {
                    if (res.status !== 200) return ""
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
            searchInput.value = `#tag:${tag}`
            searchInput.form?.submit()
        }

        tagsRoot?.append(outer)
    }

    //type icon
    let typeIcon = typeToSymbol(item.Type)
    displayEntryTitle?.setAttribute("data-type-icon", typeIcon)


    //format
    formatToName(item.Format).then(name => {
        displayEntryTitle?.setAttribute("data-format-name", name)
    })


    //Title
    displayEntryTitle.innerText = meta.Title || item.En_Title
    //only set the title of the heading to the user's title if the metadata title exists
    //otherwise it looks dumb
    if (meta.Title && item.En_Title) {
        displayEntryTitle.title = item.En_Title
    }

    //Native title
    displayEntryNativeTitle.innerText = meta.Native_Title || item.Native_Title
    //Same as with the regular title
    if (meta.Native_Title && item.Native_Title) {
        displayEntryNativeTitle.title = item.Native_Title
    }

    //Thumbnail
    imgEl.alt = meta.Title || item.En_Title
    imgEl.src = fixThumbnailURL(meta.Thumbnail)


    //Description
    descEl.innerHTML = meta.Description

    //Notes
    notesEditBox.value = user.Notes
    notesEl.innerHTML = parseNotes(user.Notes)

    //Rating
    if (user.UserRating) {
        applyUserRating(user.UserRating, ratingEl)
        ratingEl.innerHTML = String(user.UserRating)
    } else {
        ratingEl.innerText = "Unrated"
    }

    //Audience Rating
    let max = meta.RatingMax
    if (meta.Rating) {
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
    mkGenericTbl(infoRawTbl, item)

    //Meta table raw
    let data = meta
    mkGenericTbl(metaRawtbl, data)

    //View count
    let viewCount = user.ViewCount
    if (viewCount) {
        let mediaDependant
        try {
            mediaDependant = JSON.parse(data["MediaDependant"])
        } catch (err) {
            console.error("Could not parse media dependant meta info json")
            return
        }
        viewCountEl.setAttribute("data-time-spent", String(Number(viewCount) * Number(mediaDependant["Show-length"] || mediaDependant["Movie-length"] || 0) / 60 || "unknown"))
        viewCountEl.innerText = String(viewCount)
    }


    //Media dependant
    let type = item.Type
    type = String(type)
    let mediaDeptData
    try {
        mediaDeptData = JSON.parse(meta.MediaDependant)
    }
    catch (err) {
        console.error("Could not parse json", meta.MediaDependant)
        return
    }
    //remove the <Media>- part from the key looks ugly
    let modifiedKeys: { [k: string]: string } = {}
    for (let key in mediaDeptData) {
        const val = mediaDeptData[key]
        key = key.split("-").slice(1).join(" ")
        modifiedKeys[key] = val
    }
    mkGenericTbl(mediaInfoTbl, modifiedKeys)


    el.host.setAttribute("data-user-status", user.Status)
    if (mediaDeptData[`${type}-episodes`] && user.Status === "Viewing") {
        progressEl.max = mediaDeptData[`${type}-episodes`]

        let pos = Number(user.CurrentPosition)
        progressEl.value = pos

        captionEl.innerText = `${pos}/${progressEl.max}`
        captionEl.title = `${Math.round(pos / progressEl.max * 1000) / 10}%`
    }

    //Current position
    progressEl.title = user.CurrentPosition
    if (progressEl.max) {
        progressEl.title = `${user.CurrentPosition}/${progressEl.max}`
    }

    //relation elements
    for (let relationship of [["descendants", findDescendants], ["copies", findCopies]] as const) {
        let relationshipEl = el.getElementById(relationship[0]) as HTMLElement
        relationshipEl.innerHTML = ""
        createRelationButtons(relationshipEl, relationship[1](item.ItemId))
    }

    //Events
    if (events.length) {
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
    } else {
        //there are no events
        eventsTbl.innerHTML = ""
    }
}

function renderDisplayItem(item: InfoEntry, parent: HTMLElement | DocumentFragment = displayItems) {
    let el = document.createElement("display-entry")

    observer.observe(el)

    let meta = findMetadataById(item.ItemId)
    let user = findUserEntryById(item.ItemId)
    let events = findUserEventsById(item.ItemId)
    if (!user || !meta || !events) return

    parent.append(el)

    let root = el.shadowRoot
    if (!root) return

    const includeSelf = (root.getElementById("include-self-in-cost") as HTMLInputElement)
    const includeChildren = (root.getElementById("include-children-in-cost") as HTMLInputElement)
    const includeCopies = (root.getElementById("include-copies-in-cost") as HTMLInputElement)

    for (let input of [includeSelf, includeCopies, includeChildren]) {
        input.onchange = function() {
            updateCostDisplay(root, item)
        }
    }


    let extra = getUserExtra(user, "styles")

    let styleEditor = root.getElementById("style-editor") as HTMLTextAreaElement
    styleEditor.value = extra || ""
    styleEditor.addEventListener("change", e => {
        const customStyles = root.getElementById("custom-styles") as HTMLStyleElement
        customStyles.innerText = styleEditor.value
    })

    let newChildButton = root.getElementById("new-child") as HTMLButtonElement
    newChildButton.addEventListener("click", e => {
        const newEntryDialog = document.getElementById("new-entry") as HTMLDialogElement
        const parentIdInput = newEntryDialog.querySelector(`[name="parentId"]`) as HTMLInputElement
        parentIdInput.value = String(item.ItemId)
        newEntryDialog.showPopover()
    })

    const newChildByIdInput = root.getElementById("new-child-by-id") as HTMLInputElement

    newChildByIdInput.onchange = function() {
        let childId = BigInt(newChildByIdInput.value)
        let info = findInfoEntryById(childId)
        if (!info) return
        info.ParentId = item.ItemId
        setParent(childId, item.ItemId).then(() => {
            updateInfo({
                entries: {
                    [String(item.ItemId)]: item,
                    [newChildByIdInput.value]: info
                }
            })
        })
    }

    hookActionButtons(root, item)

    const notesEditBox = root.getElementById("notes-edit-box") as HTMLTextAreaElement
    notesEditBox.onchange = function() {
        user.Notes = notesEditBox.value
        updateInfo({
            entries: {
                [String(item.ItemId)]: item
            },
            userEntries: {
                [String(item.ItemId)]: user
            }
        })
    }

    const newTag = (root.getElementById("create-tag")) as HTMLButtonElement
    newTag.onclick = function() {
        const name = prompt("Tag name (, seperated)")
        if (!name) return
        let names = name.split(",")
        item.Tags = item.Tags?.concat(names) || names
        addEntryTags(item.ItemId, name.split(","))
            .then(res => {
                if (res.status !== 200) return ""
                res.text().then(() => changeDisplayItemData(item, user, meta, events, el))
            })
            .catch(console.error)
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
}

function removeDisplayItem(item: InfoEntry) {
    displayEntryIntersected.delete(String(item.ItemId))
    const el = /**@type {HTMLElement}*/(displayItems.querySelector(`[data-item-id="${item.ItemId}"]`))
    if (!el) return
    el.remove()
    observer.unobserve(el)
}

function refreshDisplayItem(item: InfoEntry) {
    let el = document.querySelector(`display-entry[data-item-id="${item.ItemId}"]`) as HTMLElement
    if (el) {
        let user = findUserEntryById(item.ItemId)
        let events = findUserEventsById(item.ItemId)
        let meta = findMetadataById(item.ItemId)
        if (!user || !events || !meta) return
        changeDisplayItemData(item, user, meta, events, el)
    } else {
        renderDisplayItem(item)
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

const displayEntryDelete = displayEntryAction(item => deleteEntryUI(item))
const displayEntryRefresh = displayEntryAction((item, root) => overwriteEntryMetadataUI(root, item))
const displayEntrySave = displayEntryAction((item, root) => saveItemChanges(root, item))
const displayEntryClose = displayEntryAction(item => deselectItem(item))

const displayEntryEditStyles = displayEntryAction((item, root) => {
    const styleEditor = root.getElementById("style-editor") as HTMLTextAreaElement
    styleEditor.hidden = !styleEditor.hidden
})

const displayEntryCopyTo = displayEntryAction(item => {
    let id = promptNumber("Copy user info to (item id)", "Not a number, mmust be item id number", BigInt)
    if (id === null) return
    let idInt = BigInt(id)

    copyUserInfo(item.ItemId, idInt)
        .then(res => res?.text())
        .then(console.log)
})

const displayEntryViewCount = displayEntryAction(item => {
    let count = promptNumber("New view count", 'Not a number, view count')
    if (count === null) return

    authorizedRequest(`${apiPath}/engagement/mod-entry?id=${item.ItemId}&view-count=${count}`)
        .then(res => res.text())
        .then(alert)
        .then(() => {
            let user = findUserEntryById(item.ItemId)
            if (!user) {
                refreshInfo().then(() => {
                    refreshDisplayItem(item)
                })
            } else {
                user.ViewCount = Number(count)
                updateInfo({
                    entries: {
                        [String(item.ItemId)]: item
                    },
                    userEntries: {
                        [String(item.ItemId)]: user
                    }
                })
            }
        })
        .catch(console.error)
})

const displayEntryProgress = displayEntryAction(async (item, root) => {
    let progress = root.getElementById("entry-progressbar") as HTMLProgressElement

    let newEp = promptNumber("Current position:", "Not a number, current position")
    if (!newEp) return

    await setPos(item.ItemId, String(newEp))
    root.host.setAttribute("data-user-current-position", String(newEp))
    progress.value = Number(newEp)
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

    authorizedRequest(`${apiPath}/engagement/mod-entry?id=${item.ItemId}&rating=${newRating}`)
        .then(() => {
            let user = findUserEntryById(item.ItemId)
            if (!user) {
                return refreshInfo()
            }
            user.UserRating = Number(newRating)
            updateInfo({
                entries: {
                    [String(item.ItemId)]: item
                },
                userEntries: {
                    [String(item.ItemId)]: user
                }
            })
        })
        .catch(console.error)
    apiRegisterEvent(item.ItemId, `rating-change - ${user?.UserRating} -> ${newRating}`, Date.now(), 0).catch(console.error)
})

function deleteEvent(el: HTMLElement, ts: number, after: number) {
    if (!confirm("Are you sure you would like to delete this event")) {
        return
    }
    const itemId = getIdFromDisplayElement(el)
    apiDeleteEvent(itemId, ts, after)
        .then(res => res.text())
        .then(() =>
            loadUserEvents()
                .then(() => updateInfo({
                    entries: { [String(itemId)]: globalsNewUi.entries[String(itemId)] }
                }))
        )
        .catch(alert)

}
