let run = document.getElementById("script-execute") as HTMLButtonElement
let scriptBox = document.getElementById("script") as HTMLTextAreaElement
let scriptOutput = document.getElementById("script-execute-output") as HTMLDivElement

const modeScripting: DisplayMode = {
    add(entry, parent: HTMLElement | DocumentFragment = scriptOutput) {
        if (mode !== modeScripting) return scriptOutput
        const e = renderDisplayItem(entry.ItemId, parent)
        e.style.display = "block"
        return e
    },
    sub(entry) {
        if (mode !== modeScripting) return
        scriptOutput.querySelector(`[data-item-id="${entry.ItemId}"]`)?.remove()
    },
    addList(entries) {
        if (mode !== modeScripting) return
        for (let e of entries) {
            this.sub(e)
        }
    },
    subList(entries) {
        if (mode !== modeScripting) return
        for (let e of entries) {
            this.sub(e)
        }
    },

    clear() {
        clearItems()
        scriptOutput.innerHTML = ""
    },

    clearSelected() {
        for(let elem of scriptOutput.querySelectorAll(`[data-item-id]`)) {
            elem.remove()
        }
    },

    chwin(win) {
        run = win.document.getElementById("script-execute") as HTMLButtonElement
        scriptBox = win.document.getElementById("script") as HTMLTextAreaElement
        scriptOutput = win.document.getElementById("script-execute-output") as HTMLDivElement
        run.onclick = execute
    },

    put(html: string | HTMLElement | ShadowRoot) {
        if (typeof html === 'string') {
            scriptOutput.innerHTML += html
        } else {
            scriptOutput.append(html)
        }
    },
}

function execute() {
    let script = scriptBox.value

    let tbl = new CalcVarTable()
    tbl.set("results", new Arr(globalsNewUi.results.map(v => new EntryTy(v.info))))

    //@ts-ignore
    if (document.getElementById("script-execute-output-clear")?.checked) {
        modeScripting.clear()
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
        return
    }

    const value = parseExpression(script, tbl)
    if (value instanceof Elem) {
        scriptOutput.append(value.el)
    } else {
        scriptOutput.append(value.jsStr())
    }
}

run.onclick = execute
