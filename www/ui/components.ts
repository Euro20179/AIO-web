const generalStyles: CSSStyleSheet[] = [];
const sidebarStyles: CSSStyleSheet[] = [];
const displayEntryStyles: CSSStyleSheet[] = []

const labelWrap = async<TLabel, T>(label: TLabel, promise: Promise<T>): Promise<[TLabel, T]> => {
    return [label, await promise]
}


type Primitive = string | number | boolean | null | undefined | bigint
let _component_render_cache = new Map<HTMLElement | ShadowRoot | Document,
                                        Map<string, Primitive[] | number>>
/**
 * Given a root, and list of dependencies, render a component
 * if all dependencies have not changed, fill does not get called
 * @param {HTMLElement | ShadowRoot | Document} root
 * @param {string} query a css query selector
 * @param {(el: HTMLElement, itemId: bigint) => any} fill the function that renders the component
 * @param {any[]} dependencies a list of values that this component relies on
 */
function component_render(
    root: HTMLElement | ShadowRoot | Document,
    query: string,
    fill: (el: HTMLElement) => any,
    dependencies: Primitive[] | number
) {
    let rcache = _component_render_cache.getOrInsert(root, new Map)
    let cache = rcache.getOrInsert(query, typeof dependencies === 'number' ? dependencies : [])

    if (typeof cache === 'number'  && cache < 1) {
        return
    }
    // if they are not the same length, dependencies have by definition updated
    if (!(typeof cache === 'number') && (dependencies as Primitive[]).length === cache.length) {
        let allgood = true
        for(let i = 0; i < cache.length; i++) {
            if ((dependencies as Primitive[])[i] != cache[i]) {
                allgood = false
            }
        }
        if (allgood) return
    }

    if (typeof cache === 'number') {
        cache--
        rcache.set(query, cache)
    } else {
        rcache.set(query, dependencies)
    }

    for(let l of root.querySelectorAll(query)) {
        fill(l as HTMLElement)
    }
}



//gets replaced with colors.css, general.css, sidebar-entry.css in that order
//the math.random is so that the build system doesn't inline this text, i need the ``
//the reason i am doing this is because sharing the css styles like this triples the speed at which the sidebar can render
Promise.all([
    labelWrap(generalStyles, import("/css/colors.css", { with: { type: "css" } })),
    labelWrap(generalStyles, import("/css/general.css", { with: { type: "css" } })),
    labelWrap(sidebarStyles, import("/ui/templates/sidebar-entry.css", { with: { type: "css" } })),
    labelWrap(displayEntryStyles, import("/ui/templates/display-entry.css", { with: { type: "css" }})),
]).then(sheets => {
    for(let [list, sheet] of sheets) {
        list.push(sheet['default'])
    }
}).catch(err => {
    (new CSSStyleSheet).replace(`{{{_BUILDTIME_REPLACE_}}}${Math.random()}`).then((res) => {
        sidebarStyles.push(res)
    })
});

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

