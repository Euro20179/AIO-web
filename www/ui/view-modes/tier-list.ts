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

function TierListMode(this: TierListMode, output?: HTMLElement | DocumentFragment, win ?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)
    this.rows = {}

    this._setup()
}

TierListMode.prototype._setup = function(this: TierListMode, ) {
    const tierListStyles = settings_get("tierlist_styles")

    let modeSelector = this.output.querySelector("#tierlist-mode")
    let customExpr = this.output.querySelector("#tierlist-custom")

    if (modeSelector instanceof this.win.HTMLSelectElement) {
        this.previousMode = modeSelector.value
        modeSelector.onchange = this._modeSelector.bind(this)
    }

    if (customExpr instanceof this.win.HTMLTextAreaElement) {
        customExpr.oninput = this._customExpr.bind(this)
    }

    this.tierlistEl = this.output.querySelector("tier-list") || document.createElement("tier-list")
    while (this.tierlistEl.childNodes.length) {
        this.tierlistEl.firstChild?.remove()
    }

    const style = document.createElement("style")
    this.tierlistEl.append(style)

    for (let tier of settings_get("tiers")) {
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
    let custom = getElementUI("#tierlist-custom", this.win.HTMLTextAreaElement, this.output)
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
        rating = user.UserRating
    } else /*custom*/ {
        let customExprEl = getElementOrThrowUI("#tierlist-custom", this.win.HTMLTextAreaElement, this.output)
        const expr = customExprEl.value
        let item = findInfoEntryById(id)
        let symbols = makeSymbolsTableFromObj({ ...item, ...meta, ...user, GeneralRating: (meta?.Rating || 0) / (meta?.RatingMax || 1) * 100 })
        let calc = parseExpression(expr, symbols)
        rating = calc.toNum().jsValue
    }

    let tier = settings_tier_from_rating(rating)

    return [rating, tier]
}

TierListMode.prototype.add = function(this: TierListMode, entry: InfoEntry): HTMLElement {
    let thumb = fixThumbnailURL(findMetadataById(entry.ItemId).Thumbnail)

    let mode = this._getMode()
    let [rating, tier] = this._findInfo(entry.ItemId, mode)

    let li = this.win.document.createElement("li")
    let img = this.win.document.createElement("img")
    img.src = thumb
    img.alt = entry.En_Title || entry.Native_Title
    img.title = `${img.alt} - ${rating}`
    img.style.cursor = "pointer"
    img.onclick = () => {
        const id = BigInt(img.parentElement?.id.split("-")[2] || "0")
        if (!id) return
        openDisplayWinUI(id)
    }

    li.id = `tier-item-${entry.ItemId}`
    li.append(img)

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
    else this.clearSelected()
    this.clearSelected()
}

TierListMode.prototype.clearSelected = function(this: TierListMode, ) {
    for (let li of this.tierlistEl.querySelectorAll('li')) {
        li.remove()
    }
}

TierListMode.prototype.mkcontainers = function(this: TierListMode, into: HTMLElement) {
    const c = this.mkcontainer()
    into.append(c)
    return { container: c, output: getElementOrThrowUI(":first-child", null, c) }
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

