type TierListMode = {
    rows: Record<string, HTMLUListElement>
    tierlistEl: HTMLElement
    previousMode: string

    sub(entry: InfoEntry, ratingMode: "general" | "user" | ""): any
    _setup(): any
    _modeSelector(): any
    _customExpr(): any
    _getMode(): "general" | "user" | "custom"
    _findInfo(id: bigint, mode: "general" | "user" | "custom"): [number, string | false]
} & Mode

var TierListMode: ModeConstructor<TierListMode> = function(this: TierListMode, output?: HTMLElement | DocumentFragment, win ?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)
    this.rows = {}

    this._setup()
} as any

function _exportTierlist_binary(root: HTMLElement) {
    let out = "\x01"
    for(let tier of root.querySelectorAll("ul")) {
        let color = _getClr((tier.firstElementChild || document.documentElement) as HTMLElement)
        out += `\x05${tier.querySelector('tier-label')?.textContent}\x00${color}\x06`
        for(let el of tier.querySelectorAll(":where(img,button:not(:has(img)))")) {
            if("src" in el && typeof el.src === "string") {
                out += `${el.src}\x00`
            } else {
                const svg = document.createElement("svg")
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
                svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
                svg.setAttribute("viewBox", "-100 -100 200 200")
                text.setAttribute("x", "50")
                text.setAttribute("y", "50")
                text.append(el.innerHTML)
                svg.append(text)
                out += `data:image/svg+xml,${svg.outerHTML}\x00`
            }
        }
        out += "\x1d"
    }
    ua_download(out, "aio.tierlist", "application/x-tierlist")
}

function _getClr(element: HTMLElement) {
    let clr = getComputedStyle(element).backgroundColor
    /* color can be some insane color that no other program would support, eg: color(srgb r g b / a) */
    /* if the browser supports parsing colors, parse it and turn it into #rrggbbaa */
    /*this has the added benifit of: if the color is fully transparent
        * (we dont want this), change it to some default color, like black */
    if("CSSColorValue" in window) {
        /* support for this is AWFUL, even in chrome which "supports" it */
        /* it doesn't parse every color... */
        try {
            //@ts-ignore
            let rgb = CSSColorValue.parse(clr)
            //@ts-ignore
            if(!(rgb instanceof element.ownerDocument.defaultView.CSSRGB)) {
                return clr
            }

            const parsecomponent = (c: CSSUnitValue, max = 255) => {
                let val = (c.unit === 'percentage'
                    ? Math.floor(c.value * max)
                    : Math.floor(c.value)).toString(16)
                return val.length === 1
                    ? '0' + val
                    : val
            }
            return `#${parsecomponent(rgb.r)}${parsecomponent(rgb.g)}${parsecomponent(rgb.b)}`
        } catch(err) {
            console.warn(err)
            return clr
        }
    }
    return clr
}

function _exportTierlist_xml(tierlist: HTMLElement) {
    const doctype = document.implementation.createDocumentType(
        "tierlist",
        "-//SECEURITY PLACE//DTD TIERLISTX 1.0//EN",
        "https://static.seceurity.place/xml/tierlistx.dtd")
    const doc = document.implementation.createDocument(
        "https://static.seceurity.place/xml/tierlistx.html",
        null,
        doctype)
    const root = doc.createElement("tierlist")
    doc.append(root)
    let i = 0
    for (let tier of tierlist.querySelectorAll("ul")) {
        const row = doc.createElement("row")
        root.appendChild(row)
        let label = tier.querySelector("tier-label")?.textContent
        if (!label) {
            label = `Tier#${i}`
        }
        row.setAttribute("name", label)
        let color = _getClr((tier.firstElementChild || document.documentElement) as HTMLElement)
        row.setAttribute("color", color)

        for(let el of tier.querySelectorAll(":where(img,button:not(:has(img)))")) {
            const item = doc.createElement("item")
            if("src" in el && typeof el.src === "string") {
                item.append(doc.createTextNode(el.src))
            } else {
                const svg = document.createElement("svg")
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
                svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
                svg.setAttribute("viewBox", "-100 -100 200 200")
                text.setAttribute("x", "50")
                text.setAttribute("y", "50")
                text.append(el.innerHTML)
                svg.append(text)
                item.append(doc.createTextNode(`data:image/svg+xml,${svg.outerHTML}`))
            }
            row.appendChild(item)
        }

        i++
    }
    const s = new XMLSerializer()
    ua_download("<?xml version=\"1.0\" encoding=\"UTF-8\"?>" + s.serializeToString(doc),
                "aio.tierlistx", "application/x-tierlist+xml")
}

