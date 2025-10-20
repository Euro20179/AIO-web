const apiPath = `${AIO}${API}`

const ACCOUNTS: Record<number, string> = {}

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

/**
* @description Grabs the sequence number from a string, given a list of all items in the sequence
*/
function sequenceNumberGrabber(text: string, allItems: string[]): number | null {
    //match sequence indicator (non-word character, vol/ova/e/s)
    //followed by sequence number (possibly a float)
    //followed by non-word character
    //eg: S01
    //eg: E6.5
    const regex = /(?:[\W_\-\. EesS]|[Oo][Vv][Aa]|[Vv](?:[Oo][Ll])?\.?)?(\d+(?:\.\d+)?)[\W_\-\. ]?/g

    const matches = text.matchAll(regex).toArray()
    if (matches[0] == null) {
        return null
    }
    return Number(matches.filter(match => {
        for (let item of allItems) {
            if (item === text) continue

            if (item.includes(match[0]))
                return false
            return true
        }
    })[0][1])
}

function saveEval(script: string) {
    let old = XMLHttpRequest
    //@ts-ignore
    window.XMLHttpRequest = null
    let oldFetch = fetch
    window.fetch = async function(path: URL | RequestInfo, opts?: RequestInit) {
        if (!confirm(`A request is about to be made to ${path}, is this ok?`)) {
            return await oldFetch("/")
        }
        return await oldFetch(path, opts)
    }
    let res = new Function(script)()
    window.XMLHttpRequest = old
    window.fetch = oldFetch
    return res
}
