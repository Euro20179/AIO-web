const run = document.getElementById("script-execute") as HTMLButtonElement
const scriptBox = document.getElementById("script") as HTMLTextAreaElement
const scriptOutput = document.getElementById("script-execute-output") as HTMLDivElement

const modeScripting: DisplayMode = {
    add(entry, updateStats?: boolean, parent: HTMLElement | DocumentFragment = scriptOutput) {
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

    put(html: string | HTMLElement | ShadowRoot) {
        if(typeof html === 'string') {
            scriptOutput.innerHTML += html
        } else {
            scriptOutput.append(html)
        }
    }
}

run.onclick = function() {
    const script = scriptBox.value

    let tbl = new SymbolTable()
    tbl.set("results", new Arr(globalsNewUi.results.map(v => new Entry(v.info))))

    //@ts-ignore
    if(document.getElementById("script-execute-output-clear")?.checked) {
        modeScripting.clear()
    }

    const value = parseExpression(script, tbl)
    scriptOutput.append(value.jsStr())
}
