class CalendarMode extends Mode {
    NAME = "calendar-output"

    #mode: "day" | "month"

    selectedItems: InfoEntry[]

    selectedTime: [Date, Date]

    constructor(parent?: HTMLElement, win?: Window & typeof globalThis) {
        super(parent || "#calendar-output", win)

        this.win.document.getElementById("calendar-output")?.classList.add("open")

        this.mode = "month"

        this.selectedItems = []

        const now = new Date(Date.now())
        this.selectedTime = [new Date(now.getFullYear(), now.getMonth()), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)]

        this._setupWin()
    }

    _setupWin() {
        this.onResize()
        this.win.addEventListener("resize", this.onResize.bind(this))

        this.parent.querySelector("#month-prev")?.addEventListener("click", e => {
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

        this.parent.querySelector("#month-next")?.addEventListener("click", e => {
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

        this.parent.querySelector("#time-start")?.addEventListener("change", e => {
            const d = new Date(e.target.value)
            this._setStart(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
            this._render()
        })

        this.parent.querySelector("#time-end")?.addEventListener("change", e => {
            const d = new Date(e.target.value)
            this._setEnd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
            this._render()
        })


        this._setStart(this.selectedTime[0])
        this._setEnd(this.selectedTime[1])
    }

    _setStart(date: Date) {
        this.selectedTime[0] = date
        const startIn = this.parent.querySelector("#time-start") as HTMLInputElement
        startIn.value = date.toISOString().slice(0, 10)
    }
    _setEnd(date: Date) {
        this.selectedTime[1] = date
        const endIn = this.parent.querySelector("#time-end") as HTMLInputElement
        endIn.value = date.toISOString().slice(0, 10)
    }

    get mode() {
        return this.#mode
    }

    set mode(value: "day" | "month") {
        this.#mode = value
        if (this.parent instanceof HTMLElement)
            this.parent.setAttribute("data-mode", this.mode)
    }

    onResize() {
        // this.canv.width = this.canv.parentElement?.clientWidth || 100
        // this.canv.height = this.canv.parentElement?.clientHeight || 100
    }

    close() {
        this.win.document.getElementById("calendar-output")?.classList.remove("open")
        this.clearSelected()
    }

    _renderDay() {
        const timeDiffMins = (this.selectedTime[1].getTime() - this.selectedTime[0].getTime()) / 1000 / 60
        return document.createElement("div")
    }

    _renderMonth(start: Date, end?: Date) {
        end ??= new Date(start.getFullYear(), start.getMonth() + 1, 0)

        const monthGrid = document.createElement("div")
        monthGrid.classList.add('month-grid')

        //events within the month
        //(finding valid events each day is COSTLY)
        let validEvents: UserEvent[] = [
            ...items_getEventsWithinTimeRange(
                this.selectedItems,
                start.getTime(),
                end.getTime(),
            )
        ]

        //plus finding the valid events now, lets us sort it once and only once
        validEvents = validEvents.sort((a, b) => items_compareEventTiming(b, a))

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

        const eventTotalsTable = this.parent.querySelector("#event-totals")
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

    _render() {
        if (this.mode === "day") {
            return this._renderDay()
        } else {
            const output = this.parent.querySelector("#month-display") as HTMLElement | null
            if (!output) return document.createElement("div")

            const months = output.querySelector("#months") as HTMLDivElement
            while (months.firstElementChild) {
                months.firstElementChild.remove()
            }

            const stats = {
                total: 0,
                eventStats: {} as Record<string, number>
            }

            let validEvents: UserEvent[] = [
                ...items_getEventsWithinTimeRange(
                    this.selectedItems,
                    this.selectedTime[0].getTime(),
                    this.selectedTime[1].getTime(),
                )
            ]
            for(let event of validEvents) {
                stats.total++
                if(stats.eventStats[event.Event]) {
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
            if(totalEvents)
                totalEvents.innerText = stats.total
            if(statsTbl)
            for(let [event, count] of Object.entries(stats.eventStats).sort((a, b) => b[1] - a[1])) {
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

    add(entry: InfoEntry): HTMLElement {
        this.selectedItems.push(entry)
        return this._render()
    }

    sub(entry: InfoEntry) {
        this.selectedItems = this.selectedItems.filter(v => v.ItemId !== entry.ItemId)
        this._render()
    }

    addList(entry: InfoEntry[]) {
        this.selectedItems = this.selectedItems.concat(entry)
        this._render()
    }

    subList(entry: InfoEntry[]) {
        const idsToRemove = entry.map(v => v.ItemId)
        this.selectedItems = this.selectedItems.filter(v => !idsToRemove.includes(v.ItemId))
        this._render()
    }

    clearSelected() {
        this.selectedItems = []
    }

    chwin(win: Window & typeof globalThis) {
        this.win.close()
        this.win = win
        this.parent = win.document.getElementById("calendar-output") as HTMLCanvasElement
        this._setupWin()
    }
}
