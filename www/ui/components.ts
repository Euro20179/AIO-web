function fillElement(root: HTMLElement | ShadowRoot, selector: string, text: string, fillmode: "append" | "innerhtml" | `attribute=${string}` = "append") {
    let elem = /**@type {HTMLElement}*/(root.querySelector(selector))
    if (!elem) {
        return
    }
    if (fillmode === "append") {
        elem.textContent = text
    } else if (fillmode.match(/attribute=.+/)) {
        let attribute = fillmode.split("=")[1]
        elem.setAttribute(attribute, text)
    } else {
        elem.innerHTML = text
    }
}

function applyUserRating(rating: number, root: HTMLElement) {

    const tierSettings = settings_get("tiers")

    for (const [name, _] of tierSettings) {
        root.classList.remove(`${name}-tier`)
    }

    for (let [name, minRating, tierName] of tierSettings) {
        if (
            (typeof minRating === 'function' && minRating(rating))
            || (typeof minRating === 'number' && rating >= minRating)
        ) {
            tierName ||= `${name}-tier`
            root.classList.add(String(tierName))
            break
        }
    }
}

customElements.define("display-entry", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = document.getElementById("display-entry") as HTMLTemplateElement
        let content = template.content.cloneNode(true) as HTMLElement
        let root = this.attachShadow({ mode: "open" })
        root.appendChild(content)
        this.root = root
    }
})

const sidebarStyles = new CSSStyleSheet
//gets replaced with colors.css, general.css, sidebar-entry.css in that order
//the math.random is so that the build system doesn't inline this text, i need the ``
//the reason i am doing this is because sharing the css styles like this triples the speed at which the sidebar can render
sidebarStyles.replace(`{{{_BUILDTIME_REPLACE_}}}${Math.random()}`)
customElements.define("sidebar-entry", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = (document.getElementById("sidebar-entry")) as HTMLTemplateElement
        let content = template.content.cloneNode(true) as HTMLElement
        let root = this.attachShadow({ mode: "open" })
        root.appendChild(content)
        root.adoptedStyleSheets.push(sidebarStyles)
        this.root = root

    }
})

customElements.define("entries-statistic", class extends HTMLElement {
    static observedAttributes = ["data-value"]

    attributeChangedCallback(name: string, ov: string, nv: string) {
        if (name != "data-value") return
        this.innerText = String(Math.round(Number(nv) * 100) / 100)
    }
})

customElements.define("calc-entry", class extends HTMLElement {
    static observedAttributes = ["data-expression-output"]
    root: ShadowRoot

    constructor() {
        super()
        let template = document.getElementById("calc-entry") as HTMLTemplateElement
        let content = template.content.cloneNode(true)
        let root = this.attachShadow({ mode: "open" })
        root.appendChild(content)
        this.root = root

    }

    attributeChangedCallback(name: string, ov: string, nv: string) {
        if (name !== "data-expression-output") return

        let el = this.root.getElementById("expression-output")
        if (!el) return
        el.innerHTML = nv
    }
})