function _exportTierlist(root: HTMLElement, as: "application/x-tierlist" | "application/x-tierlist+xml") {
    return as === "application/x-tierlist"
        ? _exportTierlist_binary(root)
        : _exportTierlist_xml(root)
}

TierListMode.prototype._setup = function(this: TierListMode, ) {
    const tierListStyles = settings_get(getUserUID(), "tierlist_styles")

    let modeSelector = this.output.querySelector("#tierlist-mode")
    let customExpr = this.output.querySelector("#tierlist-custom")
    let exportTierlist = dom_getel("#export-tierlist", this.win.HTMLElement, this.output)

    if (modeSelector instanceof this.win.HTMLSelectElement) {
        this.previousMode = modeSelector.value
        modeSelector.onchange = this._modeSelector.bind(this)
    }

    if (customExpr instanceof this.win.HTMLTextAreaElement) {
        customExpr.oninput = this._customExpr.bind(this)
    }

    if(exportTierlist) {
        exportTierlist.onclick =(e) => {
            if(!this.tierlistEl) return
            _exportTierlist(
                this.tierlistEl,
                dom_getelorthrow(
                    "#export-tierlist-as",
                    this.win.HTMLSelectElement,
                    this.output
                ).value as any
            )
        }
    }

    const tle = dom_getel("tier-list", this.win.HTMLElement, this.output)
    if(!tle) {
        this.tierlistEl = document.createElement("tier-list")
        this.output.append(this.tierlistEl)
    } else this.tierlistEl = tle

    while (this.tierlistEl.childNodes.length) {
        this.tierlistEl.firstChild?.remove()
    }

    const style = document.createElement("style")
    this.tierlistEl.append(style)

    for (let tier of Object.entries(settings_get(getUserUID(), "tiers"))) {
        const ul = document.createElement("ul")
        const label = document.createElement("tier-label")

        const thisTierStyles = tierListStyles[tier[0] as keyof typeof tierListStyles] || ""

        style.innerText += `#tierlist-output .${tier[0]}-tier { ${thisTierStyles} }`

        label.innerText = tier[0]
        ul.append(label)
        ul.classList.add(`${tier[0]}-tier`)
        this.rows[tier[0]] = ul
        this.tierlistEl.append(ul)
    }
}

TierListMode.prototype._modeSelector = function(this: TierListMode, e: Event) {
    let items = items_getSelected()
    this.clearSelected()
    this.addList(items)

    if (e.target && "value" in e.target) {
        this.previousMode = e.target.value as string
    }
}

TierListMode.prototype._customExpr = function(this: TierListMode, ) {
    let items = items_getSelected()
    this.clearSelected()
    this.addList(items)
}

TierListMode.prototype._getMode = function(this: TierListMode, ): "general" | "user" | "custom" {
    let modeSelector = this.output.querySelector("#tierlist-mode")
    let custom = dom_getel("#tierlist-custom", this.win.HTMLTextAreaElement, this.output)
    if (custom?.value) {
        return "custom"
    }

    if (!(modeSelector instanceof this.win.HTMLSelectElement)) {
        return "general"
    }

    let mode = modeSelector.value

    if (!(mode === "general" || mode === "user"))
        throw new Error("mode must be `general` or `user`")

    return mode
}

