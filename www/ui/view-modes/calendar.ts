type CalendarMode = {
    selectedItems: InfoEntry[]
    selectedTime: [Date, Date]

    mode: "month" | "day"

    _setupWin(): any
    _setStart(date: Date): any
    _setEnd(date: Date): any
    _render(): HTMLElement
} & Mode

function CalendarMode(this: CalendarMode, output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
    ModePrimitives.setup.call(this, output, win)
    this.NAME = "calendar-output";

    (function(this: CalendarMode) {
        let mode = "month"
        Object.defineProperty(this, "mode", {
            get: () => mode,
            set(value: "month" | "day") {
                mode = value
                if (this.output instanceof this.win.HTMLElement)
                    this.output.setAttribute("data-mode", this.mode)
            }
        })
    }).call(this)

    this.mode = "month"

    this.selectedItems = []

    const now = new Date(Date.now())
    this.selectedTime = [new Date(now.getFullYear(), now.getMonth()), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)]

    this._setupWin()
}

/**
 * sets everything up in the current window
 */
CalendarMode.prototype._setupWin = function(this: CalendarMode) {
    this.output.querySelector("#month-prev")?.addEventListener("click", e => {
        let prevMonth = this.selectedTime[0].getMonth() - 1
        let year = this.selectedTime[0].getFullYear()
        if (prevMonth === -1) {
            prevMonth = 11
            year -= 1
        }
        this._setStart(new Date(year, prevMonth))
        this._setEnd(new Date(year, prevMonth + 1, 0, 23, 59, 59))
        this._render()
    })

    this.output.querySelector("#month-next")?.addEventListener("click", e => {
        let nextMonth = this.selectedTime[0].getMonth() + 1
        let year = this.selectedTime[0].getFullYear()
        if (nextMonth === 12) {
            nextMonth = 0
            year += 1
        }
        this._setStart(new Date(year, nextMonth))
        this._setEnd(new Date(year, nextMonth + 1, 0, 23, 59, 59))
        this._render()
    })

    this.output.querySelector("#time-start")?.addEventListener("change", e => {
        const d = new Date(e.target.value)
        this._setStart(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
        this._render()
    })

    this.output.querySelector("#time-end")?.addEventListener("change", e => {
        const d = new Date(e.target.value)
        this._setEnd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
        this._render()
    })

    this.output.querySelector("#event-filter")?.addEventListener("input", e => {
        this._render()
    })


    this._setStart(this.selectedTime[0])
    this._setEnd(this.selectedTime[1])
}

CalendarMode.prototype._setStart = function(this: CalendarMode, date: Date) {
    this.selectedTime[0] = date
    const startIn = this.output.querySelector("#time-start") as HTMLInputElement
    startIn.value = date.toISOString().slice(0, 10)
}
CalendarMode.prototype._setEnd = function(this: CalendarMode, date: Date) {
    this.selectedTime[1] = date
    const endIn = this.output.querySelector("#time-end") as HTMLInputElement
    endIn.value = date.toISOString().slice(0, 10)
}

CalendarMode.prototype.close = function(this: CalendarMode, ) {
    if (this.container)
        this.container.remove()
    else this.clearSelected()
    this.clearSelected()
}

CalendarMode.prototype._renderDay = function(this: CalendarMode, ) {
    const timeDiffMins = (this.selectedTime[1].getTime() - this.selectedTime[0].getTime()) / 1000 / 60
    return document.createElement("div")
}

CalendarMode.prototype._getValidEvents = function(this: CalendarMode, start: Date, end ?: Date) {
    end ??= new Date(start.getFullYear(), start.getMonth() + 1, 0)
    //events within the month
    //(finding valid events each day is COSTLY)
    let validEvents: UserEvent[] = [
        ...items_getEventsWithinTimeRange(
            this.selectedItems,
            start.getTime(),
            end.getTime(),
        )
    ]
    const eventFilter = getElementUI(
        "#event-filter",
        this.win.HTMLInputElement,
        this.output
    )

    if (eventFilter) {
        validEvents = validEvents.filter(e => {
            const symbols = makeSymbolsTableFromObj(e)
            for (let status of ["Planned", "Viewing", "Finished", "Dropped", "Paused", "ReViewing", "Waiting", "Resuming", "Added"]) {
                let is = e.Event === status
                const n = new Num(Number(is))
                symbols.set(status.toLowerCase(), n)
                symbols.set(status.toLowerCase(), n)
            }
            return parseExpression(eventFilter.value, symbols).truthy()
        })
    }

    return validEvents
}

CalendarMode.prototype._renderMonth = function(this: CalendarMode, start: Date, end ?: Date) {
    end ??= new Date(start.getFullYear(), start.getMonth() + 1, 0)

    const monthGrid = document.createElement("div")
    monthGrid.classList.add('month-grid')



    //plus finding the valid events now, lets us sort it once and only once
    const validEvents = this._getValidEvents(start, end).sort((a, b) => {
        return items_compareEventTiming(b, a)
    })

    while (monthGrid.firstElementChild) {
        monthGrid.removeChild(monthGrid.firstElementChild)
    }

    for (let i = 0; i < start.getDay(); i++) {
        monthGrid.appendChild(document.createElement("div"))
    }

    let startDate = start.getDate()
    for (let i = 1; i < startDate; i++) {
        monthGrid.appendChild(document.createElement("div"))
    }

    for (let day = startDate; day <= end.getDate(); day++) {
        const d = document.createElement("div")
        d.classList.add("day")
        d.setAttribute("data-day", String(day))
        d.append(String(day))
        monthGrid.appendChild(d)
    }

    const eventTotalsTable = this.output.querySelector("#event-totals")
    while (eventTotalsTable?.firstElementChild) {
        eventTotalsTable.removeChild(eventTotalsTable.firstElementChild)
    }

    for (let ev of validEvents) {
        let day = (new Date(ev.Timestamp || ev.Before || ev.After)).getDate()
        const d = monthGrid.querySelector(`[data-day="${day}"]`)
        //it's possible that the event may be invalid (validity assumes a month has 31 days)
        if (!d) continue

        const item = findInfoEntryById(ev.ItemId)

        const eventMarker = document.createElement("span")
        eventMarker.classList.add("event-marker")
        eventMarker.setAttribute("data-event", ev.Event)
        eventMarker.innerText = `${ev.Event} - ${item.En_Title}`
        eventMarker.title = items_eventTSText(ev)
        d.appendChild(eventMarker)
    }
    const monthLabel = document.createElement("h2")
    monthLabel.innerHTML = `${start.toLocaleString('default', { month: "long" })} ${start.getFullYear()}`
    monthLabel.classList.add("month-label")

    return [monthLabel, monthGrid]
}

CalendarMode.prototype._render = function(this: CalendarMode, ) {
    if (this.mode === "day") {
        return this._renderDay()
    } else {
        const output = this.output.querySelector("#month-display") as HTMLElement | null
        if (!output) return document.createElement("div")

        const months = output.querySelector("#months") as HTMLDivElement
        while (months.firstElementChild) {
            months.firstElementChild.remove()
        }

        const stats = {
            total: 0,
            eventStats: {} as Record<string, number>
        }

        const validEvents = this._getValidEvents(this.selectedTime[0],
            this.selectedTime[1])

        for (let event of validEvents) {
            stats.total++
            if (stats.eventStats[event.Event]) {
                stats.eventStats[event.Event] += 1
            } else {
                stats.eventStats[event.Event] = 1
            }
        }

        if (this.selectedTime[0].getFullYear() == this.selectedTime[1].getFullYear() && this.selectedTime[0].getMonth() === this.selectedTime[1].getMonth()) {
            for (let child of this._renderMonth(this.selectedTime[0], this.selectedTime[1]))
                months.appendChild(child)
        } else {
            for (let child of this._renderMonth(this.selectedTime[0]))
                months.appendChild(child)

            let currentDate = new Date(this.selectedTime[0].getFullYear(), this.selectedTime[0].getMonth() + 1)
            while (currentDate.getMonth() < this.selectedTime[1].getMonth() || currentDate.getFullYear() < this.selectedTime[1].getFullYear()) {
                for (let child of this._renderMonth(currentDate))
                    months.appendChild(child)
                currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
            }

            if (currentDate.getTime() < this.selectedTime[1].getTime()) {
                for (let child of this._renderMonth(currentDate, this.selectedTime[1])) {
                    months.appendChild(child)
                }
            }
        }

        const statsTbl = output.querySelector("#event-totals")
        const totalEvents = output.querySelector("#total-events")
        if (totalEvents)
            totalEvents.innerText = stats.total
        if (statsTbl)
            for (let [event, count] of Object.entries(stats.eventStats).sort((a, b) => b[1] - a[1])) {
                statsTbl.innerHTML += `
<tr>
    <td>${event}</td>
    <td>${count}</td>
    <td>${(count / stats.total * 100).toFixed(2)}</td>
</tr>`
            }

        return output
    }
}

CalendarMode.prototype.add = function(this: CalendarMode, entry: InfoEntry): HTMLElement {
    this.selectedItems.push(entry)
    return this._render()
}

CalendarMode.prototype.sub = function(this: CalendarMode, entry: InfoEntry) {
    this.selectedItems = this.selectedItems.filter(v => v.ItemId !== entry.ItemId)
    this._render()
}

CalendarMode.prototype.addList = function(this: CalendarMode, entry: InfoEntry[]) {
    this.selectedItems = this.selectedItems.concat(entry)
    this._render()
}

CalendarMode.prototype.subList = function(this: CalendarMode, entry: InfoEntry[]) {
    const idsToRemove = entry.map(v => v.ItemId)
    this.selectedItems = this.selectedItems.filter(v => !idsToRemove.includes(v.ItemId))
    this._render()
}

CalendarMode.prototype.clearSelected = function(this: CalendarMode, ) {
    this.selectedItems = []
}

CalendarMode.prototype.mkcontainers = function(this: CalendarMode, into: HTMLElement) {
    const c = this.mkcontainer()
    into.append(c)
    return { container: c, output: getElementOrThrowUI(":first-child", null, c) }
}
CalendarMode.prototype.mkcontainer = function(this: CalendarMode, ) {
    return document.createElement("calendar-template")
}

CalendarMode.prototype.chwin = function(this: CalendarMode, win: Window & typeof globalThis) {
    const container = ModePrimitives.chwin.call(this, win)
    this.output = container.firstElementChild as HTMLElement
    this.output.setAttribute("data-mode", "month")
    this._setupWin()
    return container
}
