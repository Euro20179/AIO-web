const apiPath = `${AIO}${API}`

const ACCOUNTS: Record<number, string> = {}

let INTL_OPTIONS: Intl.ResolvedDateTimeFormatOptions =
    Intl.DateTimeFormat().resolvedOptions()

function alert(text: string) {
    const notificationsArea = document.getElementById("notifications") as HTMLDivElement
    const el = document.createElement("div")
    el.classList.add("notification")
    el.innerText = text
    notificationsArea?.append(el)
    el.onclick = el.remove.bind(el)
    setTimeout(el.remove.bind(el), 15000)
}

async function promptNumber(text: string, textFail: string, numberConverter: typeof parseInt): Promise<number>
async function promptNumber(text: string, textFail: string, numberConverter: typeof BigInt): Promise<bigint>
async function promptNumber(text: string, textFail: string, numberConverter: typeof parseFloat): Promise<number>
async function promptNumber(text: string, textFail: string): Promise<number>
async function promptNumber(text: string, textFail: string, numberConverter: NumberConstructor | BigIntConstructor | ((text: string) => number) = Number): Promise<number | bigint | null> {
    let n = await promptUI(text)
    while (n !== null && n !== "" && isNaN(Number(numberConverter(n)))) {
        n = await promptUI(textFail)
    }
    if (n === null || n === "") return null
    return numberConverter(n)
}
