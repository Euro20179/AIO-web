
class ScriptMode extends Mode {
    NAME = "script-output"
    run: HTMLButtonElement
    scriptBox: HTMLTextAreaElement
    constructor(parent?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        super(parent || "#script-execute-output", win)
        this.run = document.getElementById("script-execute") as HTMLButtonElement
        this.scriptBox = document.getElementById("script") as HTMLTextAreaElement
        this.win.document.getElementById("script-output")?.classList.add("open")
        this.run.onclick = execute.bind(this)
    }
    close() {
        this.win.document.getElementById("script-output")?.classList.remove("open")
    }
    add(entry: InfoEntry) {
        const d = new DisplayMode(this.parent, this.win)
        const e = d.add(entry)
        e.style.display = "block"
        return e
    }
    sub(entry: InfoEntry) {
        this.parent.querySelector(`[data-item-id="${entry.ItemId}"]`)?.remove()
    }
    addList(entries: InfoEntry[]) {
        for (let e of entries) {
            this.sub(e)
        }
    }
    subList(entries: InfoEntry[]) {
        for (let e of entries) {
            this.sub(e)
        }
    }

    clear() {
        clearItems()
        if (this.parent instanceof HTMLElement) {
            this.parent.innerHTML = ""
        } else
            while (this.parent.children.length) {
                this.parent.children[0].remove()
            }
    }

    clearSelected() {
        for (let elem of this.parent.querySelectorAll(`[data-item-id]`)) {
            elem.remove()
        }
    }

    chwin(win: Window & typeof globalThis) {
        this.win.close()
        this.run = win.document.getElementById("script-execute") as HTMLButtonElement
        this.scriptBox = win.document.getElementById("script") as HTMLTextAreaElement
        this.parent = win.document.getElementById("script-execute-output") as HTMLDivElement
        this.run.onclick = execute.bind(this)
    }

    put(html: string | HTMLElement | ShadowRoot) {
        if (typeof html === 'string') {
            if (this.parent instanceof DocumentFragment) {
                this.parent.append(html)
            } else {
                this.parent.innerHTML += html
            }
        } else {
            this.parent.append(html)
        }
    }
}

function execute(this: ScriptMode) {
    let script = this.scriptBox.value

    let tbl = new CalcVarTable()
    tbl.set("results", new Arr(items_getResults().map(v => new EntryTy(v.info))))

    //@ts-ignore
    if (document.getElementById("script-execute-output-clear")?.checked) {
        this.clear()
    }

    //@ts-ignore
    if (document.getElementById("script-js-mode")?.checked) {
        //put the script within a scope so the user can redeclare vars
        script = `{${script}}`
        let b = new Blob([script], { type: "application/javascript" })
        let scriptEl = document.createElement("script")
        scriptEl.src = URL.createObjectURL(b)
        document.body.append(scriptEl)
        scriptEl.remove()
        URL.revokeObjectURL(scriptEl.src)
        return
    }

    const value = parseExpression(script, tbl)
    if (value instanceof Elem) {
        this.parent.append(value.el)
    } else {
        this.parent.append(value.jsStr())
    }
}
