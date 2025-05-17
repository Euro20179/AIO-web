const run = document.getElementById("script-execute") as HTMLButtonElement
const scriptBox = document.getElementById("script") as HTMLTextAreaElement
const scriptOutput = document.getElementById("script-execute-output") as HTMLDivElement

const modeScripting: DisplayMode = {
    add(entry) {
        console.log(mode, mode === modeScripting, entry)
        if (mode !== modeScripting) return
        const e = renderDisplayItem(entry.ItemId, scriptOutput)
        e.style.display = "block"
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

    put(html: string) {
        scriptOutput.innerHTML += html
    }
}

run.onclick = function() {
    const script = scriptBox.value

    console.log(script)
    const value = parseExpression(script, new SymbolTable)
    scriptOutput.append(value.jsStr())
}
