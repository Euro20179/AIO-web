class TierListMode extends Mode {
    NAME = "tierlist-output"

    rows: Record<string, HTMLUListElement>

    tierlistEl: HTMLElement

    previousMode = ""

    constructor(parent?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        super(parent || "#tierlist-output", win)
        this.win.document.getElementById("tierlist-output")?.classList.add("open")

        this.rows = {}

        let temp = this.parent.querySelector("tier-list")

        if (!(temp instanceof HTMLElement))
            throw new Error("Could not find the tierlist output HTMLElement")

        let modeSelector = this.parent.querySelector("#tierlist-mode")

        if (modeSelector instanceof HTMLSelectElement) {
            this.previousMode = modeSelector.value

            modeSelector.onchange = () => {
                let items = items_getSelected()
                this.clearSelected()
                this.addList(items)

                this.previousMode = modeSelector.value
            }
        }

        this.tierlistEl = temp

        const tierListStyles = settings_get("tierlist_styles")

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

    _getMode(): "general" | "user" {
        let modeSelector = this.parent.querySelector("#tierlist-mode")

        if (!(modeSelector instanceof HTMLSelectElement))
            throw new Error("mode selector could not be found")

        let mode = modeSelector.value

        if (!(mode === "general" || mode === "user"))
            throw new Error("mode must be `general` or `user`")

        return mode
    }

    _findInfo(id: bigint, mode: "general" | "user"): [number, string | false] {
        let user = findUserEntryById(id)
        let meta = findMetadataById(id)

        let rating = (
            mode === "general"
                ? items_getNormalizedRating(meta)
                : user.UserRating
        ) || 0

        let tier = settings_tier_from_rating(rating)

        return [rating, tier]
    }

    add(entry: InfoEntry): HTMLElement {
        let thumb = fixThumbnailURL(findMetadataById(entry.ItemId).Thumbnail)

        let mode = this._getMode()
        let [rating, tier] = this._findInfo(entry.ItemId, mode)

        let li = document.createElement("li")
        let img = document.createElement("img")
        img.src = thumb
        img.alt = entry.En_Title || entry.Native_Title
        img.title = `${img.alt} - ${rating}`

        li.id = `tier-item-${entry.ItemId}`
        li.append(img)

        if (!(tier !== false)) throw new Error(`No tier for rating: ${rating}`)

        let ul = this.rows[tier]

        const els = ul.querySelectorAll("li")


        if (els.length === 0) {
            ul.append(li)
        } else {
            for (let el of els) {
                let elId = BigInt(el.id.split("-item-")[1])
                let elRating

                if (mode === "user") {
                    elRating = findUserEntryById(elId).UserRating
                } else {
                    let meta = findMetadataById(elId)
                    elRating = items_getNormalizedRating(meta)
                }

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

    sub(entry: InfoEntry, ratingMode: "general" | "user" | "" = "") {
        let mode = ratingMode || this._getMode()
        let [_, tier] = this._findInfo(entry.ItemId, mode)

        if (!(tier !== false))
            throw new Error("Trying to remove item with an unknown tier")

        let ul = this.rows[tier]

        const li = ul.querySelector(`#tier-item-${entry.ItemId}`)

        if (li !== null) {
            li.remove()
        } else {
            console.warn(`${entry.En_Title}:${entry.ItemId} has not been added to the tierlist, not removing`)
        }
    }

    addList(entry: InfoEntry[]) {
        for (const item of entry) {
            this.add(item)
        }
    }

    subList(entry: InfoEntry[], ratingMode: "general" | "user" | "" = "") {
        for (const item of entry) {
            this.sub(item, ratingMode)
        }
    }

    close() {
        this.win.document.getElementById("tierlist-output")?.classList.remove("open")
        this.clearSelected()
    }

    clearSelected() {
        for (let li of this.tierlistEl.querySelectorAll('li')) {
            li.remove()
        }
    }
}
