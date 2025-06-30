
class CalcMode extends Mode {
    expressionInput: HTMLTextAreaElement

    constructor(parent?: HTMLElement, win?: Window & typeof globalThis) {
        super(parent || "#calc-items", win)
        this.win.document.getElementById("calc-output")?.classList.add("open")

        this.expressionInput = this.win.document.getElementById("calc-expression") as HTMLTextAreaElement
        this.expressionInput.onchange = _updateEachCalcItem.bind(this)
        const sortButton = this.parent.querySelector(`#calc-sorter`)
        sortButton?.addEventListener("click", sortCalcDisplay.bind(this))
    }

    close() {
        this.win.document.getElementById("calc-output")?.classList.remove("open")
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
        while (this.parent.children.length) {
            this.parent.removeChild(this.parent.children[0])
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
        refreshCalcItem.call(this, findInfoEntryById(id), el)
    }

    *_getValidEntries() {
        const selected = Object.groupBy(globalsNewUi.selectedEntries, item => String(item.ItemId))
        let elems = this.parent.querySelectorAll(`[data-item-id]`)

        for (let elem of elems) {
            let val = Number(elem.getAttribute("data-expression-output"))
            let id = elem.getAttribute("data-item-id")

            if (!id || val <= 0 || !selected[id]) continue

            yield selected[id][0]
        }
    }

    putSelectedInCollection() {
        promptUI("Id of collection").then(collectionName => {
            if (!collectionName) return

            let waiting = []
            for (let item of this._getValidEntries()) {
                waiting.push(api_setParent(item.ItemId, BigInt(collectionName)))
            }
            Promise.all(waiting).then(res => {
                for (let r of res) {
                    console.log(r?.status)
                }
            })
        })
    }

    addTagsToSelected() {
        promptUI("tags (, seperated)").then(tags => {
            if (!tags) return
            const tagsList = tags.split(",")
            for (let item of this._getValidEntries()) {
                api_addEntryTags(item.ItemId, tagsList)
            }
        })
    }

    chwin(win: Window & typeof globalThis) {
        this.win.close()
        this.win = win
        this.parent = win.document.getElementById("calc-items") as HTMLDivElement
        this.expressionInput = win.document.getElementById("calc-expression") as HTMLTextAreaElement
        this.expressionInput.onchange = _updateEachCalcItem.bind(this)
    }
}

function _updateEachCalcItem(this: CalcMode) {
    for (let entry of globalsNewUi.selectedEntries) {
        let val = updateExpressionOutput.call(this, entry)
        let el = this.parent.querySelector(`[data-item-id="${entry.ItemId}"]`)
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
    let el = this.parent.querySelector(`[data-item-id="${item.ItemId}"]`)
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
    this.parent.append(el)
    return el
}

function sortCalcDisplay(this: CalcMode) {
    let elements = [...this.parent.querySelectorAll(`[data-item-id]`)]
    elements.sort((a, b) => {
        let exprA = /**@type {string}*/(a.getAttribute("data-expression-output"))
        let exprB = /**@type {string}*/(b.getAttribute("data-expression-output"))
        return Number(exprB) - Number(exprA)
    })
    this.clearSelected()
    for (let elem of elements) {
        this.parent.append(elem)
    }
}
