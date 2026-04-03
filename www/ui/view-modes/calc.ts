class CalcMode extends Mode {
    NAME = "calc-output"
    expressionInput: HTMLTextAreaElement

    constructor(output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        win ||= window
        let container = null
        if(!output) {
            output = document.createElement("calc-template")
            container = output
            const o = getElementOrThrowUI("#viewing-area", null, win.document)
            o.append(output)
            output = getElementOrThrowUI("#calc-items", null, output) as HTMLElement
        }
        super(output, win, container)

        this.expressionInput = this.win.document.getElementById("calc-expression") as HTMLTextAreaElement
        this.expressionInput.onchange = _updateEachCalcItem.bind(this)
        const sortButton = this.output.querySelector(`#calc-sorter`)
        sortButton?.addEventListener("click", sortCalcDisplay.bind(this))
    }

    close() {
        if(this.container)
            this.container.remove()
        this.clearSelected()
    }

    add(entry: InfoEntry): HTMLElement {
        return renderCalcItem.call(this, entry)
    }

    sub(entry: InfoEntry) {
        removeCalcItem.call(this, entry)
    }

    addList(entry: InfoEntry[]) {
        for (let item of entry) {
            renderCalcItem.call(this, item)
        }
    }

    subList(entry: InfoEntry[]) {
        for (let item of entry) {
            removeCalcItem.call(this, item)
        }
    }

    clearSelected() {
        while (this.output.children.length) {
            this.output.removeChild(this.output.children[0])
        }
    }

    refresh(id: bigint) {
        const el = this.win.document.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null
        if (!el) return
        //PROBLEM: if something within the user's code causes calc to get updated
        //an infinite cycle will occure because
        //run user's code -> updateInfo -> calc updates -> run user's code
        //SOLUTION:
        //DO NOT UPDATE EXPRESSION
        //this causes a bug where on page load, items data is not refreshed properly
        refreshCalcItem.call(this, findInfoEntryById(id), el)
    }

    *_getValidEntries() {
        const selected = Object.groupBy(items_getSelected(), item => String(item.ItemId))
        let elems = this.output.querySelectorAll(`[data-item-id]`)

        for (let elem of elems) {
            let val = Number(elem.getAttribute("data-expression-output"))
            let id = elem.getAttribute("data-item-id")

            if (!id || val <= 0 || !selected[id]) continue

            yield selected[id][0]
        }
    }

    chwin(win: Window & typeof globalThis) {
        this.win.close()
        this.win = win
        this.output = win.document.getElementById("calc-items") as HTMLDivElement
        this.expressionInput = win.document.getElementById("calc-expression") as HTMLTextAreaElement
        this.expressionInput.onchange = _updateEachCalcItem.bind(this)
    }
}

function _updateEachCalcItem(this: CalcMode) {
    for (let entry of items_getSelected()) {
        let val = updateExpressionOutput.call(this, entry)
        let el = this.output.querySelector(`[data-item-id="${entry.ItemId}"]`)
        el?.setAttribute("data-expression-output", val.jsStr())
    }
}

function updateExpressionOutput(this: CalcMode, item: InfoEntry) {
    let expr = this.expressionInput.value

    let meta = findMetadataById(item.ItemId)
    let user = findUserEntryById(item.ItemId)

    let all = { ...item, ...meta, ...user, GeneralRating: (meta?.Rating || 0) / (meta?.RatingMax || 1) * 100 }
    let symbols = makeSymbolsTableFromObj(all)

    let val = new Str(`${meta?.Description || ""}<br>${meta?.Rating || 0}`)
    if (expr) {
        val = parseExpression(expr, symbols)
    }
    return val
}

function removeCalcItem(this: CalcMode, item: InfoEntry) {
    let el = this.output.querySelector(`[data-item-id="${item.ItemId}"]`)
    el?.remove()
}

function refreshCalcItem(this: CalcMode, item: InfoEntry, el: HTMLElement, updateExpr = false) {
    let root = el.shadowRoot
    if (!root) return el

    el.setAttribute("data-item-id", String(item.ItemId))

    let meta = findMetadataById(item.ItemId)

    if (updateExpr) {
        let val = updateExpressionOutput.call(this, item)
        el.setAttribute("data-expression-output", String(val.jsStr()))
    }

    let name = root.getElementById('name') as HTMLElement
    name.innerText = item.En_Title

    let img = root.getElementById("calc-thumbnail") as HTMLImageElement
    if (meta?.Thumbnail) {
        img.src = fixThumbnailURL(meta?.Thumbnail)
    }
    el.setAttribute("data-item-id", String(item.ItemId))

    return el
}

function renderCalcItem(this: CalcMode, item: InfoEntry): HTMLElement {
    let el = document.createElement("calc-entry")
    refreshCalcItem.call(this, item, el, true)
    this.output.append(el)
    return el
}

function sortCalcDisplay(this: CalcMode) {
    let elements = [...this.output.querySelectorAll(`[data-item-id]`)]
    elements.sort((a, b) => {
        let exprA = /**@type {string}*/(a.getAttribute("data-expression-output"))
        let exprB = /**@type {string}*/(b.getAttribute("data-expression-output"))
        return Number(exprB) - Number(exprA)
    })
    this.clearSelected()
    for (let elem of elements) {
        this.output.append(elem)
    }
}
