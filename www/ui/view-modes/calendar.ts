class CalendarMode extends Mode {
    NAME = "calendar-output"
    canv: HTMLCanvasElement
    ctx: CanvasRenderingContext2D

    #mode: "day" | "month"

    selectedItems: InfoEntry[]

    selectedTime: [Date, Date]

    constructor(parent?: HTMLElement, win?: Window & typeof globalThis) {
        super(parent || "#calendar-output", win)

        this.win.document.getElementById("calendar-output")?.classList.add("open")
        this.canv = this.win.document.getElementById("cal-canvas") as HTMLCanvasElement
        this.ctx = this.canv.getContext("2d") as CanvasRenderingContext2D

        this.onResize()
        this.win.addEventListener("resize", this.onResize.bind(this))

        this.mode = "month"

        this.selectedItems = []

        this.selectedTime = [new Date(Date.now()), new Date(Date.now())]

        this.parent.querySelector("#month-prev")?.addEventListener("click", e => {
            let prevMonth = this.selectedTime[0].getMonth() - 1
            let year = this.selectedTime[0].getFullYear()
            if (prevMonth === -1) {
                prevMonth = 11
                year -= 1
            }
            this.selectedTime[0] = new Date(year, prevMonth)
            this._render()
        })

        this.parent.querySelector("#month-next")?.addEventListener("click", e => {
            let nextMonth = this.selectedTime[0].getMonth() + 1
            let year = this.selectedTime[0].getFullYear()
            if (nextMonth === 12) {
                nextMonth = 0
                year += 1
            }
            this.selectedTime[0] = new Date(year, nextMonth)
            this._render()
        })
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
        this.canv.width = this.canv.parentElement?.clientWidth
        this.canv.height = this.canv.parentElement?.clientHeight
    }

    close() {
        this.win.document.getElementById("calendar-output")?.classList.remove("open")
        this.clearSelected()
    }

    _renderDay() {
        const timeDiffMins = (this.selectedTime[1].getTime() - this.selectedTime[0].getTime()) / 1000 / 60
    }

    _renderMonth() {
        const output = this.parent.querySelector("#month-display") as HTMLElement | null
        if (!output) return

        const monthGrid = output.querySelector("#month-grid") as HTMLElement
        const monthName = output.querySelector("#month-name")

        const start = new Date(this.selectedTime[0].getFullYear(), this.selectedTime[0].getMonth(), 1)
        if (monthName)
            monthName.innerHTML = `${start.toLocaleString('default', { month: "long" })} ${start.getFullYear()}`
        const dayElements: HTMLElement[] = []

        for (let i = 0; i < start.getDay(); i++) {
            dayElements.push(document.createElement("div"))
        }

        const tz = Intl.DateTimeFormat().resolvedOptions()
        const fakeEventStartDay: UserEvent = {
            ItemId: 0n,
            EventId: 0,
            Event: "_AIOW_CALENDAR_COMP_EVENT",
            Timestamp: (new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0)).getTime(),
            TimeZone: tz.timeZone,
            Before: 0,
            After: 0,
        }

        const fakeEventEndDay: UserEvent = {
            ItemId: 0n,
            EventId: 0,
            Event: "_AIOW_CALENDAR_COMP_EVENT",
            Timestamp: (new Date(start.getFullYear(), start.getMonth(), 31, 23, 59, 59)).getTime(),
            TimeZone: tz.timeZone,
            Before: 0,
            After: 0,
        }

        //events within the month
        //(finding valid events each day is COSTLY)
        let validEvents: UserEvent[] = []
        for (let item of this.selectedItems) {
            const events = findUserEventsById(item.ItemId)

            for (let ev of events) {
                if (items_compareEventTiming(ev, fakeEventStartDay) <= 0 && items_compareEventTiming(ev, fakeEventEndDay) >=0) {
                    validEvents.push(ev)
                }
            }
        }
        //plus finding the valid events now, lets us sort it once and only once
        validEvents = validEvents.sort((a, b) => items_compareEventTiming(b, a))

        while(monthGrid.firstElementChild) {
            monthGrid.removeChild(monthGrid.firstElementChild)
        }

        for (let day = 1; day < 31; day++) {
            const d = document.createElement("div")
            d.classList.add("day")
            d.setAttribute("data-day", String(day))
            d.append(String(day))
            monthGrid.appendChild(d)
        }

        for(let ev of validEvents) {
            let day = (new Date(ev.Timestamp || ev.Before || ev.After)).getDate()
            const d = monthGrid.querySelector(`[data-day="${day}"]`)
            //it's possible that the event may be invalid (validity assumes a month has 31 days)
            if(!d) continue

            const item = findInfoEntryById(ev.ItemId)

            const eventMarker = document.createElement("span")
            eventMarker.classList.add("event-marker")
            eventMarker.setAttribute("data-event", ev.Event)
            eventMarker.innerText = `${ev.Event} - ${item.En_Title}`
            eventMarker.title = items_eventTSText(ev)
            d.appendChild(eventMarker)
        }
    }

    _render() {
        if (this.mode === "day") {
            this._renderDay()
        } else {
            this._renderMonth()
        }
    }

    add(entry: InfoEntry): HTMLElement {
        this.selectedItems.push(entry)
        this._render()
        return this.canv
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
        this.canv = this.win.document.getElementById("cal-canvas") as HTMLCanvasElement
        this.ctx = this.canv.getContext("2d") as CanvasRenderingContext2D
        this.win.addEventListener("resize", this.onResize.bind(this))
        this._render()
    }
}
