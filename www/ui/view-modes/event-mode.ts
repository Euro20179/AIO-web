class Heap {
    #data: { el: HTMLTableRowElement, event: UserEvent | null }

    left: Heap | null = null
    right: Heap | null = null

    constructor(event: UserEvent | null = null) {
        this.#data = {
            el: document.createElement("tr"),
            event
        }
    }

    get el() {
        return this.#data.el
    }

    clear() {
        this.left = null
        this.right = null
    }

    compare(tree: Heap): -1 | 0 | 1 {

        let right = tree.#data.event
        let left = this.#data.event
        if (!left) return 1
        if (!right) return 0

        return items_compareEventTiming(left, right)
    }

    setEl() {
        let nameTD = document.createElement("td")
        let timeTD = document.createElement("td")
        let forTD = document.createElement("TD")
        if (this.#data.event) {
            nameTD.append(this.#data.event.Event)
            timeTD.innerHTML = items_eventTSHTML(this.#data.event)
            forTD.append(findInfoEntryById(this.#data.event.ItemId).En_Title)
        }
        this.#data.el.replaceChildren(forTD, nameTD, timeTD)
    }

    isEmpty() {
        return this.#data.event === null
    }

    #swap(withHeap: Heap) {
        let temp = this.#data.event
        this.#data.event = withHeap.#data.event
        withHeap.#data.event = temp

        let tempel = this.#data.el
        this.#data.el = withHeap.#data.el
        withHeap.#data.el = tempel
    }

    #removeEmptyNodes() {
        if (this.#data.event == null) {
            this.left = null
            this.right = null
        }
        if (this.left) {
            this.left.#removeEmptyNodes()
        }
        if (this.right) {
            this.right.#removeEmptyNodes()
        }
        this.#refactor()
    }

    #refactor() {
        let l = this.left
        let r = this.right

        if (l) {
            l.#refactor()
            if (this.compare(l) == 1) {
                this.#swap(l)
            }
        }
        if (r) {
            r.#refactor()
            if (this.compare(r) !== 1) {
                this.#swap(r)
            }
        }
    }

    addLeft(tree: Heap) {
        if (this.left == null) {
            this.left = tree
        } else {
            this.left.#add(tree)
        }
    }

    addRight(tree: Heap) {
        if (this.right == null) {
            this.right = tree
        } else {
            this.right.#add(tree)
        }
    }

    #add(tree: Heap) {
        let comp = this.compare(tree)
        switch (comp) {
            case 0:
            case -1:
                this.addLeft(tree)
                break
            case 1:
                this.addRight(tree)
        }

        this.#refactor()
        return tree
    }

    add(event: UserEvent) {
        if (this.#data.event == null) {
            this.#data.event = event
            return this
        } else {
            return this.#add(new Heap(event))
        }
    }

    remove(event: UserEvent) {
        if (this.#data.event == null) {
        }
        else if (items_eventEQ(this.#data.event, event)) {
            this.#data.event = null
            this.setEl()
        }
        else if (items_compareEventTiming(this.#data.event, event) !== -1 && this.right) {
            this.right.remove(event)
        } else if (this.left) {
            this.left.remove(event)
        }
        this.#removeEmptyNodes()
        this.#refactor()
    }

    buildElementLists() {
        let elems: HTMLTableRowElement[] = []

        if (this.right) {
            elems = elems.concat(this.right.buildElementLists())
        }

        this.setEl()

        elems.push(this.#data.el)

        if (this.left) {
            elems = elems.concat(this.left.buildElementLists())
        }

        return elems
    }
}

const eventOutput = document.getElementById("event-output-table") as HTMLTableElement

const eventHeap = new Heap()

function _reRenderEventTable() {
    let header = eventOutput.firstElementChild as HTMLTableRowElement
    let rest = eventHeap.buildElementLists()
    eventOutput.replaceChildren(header, ...rest)
}

const modeEvents: DisplayMode = {
    add(entry, updateStats, parent) {
        for (let event of findUserEventsById(entry.ItemId)) {
            eventHeap.add(event)
        }
        _reRenderEventTable()
        return eventHeap.el
    },

    addList(entry, updateStats) {
        for (let e of entry) {
            for (let event of findUserEventsById(e.ItemId)) {
                eventHeap.add(event)
            }
        }
        _reRenderEventTable()
    },

    sub(entry, updateStats) {
        for (let event of findUserEventsById(entry.ItemId)) {
            eventHeap.remove(event)
        }
        _reRenderEventTable()
    },

    subList(entry, updateStats) {
        for (let e of entry) {
            for (let event of findUserEventsById(e.ItemId)) {
                eventHeap.remove(event)
            }
        }
        _reRenderEventTable()
    },
}
