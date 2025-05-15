type TT = { t: "open-tag" | "close-tag" | "\\" | "whitespace" | "char", value: string }

function serializeTT(t: TT) {
    switch (t.t) {
        case "open-tag":
            return `[${t.value}]`
        case "close-tag":
            return `[/${t.value}]`
        case "\\":
            return `\\${t.value}`
        case "whitespace":
        case "char":
            return t.value
    }
}

class NotesLexer {
    notes: string
    #i: number
    constructor(notes: string) {
        this.notes = notes

        this.#i = -1
    }

    next() {
        this.#i++
        return this.notes[this.#i]
    }

    peek() {
        return this.notes[this.#i + 1]
    }

    back() {
        this.#i--
        return this.notes[this.#i]
    }

    get curChar() {
        return this.notes[this.#i]
    }

    tag(): ["open" | "close", string] {
        let name = ""
        let open = true
        if (this.peek() == "/") {
            this.next()
            open = false
        }

        while (this.next() && this.curChar != "]") {
            name += this.curChar
        }
        return [open ? "open" : "close", name]
    }

    lex() {
        const tokens: TT[] = []
        while (this.next()) {
            let ch = this.curChar
            if (ch.match(/\s/)) {
                tokens.push({ t: "whitespace", value: ch })
            } else {
                switch (ch) {
                    case "[":
                        //tag_pos is either open or close
                        let [tag_pos, name] = this.tag()
                        tokens.push({ t: `${tag_pos}-tag`, value: name })
                        break
                    case "\\":
                        tokens.push({ t: ch, value: ch })
                        break
                    default:
                        tokens.push({ t: "char", value: ch })
                }
            }
        }

        return tokens
    }
}

interface NotesNode {
    getHTML(): string
}

class NotesStringNode implements NotesNode {
    constructor(public value: string) { }

    getHTML(): string {
        return this.value
    }
}
class NotesTagNode implements NotesNode {
    constructor(public name: string, public innerText: string, public propertyValue: string) { }

    getHTML(): string {
        let startTag = ""
        let endTag = ""
        let selfClosing = false
        switch (this.name) {
            case "i":
            case "b":
            case "u":
                startTag = `<${this.name}>`
                endTag = `</${this.name}>`
                break
            case "spoiler":
                startTag = "<span class='spoiler'>"
                endTag = "</span>"
                break
            case "color":
                startTag = `<span style="color:${this.propertyValue.replaceAll(/;"/g, "")}">`
                endTag = "</span>"
                break
            case "indent":
                let amount = parseInt(this.propertyValue || "0") || 4
                startTag = `<div style="margin-left: ${amount}ch">`
                endTag = "</div>"
                break
            case "list":
                if (this.propertyValue === "numbered") {
                    let n = 0
                    this.innerText = this.innerText.replaceAll("-", () => {
                        n++
                        return `${n}. `
                    })
                } else {
                    this.innerText = this.innerText.replaceAll("-", "•")
                }
                break
            case "bgcolor":
                startTag = `<span style="background-color:${this.propertyValue.replaceAll(/;"/g, "")}">`
                endTag = "</span>"
                break
            case "hl":
                startTag = `<mark>`
                endTag = "</mark>"
                break
            case "size":
                let size = parseFloat(this.propertyValue)
                let unit = this.propertyValue.slice(Math.ceil(Math.log10(size)))
                if (unit)
                    startTag = `<span style="font-size: ${size}${unit.replaceAll('"', '')}">`
                else
                    //use old sizes since user did not specify a unit
                    startTag = `<font size=${size}>`
                endTag = "</span>"
                break
            case "img":
                let properties = this.propertyValue.split(",")
                let width = "", height = ""
                for (let prop of properties) {
                    let [key, value] = prop.split(":")
                    switch (key) {
                        case "id":
                            let id = value
                            //the thumbnail should be the item's thumbnail
                            this.propertyValue = findMetadataById(BigInt(id))?.Thumbnail || ""
                            break

                        case "w":
                            width = value + "px"
                            break
                        case "h":
                            height = value + "px"
                            break
                    }
                }
                startTag = `<img src="${this.propertyValue}" height="${height}" width="${width}" alt="${this.innerText.replaceAll('"', "")}" style="vertical-align: middle">`
                selfClosing = true
                break
            case "item":
                if (this.propertyValue.match(/[^\d]/)) {
                    startTag = "<span>"
                    this.innerText = "INVALID ID"
                    endTag = "</span>"
                } else {
                    startTag = `<button onclick="toggleItem(findInfoEntryById(${this.propertyValue}n))">`
                    endTag = "</button>"
                }
                break
            case "link":
                startTag = `<a href="${this.propertyValue}">`
                endTag = "</a>"
                break
        }
        if (!selfClosing) {
            return startTag + parseNotes(this.innerText) + endTag
        }
        return startTag
    }
}

class NotesParser {
    tokens: TT[]
    nodes: NotesNode[]
    #i: number
    constructor(tokens: TT[]) {
        this.tokens = tokens

        this.nodes = []

        this.#i = -1
    }

    next() {
        this.#i++
        return this.tokens[this.#i]
    }

    back() {
        this.#i--
        return this.tokens[this.#i]
    }

    get curTok() {
        return this.tokens[this.#i]
    }

    handleEscape(): NotesStringNode {
        return new NotesStringNode(this.next().value)
    }

    handleOpenTag(): NotesTagNode | NotesStringNode {
        let name = this.curTok.value
        let value = ""
        if (name.includes("=")) {
            [name, value] = name.split("=")
        }


        let ate = ""
        while (this.next() && !(this.curTok.t === "close-tag" && this.curTok.value === name)) {
            ate += serializeTT(this.curTok)
        };


        if (!this.curTok) {
            if (value)
                return new NotesStringNode(`[${name}=${value}]${ate}`)
            return new NotesStringNode(`[${name}]${ate}`)
        }

        return new NotesTagNode(name, ate.trim(), value)
    }

    handleString(): NotesStringNode {
        let text = this.curTok.value

        while (this.next() && this.curTok.t === "char") {
            text += this.curTok.value
        }
        //goes too far
        this.back()
        return new NotesStringNode(text)
    }

    parse() {
        while (this.next()) {
            switch (this.curTok.t) {
                case "\\":
                    this.nodes.push(this.handleEscape())
                    break
                case "open-tag":
                    this.nodes.push(this.handleOpenTag())
                    break
                case "char":
                    this.nodes.push(this.handleString())
                    break
                case "whitespace":
                    this.nodes.push(new NotesStringNode(this.curTok.value))
                    break
            }
        }
        return this.nodes
    }
}

function parseNotes(notes: string) {
    const l = new NotesLexer(notes)
    const tokens = l.lex()

    const p = new NotesParser(tokens)
    const nodes = p.parse()

    let text = ""
    for (let node of nodes) {
        text += node.getHTML()
    }
    return text
}

