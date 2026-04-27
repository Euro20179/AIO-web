
class ScriptMode implements Mode {
    NAME = "script-output"
    run: HTMLButtonElement
    scriptBox: HTMLTextAreaElement

    output: HTMLElement | DocumentFragment
    win: Window & typeof globalThis
    container: HTMLElement | null

    constructor(output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        this.win = win ||= window
        let c = null
        if(!output) {
            ({container: c, output} = this.mkcontainers())
        }
        this.output = output
        this.container = c

        this.run = this.win.document.getElementById("script-execute") as HTMLButtonElement
        this.scriptBox = this.win.document.getElementById("script") as HTMLTextAreaElement
        this.scriptBox.onkeydown = (e) => {
            if(e.ctrlKey && e.key === 'Enter') {
                this.run.click()
            }
        }
        this.run.onclick = execute.bind(this)
    }

    mkcontainers() {
        const c = this.mkcontainer()
        const o = getElementOrThrowUI("#viewing-area", null, this.win.document)
        o.append(c)
        return { container: c, output: getElementOrThrowUI('#script-execute-output', null, c) as HTMLDivElement }
    }

    mkcontainer() {
        return document.createElement("script-template")
    }

    close() {
        if(this.container)
            this.container.remove()
    }
    add(entry: InfoEntry) {
        const d = new DisplayMode(this.output, this.win)
        const e = d.add(entry)
        e.style.display = "block"
        return e
    }
    sub(entry: InfoEntry) {
        this.output.querySelector(`[data-item-id="${entry.ItemId}"]`)?.remove()
    }
    addList(entries: InfoEntry[]) {
        for (let e of entries) {
            this.add(e)
        }
    }
    subList(entries: InfoEntry[]) {
        for (let e of entries) {
            this.sub(e)
        }
    }

    clear() {
        mode_clearItems()
        if (this.output instanceof this.win.HTMLElement) {
            this.output.innerHTML = ""
        } else
            while (this.output.children.length) {
                this.output.children[0].remove()
            }
    }

    clearSelected() {
        for (let elem of this.output.querySelectorAll(`[data-item-id]`)) {
            elem.remove()
        }
    }

    chwin(win: Window & typeof globalThis): HTMLElement {
        const container = Mode.prototype.chwin.call(this, win)
        this.run = container.querySelector("#script-execute") as HTMLButtonElement
        this.scriptBox = container.querySelector("#script") as HTMLTextAreaElement
        this.output = container.querySelector("#script-execute-output") as HTMLDivElement
        this.run.onclick = execute.bind(this)
        return container
    }

    put(html: string | HTMLElement | ShadowRoot) {
        if (typeof html === 'string') {
            if (this.output instanceof DocumentFragment) {
                this.output.append(html)
            } else {
                let frag = new DocumentFragment
                frag.append(document.createElement("div"))
                if(frag.firstElementChild) {
                    frag.firstElementChild.innerHTML = html
                    this.output.append(...frag.firstElementChild.childNodes)
                }
            }
        } else {
            this.output.append(html)
        }
    }
}

function execute(this: ScriptMode) {
    let script = this.scriptBox.value

    let tbl = new CalcVarTable()
    tbl.set("results", new Arr(items_getResults().map(v => new EntryTy(v.info))))

    if (getElementOrThrowUI("#script-execute-output-clear", this.win.HTMLInputElement, this.win.document)?.checked) {
        this.clear()
    }

    if (getElementOrThrowUI("#script-js-mode", this.win.HTMLInputElement, this.win.document)?.checked) {
        //put the script within a scope so the user can redeclare vars
        script = `{${script}}`
        let b = new Blob([script], { type: "application/javascript" })
        let scriptEl = document.createElement("script")
        scriptEl.src = URL.createObjectURL(b)
        this.win.document.body.append(scriptEl)
        scriptEl.remove()
        URL.revokeObjectURL(scriptEl.src)
        return
    }

    const value = parseExpression(script, tbl)
    if (value instanceof Elem) {
        this.output.append(value.el)
    } else {
        this.output.append(value.jsStr())
    }
}
