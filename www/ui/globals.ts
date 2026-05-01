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

/**
 * Gets an element by a query selector that's an instanceof {requiredType}
 * If such an element is not found, null is returned
 *
 * @param selector passed to root.querySelector
 * @param [requiredType=null] The type the found element must be
 * @param [root=null] The root document, (default is currentDocument())
 * @reutrns {Element | null}
 */
function getElement<T extends typeof Element>(
    selector: string,
    requiredType: T | null = null,
    root: { querySelector(selector: string): Element | null } | null = null
): InstanceType<T> | null {
    let el = (root || currentDocument()).querySelector(selector)
    if (!el || (requiredType && !(el instanceof (requiredType as T)))) return null
    return el as InstanceType<T>
}
const getElementUI = getElement

/**
 * attempts to find an element of a certain type with a query selector within a container
 * if the element is not found, throw an error
 * @template T - an HTMLElement constructor (must be HTMLElement iself or a subclass)
 * @param {string} selector
 * @param {T | null} [requiredType=null] - the type the found element must be
 * @param [root=null] - the root (defaults to currentDocument()) (may also just be anything with a querySelector implementation)
 * @returns {T}
 */
function getElementOrThrow<T extends typeof HTMLElement>(
    selector: string,
    requiredType: T | null = null,
    root: { querySelector(selector: string): HTMLElement | null } | null = null
): InstanceType<T> {
    let el = getElement(selector, requiredType, root)
    if (!(el)) {
        throw new Error(`Element: ${selector} was not found`)
    }
    return el
}
const getElementOrThrowUI = getElement
