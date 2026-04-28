type CalcMode = {
    expressionInput: HTMLTextAreaElement
    sortCalcDisplay(): any
} & Mode

function CalcMode(this: CalcMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)

    this.expressionInput = this.win.document.getElementById("calc-expression") as HTMLTextAreaElement
    this.expressionInput.onchange = _updateEachCalcItem.bind(this)
    const sortButton = getElementUI(`#calc-sorter`, this.win.HTMLElement)
    if (sortButton) {
        sortButton.onclick = () => {
            this.sortCalcDisplay()
        }
    }
}

CalcMode.prototype.mkcontainers = function(this: CalcMode, into: HTMLElement) {
    const c = this.mkcontainer()
    into.append(c)
    return {
        container: c,
        output: getElementOrThrowUI("#calc-items", null, c)
    }
}

CalcMode.prototype.mkcontainer = function(this: CalcMode, ): HTMLElement {
    return document.createElement("calc-template")
}

CalcMode.prototype.sortCalcDisplay = function(this: CalcMode) {
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

CalcMode.prototype.close = function(this: CalcMode, ) {
    if (this.container)
        this.container.remove()
    else this.clearSelected()
    this.clearSelected()
}

CalcMode.prototype.add = function(this: CalcMode, entry: InfoEntry): HTMLElement {
    return renderCalcItem.call(this, entry)
}

CalcMode.prototype.sub = function(this: CalcMode, entry: InfoEntry) {
    removeCalcItem.call(this, entry)
}

CalcMode.prototype.addList = function(this: CalcMode, entry: InfoEntry[]) {
    for (let item of entry) {
        renderCalcItem.call(this, item)
    }
}

CalcMode.prototype.subList = function(this: CalcMode, entry: InfoEntry[]) {
    for (let item of entry) {
        removeCalcItem.call(this, item)
    }
}

CalcMode.prototype.clearSelected = function(this: CalcMode, ) {
    while (this.output.children.length) {
        this.output.removeChild(this.output.children[0])
    }
}

CalcMode.prototype.refresh = function(this: CalcMode, id: bigint) {
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

CalcMode.prototype.chwin = function(this: CalcMode, win: Window & typeof globalThis) {
    const container = ModePrimitives.chwin.call(this, win)

    this.output = getElementOrThrowUI("#calc-items", null, container) as HTMLElement
    this.expressionInput = container.querySelector("#calc-expression") as HTMLTextAreaElement
    this.expressionInput.onchange = _updateEachCalcItem.bind(this)

    return container
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

