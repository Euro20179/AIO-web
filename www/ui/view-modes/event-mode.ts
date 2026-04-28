class OrderedEvents {
    events: UserEvent[]
    constructor() {
        this.events = []
    }

    clear() {
        this.events = []
    }

    add(event: UserEvent) {
        this.events.push(event)
        this.sort()
    }

    addList(...events: UserEvent[]) {
        for (let e of events) {
            this.events.push(e)
        }
        this.sort()
    }

    remove(event: UserEvent) {
        let text = _cononicalizeEvent(event)
        this.events = this.events.filter(v => _cononicalizeEvent(v) !== text)
        this.sort()
    }

    removeList(...events: UserEvent[]) {
        let removeText = []
        for (let e of events) {
            removeText.push(_cononicalizeEvent(e))
        }
        this.events = this.events.filter(v => !removeText.includes(_cononicalizeEvent(v)))
        this.sort()
    }

    sort() {
        this.events.sort((a, b) => {
            return items_eventTimeEstimate(b) - items_eventTimeEstimate(a)
        })
    }

    buildElementLists(exclude?: UserEvent[]) {
        let els = []
        exclude ||= []
        for (let event of this.events) {
            if (exclude.includes(event)) continue
            let tr = document.createElement("tr")
            let nameTD = document.createElement("td")
            let timeTD = document.createElement("td")
            let forTD = document.createElement("TD")
            nameTD.append(event.Event)
            timeTD.innerHTML = items_eventTSHTML(event)
            forTD.append(findInfoEntryById(event.ItemId).En_Title)
            tr.replaceChildren(forTD, nameTD, timeTD)
            els.push(tr)
        }
        return els
    }

    list() {
        return this.events
    }
}

//instead of literally removing elements we dont want form eventOrder,
//keep track of the ones we dont want then dont render those
//this is because if we remove from eventOrder, we can't add them back

type EventMode = {
    eventFilter: HTMLInputElement
    excludedEvents: UserEvent[]
    eventOrder: OrderedEvents

    _reRenderEventTable(): any,
    _filterEvents(script: string): any
} & Mode


function EventMode(this: EventMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)
    this.eventFilter = (this.container || this.win.document).querySelector("#event-filter") as HTMLInputElement

    this.eventFilter.onchange = () => {
        if (this.eventFilter.value === "") return

        this._reRenderEventTable()
    }

    this.excludedEvents = []

    this.eventOrder = new OrderedEvents()
}

EventMode.prototype._filterEvents = function(this: EventMode, script: string) {
    this.excludedEvents.length = 0

    for (let event of this.eventOrder.list()) {
        let tbl = makeSymbolsTableFromObj(event)
        for (let status of ["Planned", "Viewing", "Finished", "Dropped", "Paused", "ReViewing", "Waiting", "Resuming", "Added"]) {
            let is = event.Event === status
            const n = new Num(Number(is))
            tbl.set(status.toLowerCase(), n)
            tbl.set(status.toLowerCase(), n)
        }
        let res = parseExpression(script, tbl)
        if (!res.truthy()) {
            this.excludedEvents.push(event)
        }
    }
}

EventMode.prototype._reRenderEventTable = function(this: EventMode, ) {
    if (this.eventFilter.value) {
        this._filterEvents(this.eventFilter.value)
    } else {
        this.excludedEvents.length = 0
    }
    let header = this.output.firstElementChild as HTMLTableRowElement
    let rest = this.eventOrder.buildElementLists(this.excludedEvents)
    this.output.replaceChildren(header, ...rest)
}


EventMode.prototype.close = function(this: EventMode, ) {
    if (this.container)
        this.container.remove()
    else this.clearSelected()
    this.clearSelected()
}

EventMode.prototype.add = function(this: EventMode, entry: InfoEntry) {
    this.eventOrder.addList(...findUserEventsById(entry.ItemId))
    this._reRenderEventTable()
    return document.createElement("div")
}

EventMode.prototype.addList = function(this: EventMode, entry: InfoEntry[]) {
    for (let e of entry) {
        this.eventOrder.addList(...findUserEventsById(e.ItemId))
    }
    this._reRenderEventTable()
}

EventMode.prototype.sub = function(this: EventMode, entry: InfoEntry) {
    this.eventOrder.removeList(...findUserEventsById(entry.ItemId))
    this._reRenderEventTable()
}

EventMode.prototype.subList = function(this: EventMode, entry: InfoEntry[]) {
    for (let e of entry) {
        this.eventOrder.removeList(...findUserEventsById(e.ItemId))
    }
    this._reRenderEventTable()
}

EventMode.prototype.mkcontainers = function(this: EventMode, into: HTMLElement) {
    const c = this.mkcontainer()
    into.append(c)
    return { container: c, output: getElementOrThrowUI("#event-output-table", null, c) }
}

EventMode.prototype.mkcontainer = function(this: EventMode, ) {
    return document.createElement("event-template")
}

EventMode.prototype.chwin = function(this: EventMode, win: Window & typeof globalThis) {
    const container = ModePrimitives.chwin.call(this, win)
    this.output = container.querySelector("#event-output-table") as HTMLTableElement
    this.eventFilter = container.querySelector("#event-filter") as HTMLInputElement
    this.eventFilter.onchange = () => {
        if (this.eventFilter.value === "") return

        this._reRenderEventTable()
    }
    return container
}

EventMode.prototype.clearSelected = function(this: EventMode, ) {
    this.eventOrder.clear()
    this._reRenderEventTable()
}
