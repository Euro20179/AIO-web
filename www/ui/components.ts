function fillElement(root: HTMLElement | ShadowRoot , selector: string, text: string, fillmode: "append" | "innerhtml" | `attribute=${string}` = "append") {
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
    for(const tier of ["splus", "s", "a", "b", "c", "d", "f", "z"]) {
        root.classList.remove(`${tier}-tier`)
    }
    if (rating > 100) {
        root.classList.add("splus-tier")
    } else if (rating > 96) {
        root.classList.add("s-tier")
    } else if (rating > 87) {
        root.classList.add("a-tier")
    } else if (rating > 78) {
        root.classList.add("b-tier")
    } else if (rating > 70) {
        root.classList.add("c-tier")
    } else if (rating > 65) {
        root.classList.add("d-tier")
    } else if (rating > 0) {
        root.classList.add('f-tier')
    } else {
        root.classList.add("z-tier")
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

customElements.define("sidebar-entry", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = (document.getElementById("sidebar-entry")) as HTMLTemplateElement
        let content = template.content.cloneNode(true) as HTMLElement
        let root = this.attachShadow({ mode: "open" })
        root.appendChild(content)
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
