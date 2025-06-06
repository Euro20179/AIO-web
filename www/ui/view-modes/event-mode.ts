class OrderedEvents {
    events: UserEvent[]
    constructor() {
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

const eventOutput = document.getElementById("event-output-table") as HTMLTableElement
const eventFilter = document.getElementById("event-filter") as HTMLInputElement

//instead of literally removing elements we dont want form eventOrder,
//keep track of the ones we dont want then dont render those
//this is because if we remove from eventOrder, we can't add them back
const excludedEvents: UserEvent[] = []
const eventOrder = new OrderedEvents()

function _reRenderEventTable() {
    _filterEvents(eventFilter.value)
    let header = eventOutput.firstElementChild as HTMLTableRowElement
    let rest = eventOrder.buildElementLists(excludedEvents)
    eventOutput.replaceChildren(header, ...rest)
}

function _filterEvents(script: string) {
    excludedEvents.length = 0

    for (let event of eventOrder.list()) {
        let tbl = makeSymbolsTableFromObj(event)
        for (let status of ["Planned", "Viewing", "Finished", "Dropped", "Paused", "ReViewing", "Waiting", "Resuming", "Added"]) {
            let is = event.Event === status
            tbl.set(status.toLowerCase(), new Num(Number(is)))
        }
        let res = parseExpression(script, tbl)
        if (!res.truthy()) {
            excludedEvents.push(event)
        }
    }
}

eventFilter.onchange = function() {
    if (eventFilter.value === "") return

    _reRenderEventTable()
}

const modeEvents: DisplayMode = {
    add(entry, parent) {
        eventOrder.addList(...findUserEventsById(entry.ItemId))
        _reRenderEventTable()
        return document.createElement("div")
    },

    addList(entry) {
        for (let e of entry) {
            eventOrder.addList(...findUserEventsById(e.ItemId))
        }
        _reRenderEventTable()
    },

    sub(entry) {
        eventOrder.removeList(...findUserEventsById(entry.ItemId))
        _reRenderEventTable()
    },

    subList(entry) {
        for (let e of entry) {
            eventOrder.removeList(...findUserEventsById(e.ItemId))
        }
        _reRenderEventTable()
    },
}
