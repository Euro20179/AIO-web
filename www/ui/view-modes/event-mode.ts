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


class EventMode extends Mode {
    NAME = "event-output"

    eventFilter: HTMLInputElement
    excludedEvents: UserEvent[]
    eventOrder: OrderedEvents

    constructor(output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        win ||= window
        let c = null
        if(!output) {
            output = document.createElement("event-template")
            c = output
            const o = getElementOrThrowUI("#viewing-area", null, win.document)
            o.append(output)
            output = output.querySelector("#event-output-table") as HTMLElement
        }
        super(output, win, c)
        this.eventFilter = document.getElementById("event-filter") as HTMLInputElement

        this.eventFilter.onchange = () => {
            if (this.eventFilter.value === "") return

            this._reRenderEventTable()
        }

        this.excludedEvents = []

        this.eventOrder = new OrderedEvents()
    }

    _filterEvents(script: string) {
        this.excludedEvents.length = 0

        for (let event of this.eventOrder.list()) {
            let tbl = makeSymbolsTableFromObj(event)
            for (let status of ["Planned", "Viewing", "Finished", "Dropped", "Paused", "ReViewing", "Waiting", "Resuming", "Added"]) {
                let is = event.Event === status
                tbl.set(status.toLowerCase(), new Num(Number(is)))
            }
            let res = parseExpression(script, tbl)
            if (!res.truthy()) {
                this.excludedEvents.push(event)
            }
        }
    }
    _reRenderEventTable() {
        if (this.eventFilter.value) {
            this._filterEvents(this.eventFilter.value)
        } else {
            this.excludedEvents.length = 0
        }
        let header = this.output.firstElementChild as HTMLTableRowElement
        let rest = this.eventOrder.buildElementLists(this.excludedEvents)
        this.output.replaceChildren(header, ...rest)
    }


    close() {
        if(this.container)
            this.container.remove()
        this.clearSelected()
    }

    add(entry: InfoEntry) {
        this.eventOrder.addList(...findUserEventsById(entry.ItemId))
        this._reRenderEventTable()
        return document.createElement("div")
    }

    addList(entry: InfoEntry[]) {
        for (let e of entry) {
            this.eventOrder.addList(...findUserEventsById(e.ItemId))
        }
        this._reRenderEventTable()
    }

    sub(entry: InfoEntry) {
        this.eventOrder.removeList(...findUserEventsById(entry.ItemId))
        this._reRenderEventTable()
    }

    subList(entry: InfoEntry[]) {
        for (let e of entry) {
            this.eventOrder.removeList(...findUserEventsById(e.ItemId))
        }
        this._reRenderEventTable()
    }

    mkcontainer() {
        return document.createElement("event-template")
    }

    chwin(win: Window & typeof globalThis) {
        const container = super.chwin.call(this, win)
        this.output = win.document.getElementById("event-output-table") as HTMLTableElement
        this.eventFilter = win.document.getElementById("event-filter") as HTMLInputElement
        this.eventFilter.onchange = () => {
            if (this.eventFilter.value === "") return

            this._reRenderEventTable()
        }
        return container
    }

    clearSelected() {
        this.eventOrder.clear()
        this._reRenderEventTable()
    }
}
