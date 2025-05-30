class Heap {
    #data: { el: HTMLTableRowElement, event: UserEvent | null }

    left: Heap | null = null
    right: Heap | null = null

    parent: Heap | null

    constructor(event: UserEvent | null = null, parent: Heap | null = null) {
        this.parent = parent
        this.#data = {
            el: document.createElement("tr"),
            event
        }
    }

    get el() {
        return this.#data.el
    }

    getCount() {
        let c = 0
        if (!this.isEmpty()) {
            c++
        }
        if (this.left) {
            c += this.left.getCount()
        }
        if (this.right) {
            c += this.right.getCount()
        }
        return c
    }

    clear() {
        this.left = null
        this.right = null
    }

    compare(tree: Heap): -1 | 0 | 1 {

        let right = tree.#data.event
        let left = this.#data.event
        if (!left || !right) return 1

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

    #removeDeadChildren() {
        if (this.left?.isEmpty()) {
            this.left = null
        } else if (this.left) {
            this.left.#removeDeadChildren()
        }
        if (this.right?.isEmpty()) {
            this.right = null
        } else if (this.right) {
            this.right.#removeDeadChildren()
        }
    }

    #removeEmptyNodes() {
        this.#bringUp()
        this.#removeDeadChildren()
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
            return this.#add(new Heap(event, this))
        }
    }

    #bringUp() {
        if (!this.isEmpty()) return

        if (this.left) {
            this.#swap(this.left)
            this.left.#bringUp()
            if (this.left.isEmpty()) {
                this.left = null
            }
        } else if (this.right) {
            this.#swap(this.right)
            this.right.#bringUp()
            if (this.right.isEmpty()) {
                this.right = null
            }
        }
    }

    remove(event: UserEvent) {
        if (this.#data.event == null) {
        }
        else if (this.#data.event && items_eventEQ(this.#data.event, event)) {
            this.#data.event = null
            if (this.parent) {
                //if this node is not the root node, it will not be removed from the overall tree unless called from the parent
                this.parent.#removeEmptyNodes()
            } else {
                this.#removeEmptyNodes()
            }
        }
        else if (items_compareEventTiming(this.#data.event, event) !== -1 && this.right) {
            this.right.remove(event)
        } else if (this.left) {
            this.left.remove(event)
        }
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
