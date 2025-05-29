class Heap {
    el: HTMLTableRowElement
    #event: UserEvent | null

    left: Heap | null = null
    right: Heap | null = null

    count: number = 0

    constructor(event: UserEvent | null = null) {
        this.el = document.createElement("tr")
        this.#event = event
    }

    clear() {
        this.left = null
        this.right = null
        this.count = 0
    }

    compare(tree: Heap): -1 | 0 | 1 {

        let right = tree.#event
        let left = this.#event
        if (!left || !right) return 0

        return items_compareEventTiming(left, right)
    }

    setEl() {
        let nameTD = document.createElement("td")
        let timeTD = document.createElement("td")
        let forTD = document.createElement("TD")
        if (this.#event) {
            nameTD.append(this.#event.Event)
            timeTD.innerHTML = items_eventTSHTML(this.#event)
            forTD.append(findInfoEntryById(this.#event.ItemId).En_Title)
        }
        this.el.replaceChildren(forTD, nameTD, timeTD)
        console.log(this.el, timeTD, nameTD)
    }

    #swap(withHeap: Heap) {
        let temp = this.#event
        this.#event = withHeap.#event
        withHeap.#event = temp

        let tempel = this.el
        this.el = withHeap.el
        withHeap.el = tempel
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
        this.count++

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
        if (this.#event == null) {
            this.#event = event
            return this
        } else {
            return this.#add(new Heap(event))
        }
    }

    buildElementLists() {
        let elems: HTMLTableRowElement[] = []

        if (this.right) {
            elems = elems.concat(this.right.buildElementLists())
        }

        this.setEl()

        elems.push(this.el)

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

    },

    subList(entry, updateStats) {

    },
}
