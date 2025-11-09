class TierListMode extends Mode {
    NAME = "tierlist-output"

    rows: Record<string, HTMLUListElement>

    constructor(parent?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        super(parent || "#tierlist-output", win)
        this.win.document.getElementById("tierlist-output")?.classList.add("open")

        this.rows = {}


        const tierListStyles = settings_get("tierlist_styles")
        
        while(this.parent.childNodes.length) {
            this.parent.firstChild?.remove()
        }

        const style = document.createElement("style")
        this.parent.append(style)

        for (let tier of settings_get("tiers")) {
            const ul = document.createElement("ul")
            const label = document.createElement("tier-label")

            const thisTierStyles = tierListStyles[tier[0] as keyof typeof tierListStyles] || ""

            style.innerText += `#tierlist-output .${tier[0]}-tier { ${thisTierStyles} }`

            label.innerText = tier[0]
            ul.append(label)
            ul.classList.add(`${tier[0]}-tier`)
            this.rows[tier[0]] = ul
            this.parent.append(ul)
        }

    }

    add(entry: InfoEntry): HTMLElement {
        let rating = findUserEntryById(entry.ItemId)
        let thumb = fixThumbnailURL(findMetadataById(entry.ItemId).Thumbnail)

        let tier = settings_tier_from_rating(rating.UserRating)

        let li = document.createElement("li")
        let img = document.createElement("img")
        img.src = thumb
        img.alt = entry.En_Title || entry.Native_Title

        li.id = `tier-item-${entry.ItemId}`
        li.append(img)

        if (!(tier !== false)) throw new Error(`No tier for rating: ${rating.UserRating}`)

        let ul = this.rows[tier]

        ul.appendChild(li)

        return li
    }

    sub(entry: InfoEntry) {
        let rating = findUserEntryById(entry.ItemId)
        let tier = settings_tier_from_rating(rating.UserRating)

        if (!(tier !== false))
            throw new Error("Trying to remove item with an unknown tier")

        let ul = this.rows[tier]

        const li = ul.querySelector(`#tier-item-${entry.ItemId}`)

        if (!(li !== null))
            throw new Error(`Item: ${entry.ItemId} has not been added to the tier list`)

        li.remove()
    }

    addList(entry: InfoEntry[]) {
        for(const item of entry) {
            this.add(item)
        }
    }

    subList(entry: InfoEntry[]) {
        for(const item of entry) {
            this.sub(item)
        }
    }

    close() {
        this.win.document.getElementById("tierlist-output")?.classList.remove("open")
        this.clearSelected()
    }

    clearSelected() {
        for(let li of this.parent.querySelectorAll('li')) {
            li.remove()
        }
    }
}
