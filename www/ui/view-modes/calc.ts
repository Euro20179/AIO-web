const calcItems = document.getElementById("calc-items") as HTMLDivElement
const expressionInput = document.getElementById("calc-expression") as HTMLTextAreaElement

const modeCalc: DisplayMode = {
    add(entry, parent?: HTMLElement | DocumentFragment) {
        return renderCalcItem(entry, parent)
    },

    sub(entry) {
        removecCalcItem(entry)
    },

    addList(entry) {
        for (let item of entry) {
            renderCalcItem(item)
        }
    },

    subList(entry) {
        for (let item of entry) {
            removecCalcItem(item)
        }
    },

    refresh(id) {
        const el = document.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null
        if (!el) return
        //PROBLEM: if something within the user's code causes calc to get updated
        //an infinite cycle will occure because
        //run user's code -> updateInfo -> calc updates -> run user's code
        //SOLUTION:
        //DO NOT UPDATE EXPRESSION
        refreshCalcItem(findInfoEntryById(id), el)
    },

    *_getValidEntries() {
        const selected = Object.groupBy(globalsNewUi.selectedEntries, item => String(item.ItemId))
        let elems = calcItems.querySelectorAll(`[data-item-id]`)

        for (let elem of elems) {
            let val = Number(elem.getAttribute("data-expression-output"))
            let id = elem.getAttribute("data-item-id")

            if (!id || val <= 0 || !selected[id]) continue

            yield selected[id][0]
        }
    },

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
    },

    addTagsToSelected() {
        promptUI("tags (, seperated)").then(tags => {
            if (!tags) return
            const tagsList = tags.split(",")
            for (let item of this._getValidEntries()) {
                api_addEntryTags(item.ItemId, tagsList)
            }
        })

    }
}

expressionInput.onchange = function() {
    for (let entry of globalsNewUi.selectedEntries) {
        let val = updateExpressionOutput(entry)
        let el = calcItems.querySelector(`[data-item-id="${entry.ItemId}"]`)
        el?.setAttribute("data-expression-output", val.jsStr())
    }
}

function updateExpressionOutput(item: InfoEntry) {
    let expr = expressionInput.value

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

function removecCalcItem(item: InfoEntry) {
    let el = calcItems.querySelector(`[data-item-id="${item.ItemId}"]`)
    el?.remove()
}

function refreshCalcItem(item: InfoEntry, el: HTMLElement, updateExpr = false) {
    let root = el.shadowRoot
    if (!root) return el

    el.setAttribute("data-item-id", String(item.ItemId))

    let meta = findMetadataById(item.ItemId)

    if (updateExpr) {
        let val = updateExpressionOutput(item)
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

function renderCalcItem(item: InfoEntry, parent: HTMLElement | DocumentFragment = calcItems): HTMLElement {
    let el = document.createElement("calc-entry")
    refreshCalcItem(item, el, true)
    parent.append(el)
    return el
}

function sortCalcDisplay() {
    let elements = [...calcItems.querySelectorAll(`[data-item-id]`)]
    elements.sort((a, b) => {
        let exprA = /**@type {string}*/(a.getAttribute("data-expression-output"))
        let exprB = /**@type {string}*/(b.getAttribute("data-expression-output"))
        return Number(exprB) - Number(exprA)
    })
    calcItems.innerHTML = ""
    for (let elem of elements) {
        calcItems.append(elem)
    }
}
