type CategoriesMode = {
    mkItemCard(this: CategoriesMode, item: InfoEntry): HTMLElement
    setupSlide(this: CategoriesMode, name: string): HTMLElement
    categorizeSelectors: HTMLSelectElement[]
    newCategorizerSelector: HTMLButtonElement
    slides: Map<string, HTMLElement>
} & Mode

var CategoriesMode: ModeConstructor<CategoriesMode> = function(this: CategoriesMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    this.slides = new Map
    ModePrimitives.setup.call(this, output, win)
    this.categorizeSelectors = [this.output.querySelector("#categorize-by")!]
    this.newCategorizerSelector = this.output.querySelector("#another-category")!
    this.newCategorizerSelector.onclick = (e) => {
        let el = this.categorizeSelectors[0].cloneNode(true) as HTMLSelectElement
        el.oncontextmenu = (e) => {
            e.preventDefault();
            el.remove();
        }
        this.categorizeSelectors[0].insertAdjacentElement(
            'afterend',
            el
        )
        el.onchange = () => {
            this.clearSelected()
            this.addList(items_getSelected())
        }
        this.categorizeSelectors.push(el)
    }
    this.categorizeSelectors[0].onchange = () => {
        this.clearSelected()
        this.addList(items_getSelected())
    }
} as any

CategoriesMode.prototype.mkcontainers = function(this: GalleryMode, into: HTMLElement | DocumentFragment) {
    const c = this.mkcontainer()
    into.append(c)
    const shadow = dom_getelorthrow("menu-screen", null, c).shadowRoot 
    if(!shadow) {
        throw new Error("Expected shadow root in menu screen")
    }
    return { container: c, output: shadow }
}

CategoriesMode.prototype.mkcontainer = function(this: CategoriesMode ) {
    const c = document.createElement("div")
    const screen = this.win.document.createElement("menu-screen")
    c.append(screen)
    c.id = 'menu-output'
    c.classList.add("overflow")

    return c
}

CategoriesMode.prototype.setupSlide = function(this: CategoriesMode, name: string): HTMLElement {
    const slide = this.win.document.createElement("section")
    this.slides.set(name, slide)

    const slideTitle = document.createElement("h3")
    slideTitle.innerText = name
    slide.append(slideTitle)

    slide.append(document.createElement("div"))

    slide.append(document.createElement("p"))

    this.output.append(slide)

    return slide
}

CategoriesMode.prototype.mkItemCard = function(this: CategoriesMode, item: InfoEntry) {
    const card = mkItemCardUI(item.ItemId)
    return card
}

CategoriesMode.prototype.refresh = function(this: CategoriesMode, id: bigint) {
    const card = dom_getel(`[data-item-id="${id}"]`, null, this.output)
    if(!card) return
    card.replaceWith(this.mkItemCard(findInfoEntryById(id)))
}

CategoriesMode.prototype.add = function(this: CategoriesMode, item: InfoEntry) {
    let categories: (string | string[])[] = []
    const addCategory = (c: string | string[]) => {
        categories.push(c)
    }
    for(let categorizeBy of this.categorizeSelectors) {
        switch(categorizeBy.value) {
            case "Uid":
                addCategory(uid2username(item.Uid))
                break
            case "Type":
                addCategory(item.Type)
                break
            case "Format":
                addCategory(items_formatToName(item.Format))
                break
            case "Tag":
                if(item.Tags)
                    addCategory(item.Tags)
                break
            case "Genre": {
                const genres = findMetadataById(item.ItemId).Genres
                if(genres) {
                    addCategory(JSON.parse(genres))
                }
                break
            }
        }
    }

    let toreturn

    let strs = []

    let baseStr = categories.filter(v => typeof v === 'string').join(" ")
    let arrs = categories.filter(v => Array.isArray(v)).sort((a, b) => b.length - a.length)
    if(arrs.length) {
        for(let item of arrs[0]) {
            strs.push(baseStr + " " + item)
        }
        for(let arr of arrs.slice(1)) {
            for(let item of arr) {
                for(let j = 0; j < strs.length; j++) {
                    strs[j] += " " + item
                }
            }
        }
    } else {
        strs.push(baseStr)
    }

    for (let k of strs) {
        const slide = (this.slides.get(k) || this.setupSlide(k)).querySelector("div")!

        toreturn = this.mkItemCard(item)
        slide.append(toreturn)
    }

    return toreturn
}

CategoriesMode.prototype.addList = function(this: CategoriesMode, entries: InfoEntry[]) {
    for(let entry of entries) {
        this.add(entry)
    }
}

CategoriesMode.prototype.sub = function(this: CategoriesMode, entry: InfoEntry) {
    const el = dom_getel(`item-card[data-item-id="${entry.ItemId}"]`, null, this.output)
    console.log(el)
    if(!el) return
    el.remove()
}

CategoriesMode.prototype.subList = function(this: CategoriesMode, entries: InfoEntry[]) {
    for(let entry of entries) {
        this.sub(entry)
    }
}

CategoriesMode.prototype.clearSelected = function(this: CategoriesMode) {
    for(let slide of this.slides.values()) {
        slide.remove()
    }
    this.slides = new Map
}

CategoriesMode.prototype.close = function(this: CategoriesMode) {
    if(this.container)
        this.container.remove()
    this.clearSelected()
}
