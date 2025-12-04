function applyUserRating(rating: number, root: HTMLElement) {

    const tierSettings = settings_get("tiers")

    for (const [name, _] of tierSettings) {
        root.classList.remove(`${name}-tier`)
    }

    let tier = settings_tier_from_rating(rating)
    root.classList.add(`${tier}-tier`)
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

    focus() {
        this.root.querySelector("button")?.focus()
    }

    click() {
        this.root.querySelector("button")?.click()
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

customElements.define("gallery-entry", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = document.getElementById("gallery-entry") as HTMLTemplateElement
        let content = template.content.cloneNode(true)
        let root = this.attachShadow({ mode: "open" })
        root.appendChild(content)
        this.root = root
    }
})

function _registerElement(name: string) {
    customElements.define(name, class extends HTMLElement {
        templ?: HTMLTemplateElement
        name: string = name
        constructor() {
            super()
            let templ = document.getElementById(name)
            //we may want to register these on different places
            //so that we can reuse templates
            if (!(templ instanceof HTMLTemplateElement)) {
                console.warn(`${name} is not a template`)
                return
            }

            this.templ = templ
        }

        connectedCallback() {
            if(!this.templ) {
                console.error(`Attempting to use <${this.name}> despite coenciding template not existing`)
                return
            }

            let content = this.templ.content.cloneNode(true)
            this.replaceChildren(content)
            this.style.display = "contents"
        }
    })
}

for (const name of [
    "de-status-menu",
    "de-cost-calculation-modifiers",
    "de-notes",
    "de-description",
    "de-requirements",
    "de-descendants",
    "de-copies",
    "de-template-editor",

    "calendar-template",
    "event-template",
    "tierlist-template",
    "calc-template",
    "script-template",
    "graph-template",

    "prompt-dialog",
    "new-entry-dialog",
    "new-event-dialog",
    "login-dialog",
    "alert-box",
    "tz-datalist",
]) {
    _registerElement(name)
}
