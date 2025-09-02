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
        if(this.parent instanceof HTMLElement)
            this.parent.setAttribute("data-mode", this.mode)
    }

    onResize() {
        this.canv.width =  this.canv.parentElement?.clientWidth
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
        if(!output) return

        const monthGrid = output.querySelector("#month-grid") as HTMLElement
        const monthName = output.querySelector("#month-name")

        const start = new Date(this.selectedTime[0].getFullYear(), this.selectedTime[0].getMonth(), 1)
        if(monthName)
            monthName.innerHTML = `${start.toLocaleString('default', { month: "long" })} ${start.getFullYear()}`
        const dayElements: HTMLElement[] = []
        let finishedEvents: number[] = []

        for(let i = 0; i < start.getDay(); i++) {
            dayElements.push(document.createElement("div"))
        }

        for(let day = 1; day < 31; day++) {
            finishedEvents = []

            const curDay = new Date(start.getFullYear(), start.getMonth(), day)
            if(curDay.getMonth() !== start.getMonth()) break

            const d = document.createElement("div")
            d.classList.add("day")
            d.append(String(day))

            const fakeEventStartDay: UserEvent = {
                ItemId: 0n,
                EventId: 0,
                Event: "_AIOW_CALENDAR_COMP_EVENT",
                Timestamp: (new Date(start.getFullYear(), start.getMonth(), day, 0, 0, 0)).getTime(),
                TimeZone: "",
                Before: 0,
                After: 0,
            }

            const fakeEventEndDay: UserEvent = {
                ItemId: 0n,
                EventId: 0,
                Event: "_AIOW_CALENDAR_COMP_EVENT",
                Timestamp: (new Date(start.getFullYear(), start.getMonth(), day, 23, 59, 59)).getTime(),
                TimeZone: "+00:00",
                Before: 0,
                After: 0,
            }

            for(let item of this.selectedItems) {
                const events = findUserEventsById(item.ItemId)
                for(let ev of events) {
                    if(finishedEvents.includes(ev.EventId)) continue

                    if(items_compareEventTiming(ev, fakeEventStartDay) >= 0 && items_compareEventTiming(ev, fakeEventEndDay) <= 0) {
                        const eventMarker = document.createElement("span")
                        eventMarker.classList.add("event-marker")
                        eventMarker.setAttribute("data-event", ev.Event)
                        eventMarker.innerText = `${ev.Event} - ${item.En_Title}`
                        d.appendChild(eventMarker)
                    }
                    finishedEvents.push(ev.EventId)
                    // console.log(ev)
                }
            }
            dayElements.push(d)
        }
        monthGrid.replaceChildren(...dayElements)
    }

    _render() {
        if(this.mode === "day") {
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