TierListMode.prototype._findInfo = function(this: TierListMode, id: bigint, mode: "general" | "user" | "custom"): [number, string | false] {
    let user = findUserEntryById(id)
    let meta = findMetadataById(id)

    let rating
    if (mode === "general") {
        rating = items_getNormalizedRating(meta)
    } else if (mode === "user") {
        rating = items_normalizeUserRating(user.UserRating, settings_get(user.Uid, "user_rating_max"))
    } else /*custom*/ {
        let customExprEl = dom_getelorthrow("#tierlist-custom", this.win.HTMLTextAreaElement, this.output)
        const expr = customExprEl.value
        let item = findInfoEntryById(id)
        let symbols = makeSymbolsTableFromObj({ ...item, ...meta, ...user, GeneralRating: (meta?.Rating || 0) / (meta?.RatingMax || 1) * 100 })
        let calc = parseExpression(expr, symbols)
        rating = calc.toNum().jsValue
    }

    let tier = settings_tier_from_rating(settings_get(getUserUID(), "tiers"), rating)

    return [rating, tier]
}

TierListMode.prototype.add = function(this: TierListMode, entry: InfoEntry): HTMLElement {
    let mode = this._getMode()
    let [rating, tier] = this._findInfo(entry.ItemId, mode)

    let li = this.win.document.createElement("li")
    const btn = createClickableEntryUI(entry.ItemId)
    btn.title = `${entry.En_Title || entry.Native_Title} - (${rating})`

    li.id = `tier-item-${entry.ItemId}`
    li.append(btn)

    if (!(tier !== false)) {
        throw new Error(`No tier for rating: ${rating}`)
    }

    let ul = this.rows[tier]

    const els = ul.querySelectorAll("li")

    if (els.length === 0) {
        ul.append(li)
    } else {
        for (let el of els) {
            let elId = BigInt(el.id.split("-item-")[1])

            let [elRating, _] = this._findInfo(elId, mode)

            if (rating < elRating) {
                //if rating < elRating, there may be another element that 
                //this new element is closer to in rating, so we can't finish
                //yet
                el.after(li)
            } else {
                el.before(li)
                //if rating >= elRating, and because the <li>s are in order,
                //that means nothing else is greater than it so we can stop
                break
            }
        }
    }

    return li
}

TierListMode.prototype.sub = function(this: TierListMode, entry: InfoEntry, ratingMode: "general" | "user" | "" = ""): boolean {
    let mode = ratingMode || this._getMode()
    let [_, tier] = this._findInfo(entry.ItemId, mode)

    if (!(tier !== false))
        throw new Error("Trying to remove item with an unknown tier")

    const li = this.output.querySelector(`#tier-item-${entry.ItemId}`)

    if (li !== null) {
        li.remove()
        return true
    } else {
        console.warn(`${entry.En_Title}:${entry.ItemId} has not been added to the tierlist, not removing`)
        return false
    }
}

TierListMode.prototype.addList = function(this: TierListMode, entry: InfoEntry[]) {
    for (const item of entry) {
        this.add(item)
    }
}

TierListMode.prototype.subList = function(this: TierListMode, entry: InfoEntry[], ratingMode: "general" | "user" | "" = "") {
    for (const item of entry) {
        this.sub(item, ratingMode)
    }
}

TierListMode.prototype.refresh = function(this: TierListMode, id: bigint) {
    if (this.sub(findInfoEntryById(id)))
        this.add(findInfoEntryById(id))
}

TierListMode.prototype.close = function(this: TierListMode, ) {
    if (this.container)
        this.container.remove()
    else this.output.querySelector("tier-list")?.remove()
    this.clearSelected()
}

TierListMode.prototype.clearSelected = function(this: TierListMode, ) {
    for (let li of this.tierlistEl.querySelectorAll('li')) {
        li.remove()
    }
}

TierListMode.prototype.mkcontainers = function(this: TierListMode, into: HTMLElement | DocumentFragment) {
    const c = this.mkcontainer()
    into.append(c)
    return { container: c, output: dom_getelorthrow(":first-child", null, c) }
}

TierListMode.prototype.mkcontainer = function(this: TierListMode, ): HTMLElement {
    return this.win.document.createElement("tierlist-template")
}

TierListMode.prototype.chwin = function(this: TierListMode, win: Window & typeof globalThis): HTMLElement {
    const container = ModePrimitives.chwin.call(this, win)
    this.output = container.firstElementChild as HTMLElement
    this._setup()
    return container
}
