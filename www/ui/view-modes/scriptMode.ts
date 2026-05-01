type ScriptMode = {
    run: HTMLButtonElement
    scriptBox: HTMLTextAreaElement

    renderedModes: Map<string, Mode>

    clear(): any
} & Mode

function ScriptMode(this: ScriptMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)

    this.renderedModes = new Map

    this.run = this.win.document.getElementById("script-execute") as HTMLButtonElement
    this.scriptBox = this.win.document.getElementById("script") as HTMLTextAreaElement
    this.scriptBox.onkeydown = (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            this.run.click()
        }
    }
    this.run.onclick = execute.bind(this)
}

ScriptMode.prototype.mkcontainers = function(this: ScriptMode, into: HTMLElement | DocumentFragment) {
    const c = this.mkcontainer()
    into.append(c)
    return { container: c, output: getElementOrThrow('#script-execute-output', null, c) as HTMLDivElement }
}

ScriptMode.prototype.mkcontainer = function(this: ScriptMode, ) {
    return document.createElement("script-template")
}

ScriptMode.prototype.refresh = function(this: ScriptMode, id: bigint) {
    for(let mode of this.renderedModes.values()) {
        mode.refresh?.(id)
    }
}

ScriptMode.prototype.close = function(this: ScriptMode, ) {
    for(let mode of this.renderedModes.values()) {
        mode.close()
    }

    if (this.container)
        this.container.remove()
    else {
        this.clearSelected()
        this.clear()
    }
}

ScriptMode.prototype.add = function(this: ScriptMode, entry: InfoEntry) {
    const modeSelect = getElement("#script-select-view", this.win.HTMLSelectElement, this.container)?.value || 'entry'
    const newMode = mode_name2cls(modeSelect)
    const d: Mode = this.renderedModes.has(modeSelect) ?
                            this.renderedModes.get(modeSelect)
                            //@ts-ignore
                        : new newMode(this.output, this.win)
    const e = d.add(entry)
    e.style.display = "block"
    this.renderedModes.set(modeSelect, d)
    return e
}

ScriptMode.prototype.sub = function(this: ScriptMode, entry: InfoEntry) {
    for(let mode of this.renderedModes.values()) {
        mode.sub(entry)
    }
}

ScriptMode.prototype.addList = function(this: ScriptMode, entries: InfoEntry[]) {
    for (let e of entries) {
        this.add(e)
    }
}

ScriptMode.prototype.subList = function(this: ScriptMode, entries: InfoEntry[]) {
    for (let e of entries) {
        this.sub(e)
    }
}

ScriptMode.prototype.clear = function(this: ScriptMode, ) {
    for (let mode of this.renderedModes.values()) {
        if ("clear" in mode)
            //@ts-ignore
            mode.clear()
    }

    clearUI()

    if (this.output instanceof this.win.HTMLElement) {
        this.output.innerHTML = ""
    } else
        while (this.output.children.length) {
            this.output.children[0].remove()
        }
}

ScriptMode.prototype.clearSelected = function(this: ScriptMode, ) {
    for (let mode of this.renderedModes.values()) {
        mode.close()
    }
    this.renderedModes = new Map
}

ScriptMode.prototype.chwin = function(this: ScriptMode, win: Window & typeof globalThis): HTMLElement {
    const container = ModePrimitives.chwin.call(this, win)
    this.run = container.querySelector("#script-execute") as HTMLButtonElement
    this.scriptBox = container.querySelector("#script") as HTMLTextAreaElement
    this.output = container.querySelector("#script-execute-output") as HTMLDivElement
    this.run.onclick = execute.bind(this)
    for (let mode of this.renderedModes.values()) {
        mode.win = win
        mode.output = this.output
    }
    return container
}

ScriptMode.prototype.put = function(this: ScriptMode, html: string | HTMLElement | ShadowRoot) {
    if (typeof html === 'string') {
        if (this.output instanceof DocumentFragment) {
            this.output.append(html)
        } else {
            let frag = new DocumentFragment
            frag.append(document.createElement("div"))
            if (frag.firstElementChild) {
                frag.firstElementChild.innerHTML = html
                this.output.append(...frag.firstElementChild.childNodes)
            }
        }
    } else {
        this.output.append(html)
    }
}

function execute(this: ScriptMode) {
    let script = this.scriptBox.value

    let tbl = new CalcVarTable()
    tbl.set("results", new Arr(items_getResults().map(v => new EntryTy(v.info))))

    if (getElementOrThrow("#script-execute-output-clear", this.win.HTMLInputElement, this.win.document)?.checked) {
        this.clear()
    }

    if (getElementOrThrow("#script-js-mode", this.win.HTMLInputElement, this.win.document)?.checked) {
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