function component_renderList(root: HTMLElement, list: string[], onclick?: (e: Event, tag: string) => any) {
    root.querySelectorAll("li.tag").forEach(li => li.remove())

    for(let tag of list) {
        if (!tag) continue

        let li = document.createElement("li")
        if (onclick)
            li.role = "button"
        li.classList.add("tag")
        li.id = "tag-name"
        li.tabIndex = 0
        li.innerHTML = `
            <button class="delete" id="delete-tag" entry-action="deletetag">x</button>
        `
        const del = dom_getelorthrow("#delete-tag", null, li)
        del.setAttribute("tag-name", tag)
        li.prepend(tag)

        if (onclick) {
            li.onclick = e => onclick(e, tag)
        }

        root.append(li)
    }
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
async function updateDeclarativeDSL(actions: Record<string, (target: HTMLElement, event: Event) => any>, enable_unsafe: boolean, item: InfoEntry, user: UserEntry, meta: MetadataEntry, root: ShadowRoot | Document | DocumentFragment) {
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
                if(!enable_unsafe && "dom_sanitizehtml" in window) {
                    dom_sanitizehtml(String(data), elem)
                } else if(!enable_unsafe) {
                    elem.textContent = String(data)
                } else {
                    elem.innerHTML = String(data)
                }
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
                console.warn(`Failed to register event: ${actions[i]}`)
                continue
            }
            //@ts-ignore
            actionEl[`on${events[i % events.length]}`] = e => {
                actionFn(e.currentTarget as HTMLElement, e)
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

    if (enable_unsafe)
        for (let elem of root.querySelectorAll("script")) {
            let script = elem.textContent
            if (!script) continue

            let res: string | Type

            if (elem.getAttribute("type") === "application/x-aiol") {
                let symbols = new CalcVarTable()
                symbols.set("root", new Elem(root as unknown as HTMLElement))
                symbols.set("results", new Arr(items_getResults().map(v => new EntryTy(v.info))))
                symbols.set("this", new EntryTy(item))
                res = await parseExpression(script, symbols)
            } else {
                //@ts-ignore
                res = await new ((async function(){}).constructor)("root", "results", script).bind(item)(root, items_getResults().map(v => v.info), item)
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

customElements.define("display-entry", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = document.getElementById("display-entry") as HTMLTemplateElement
        let content = template.content.cloneNode(true) as HTMLElement
        let root = this.attachShadow({ mode: "open", clonable: true })
        root.appendChild(content)

        if(generalStyles.length) {
            root.adoptedStyleSheets.push(...generalStyles)
        }
        if(displayEntryStyles.length) {
            root.adoptedStyleSheets.push(...displayEntryStyles)
        }

        fuckingInsaneFirefoxHackToMakeSelectAppearNormally(root)
        this.root = root
    }
})

customElements.define("sidebar-entry", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = (document.getElementById("sidebar-entry")) as HTMLTemplateElement
        let content = template.content.cloneNode(true) as HTMLElement
        let root = this.attachShadow({ mode: "open", clonable: true })
        root.appendChild(content)
        root.adoptedStyleSheets.push(...generalStyles, ...sidebarStyles)
        this.root = root
    }

    connectedCallback() {
        let entry = items_getEntry(BigInt(this.getAttribute("data-entry-id") || "0"))
        if(entry)
            updateDeclarativeDSL({}, false, entry.info, entry.user, entry.meta, this.root) 
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
        let root = this.attachShadow({ mode: "open", clonable: true })
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

function _registerShadowElement(name: string) {
    customElements.define(name, class extends HTMLElement {
        root: ShadowRoot
        constructor() {
            super()
            let template = document.getElementById(name) as HTMLTemplateElement
            let content = template.content.cloneNode(true)
            let root = this.attachShadow({ mode: "open", clonable: true })
            if(generalStyles.length) {
                root.adoptedStyleSheets.push(...generalStyles)
            }
            root.appendChild(content)
            this.root = root
        }
    })
}

customElements.define("menu-screen", class extends HTMLElement {
    root: ShadowRoot
    constructor() {
        super()
        let template = document.getElementById("menu-template") as HTMLTemplateElement
        let content = template.content.cloneNode(true)
        let root = this.attachShadow({ mode: "open", clonable: true })
        if(generalStyles.length) {
            root.adoptedStyleSheets.push(...generalStyles)
        }
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

    "calendar-template",
    "event-template",
    "tierlist-template",
    "calc-template",
    "script-template",
    "graph-template",

    "format-modifier-popover",
    "art-styles-popover",

    "alert-box",
    "tz-datalist",
    "color-scheme-selector",
    "close-button",
]

for (const name of component_templates) {
    _registerElement(name)
}

const component_shadow_templates = [
    /* general purpose */
    "prompt-dialog",
    "confirm-dialog",
    "login-dialog",

    /* outputs/modes */
    "gallery-entry",
    "metadata-item",

    /* specific dialogs */
    "edit-transaction",
    "new-event-dialog",
    "item-identification-form-dialog",
    "new-entry-dialog",
    "format-modifier-menu",

    /* general purpose item components */
    "item-card",
    "de-progress",
]

for(let name of component_shadow_templates) {
    _registerShadowElement(name)
}
