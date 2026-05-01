const generalStyles: CSSStyleSheet[] = [];
const sidebarStyles: CSSStyleSheet[] = [];

function mkGenericTbl(root: HTMLElement, data: Record<any, any>) {
    const tbl = document.createElement("table")
    const thead = tbl.createTHead()
    const hr = thead.insertRow()
    hr.innerHTML = `<th>Name <th> Value`
    const tbody = tbl.createTBody()
    for (let key in data) {
        const tr = tbody.insertRow()
        const ktd = tr.insertCell()
        ktd.innerText = key
        const vtd = tr.insertCell()
        vtd.innerText = data[key]
    }
    root.innerHTML = tbl.outerHTML
}

/**
    * Firefox has a bug where a select rendered out of a template
    * does not render the dropdown arrow.
    * This function fixes that by cloning and rerendering all select elements
    * within a root.
*/
function fuckingInsaneFirefoxHackToMakeSelectAppearNormally(
    root: ShadowRoot | HTMLElement | DocumentFragment
) {
    for (let sel of root.querySelectorAll("select")) {
        const newSel = sel.cloneNode(true) as HTMLSelectElement
        newSel.value = sel.value
        sel.replaceWith(newSel)
    }
}
/**
 * Sets up popover=hint elements
 */
function setupHintPopovers(root: {
    querySelectorAll: (selector: string) => NodeListOf<Element>,
    querySelector: (selector: string) => Element
}) {
    for (let el of root.querySelectorAll("[toggle-hint]")) {
        const e = el as HTMLElement
        const toToggle = (el.getAttribute("toggle-hint") ?
            root.querySelector(`#${el.getAttribute("toggle-hint")}`)
            : el.querySelector('[popover="hint"]')) as HTMLElement
        e.onfocus = e.onmouseenter = function() {
            toToggle.showPopover({ source: this })
        }

        e.onblur = e.onmouseleave = function() {
            toToggle.hidePopover()
        }
    }
}

/**
 * @description updates all put-data elements with their respective contents
 */
function updateDeclarativeDSL(actions: Record<string, (target: HTMLElement, event: Event) => any>, item: InfoEntry, user: UserEntry, meta: MetadataEntry, root: ShadowRoot | Document | DocumentFragment) {
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

            const putDataMode = elem.getAttribute("put-data-mode")
            if (putDataMode === "html") {
                elem.innerHTML = String(data)
            } else if (putDataMode === "value" && "value" in elem) {
                elem.value = String(data)
            } else {
                elem.textContent = String(data)
                // elem.append(String(data))
            }
            break
        }
    }

    for (let actionEl of root.querySelectorAll("[entry-action]")) {
        let events = (actionEl.getAttribute("entry-action-trigger") || "click")
            .split(",").map(v => v.trim())
        let requested_acitons =
            (actionEl.getAttribute("entry-action") as keyof typeof actions)
                .split(",").map(v => v.trim())
        for (let i = 0; i < requested_acitons.length; i++) {
            let actionFn = actions[requested_acitons[i] as keyof typeof actions];
            if (!actionFn) {
                console.error(`Failed to register event: ${actions[i]}`)
                continue
            }
            //@ts-ignore
            actionEl[`on${events[i % events.length]}`] = e => {
                actionFn(e.target as HTMLElement, e)
            }
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


    setupHintPopovers(root)

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
                res = new Function("root", "results", script).bind(item)(root, items_getResults().map(v => v.info), item)
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

        fuckingInsaneFirefoxHackToMakeSelectAppearNormally(root)
        this.root = root
    }
})

const labelWrap = async<TLabel, T>(label: TLabel, promise: Promise<T>): Promise<[TLabel, T]> => {
    return [label, await promise]
}

//gets replaced with colors.css, general.css, sidebar-entry.css in that order
//the math.random is so that the build system doesn't inline this text, i need the ``
//the reason i am doing this is because sharing the css styles like this triples the speed at which the sidebar can render
Promise.all([
    labelWrap(generalStyles, import("/css/colors.css", { with: { type: "css" } })),
    labelWrap(generalStyles, import("/css/general.css", { with: { type: "css" } })),
    labelWrap(sidebarStyles, import("/ui/templates/sidebar-entry.css", { with: { type: "css" } })),
]).then(sheets => {
    for(let [list, sheet] of sheets) {
        list.push(sheet['default'])
    }
}).catch(err => {
    (new CSSStyleSheet).replace(`{{{_BUILDTIME_REPLACE_}}}${Math.random()}`).then((res) => {
        sidebarStyles.push(res)
    })
});
customElements.define("sidebar-entry", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = (document.getElementById("sidebar-entry")) as HTMLTemplateElement
        let content = template.content.cloneNode(true) as HTMLElement
        let root = this.attachShadow({ mode: "open" })
        root.appendChild(content)
        root.adoptedStyleSheets.push(...generalStyles, ...sidebarStyles)
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
            if (!this.templ) {
                console.error(`Attempting to use <${this.name}> despite coenciding template not existing`)
                return
            }

            //no need to replace children, they're already there
            if(this.innerHTML) return

            let content = this.templ.content.cloneNode(true)
            //this should be replaceContent because
            //any time this element moves or smth
            //this callback gets called again, and if we use append()
            //it will append twice
            this.replaceChildren(content)

            fuckingInsaneFirefoxHackToMakeSelectAppearNormally(this)

            this.style.display ||= "contents"
        }
    })
}

const component_templates = [
    "de-status-menu",
    "de-cost-calculation-modifiers",
    "de-notes",
    "de-description",
    "de-requirements",
    "de-descendants",
    "de-copies",
    "de-template-editor",
    "de-recommender",
    "de-progress",

    "calendar-template",
    "event-template",
    "tierlist-template",
    "calc-template",
    "script-template",
    "graph-template",

    "prompt-dialog",
    "confirm-dialog",
    "new-entry-dialog",
    "new-event-dialog",
    "login-dialog",
    "alert-box",
    "tz-datalist",
    "color-scheme-selector",
    "close-button"
]

for (const name of component_templates) {
    _registerElement(name)
}
