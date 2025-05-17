const TT = {
    Num: "NUM",
    Word: "WORD",
    String: "STRING",
    Add: "+",
    Sub: "-",
    Mul: "*",
    Div: "/",
    Lparen: "(",
    Rparen: ")",
    Comma: ",",
    Semi: ";",
    Eq: "=",
    Gt: ">",
    Lt: "<",
    Le: "<=",
    Ge: ">=",
    DEq: "==",
}

const keywords = [
    "var"
]

class Token {
    ty: keyof typeof TT
    value: string
    constructor(ty: keyof typeof TT, value: string) {
        this.ty = ty
        this.value = value
    }
}

// AST node types
class NodePar {
    children: NodePar[]
    constructor(child: NodePar | null = null) {
        /**@type {NodePar[]}*/
        this.children = []
        if (child) {
            this.children.push(child)
        }
    }

    addChild(child: NodePar) {
        this.children.push(child)
    }
}

class NumNode extends NodePar {
    value: number
    constructor(value: number) {
        super()
        this.value = value;
    }
}

class WordNode extends NodePar {
    value: string
    constructor(value: string) {
        super()
        this.value = value
    }
}

class StringNode extends NodePar {
    value: string
    constructor(value: string) {
        super()
        this.value = value
    }
}

class ErrorNode extends NodePar {
    value: string
    constructor(value: string) {
        super()
        this.value = value
    }
}

class RUnOpNode extends NodePar {
    left: NodePar
    operator: Token
    constructor(left: NodePar, operator: Token) {
        super()
        this.left = left
        this.operator = operator
    }
}
class LUnOpNode extends NodePar {
    right: NodePar
    operator: Token
    constructor(right: NodePar, operator: Token) {
        super()
        this.right = right
        this.operator = operator
    }
}

class BinOpNode extends NodePar {
    left: NodePar
    operator: Token
    right: NodePar
    constructor(left: NodePar, operator: Token, right: NodePar) {
        super(); // Use the first token type as default
        this.left = left;
        this.operator = operator;
        this.right = right;
    }
}

class VarDefNode extends NodePar {
    name: Token
    expr: NodePar
    constructor(name: Token, expr: NodePar) {
        super()
        this.name = name
        this.expr = expr
    }
}

class FuncDefNode extends NodePar {
    name: Token
    program: ProgramNode
    closure: SymbolTable
    constructor(name: Token, program: ProgramNode) {
        super()
        this.name = name
        this.program = program
        this.closure = new SymbolTable()
    }
}


class CallNode extends NodePar {
    callable: NodePar
    inner: NodePar[]
    constructor(callable: NodePar, inner: NodePar[]) {
        super()
        this.callable = callable
        this.inner = inner
    }
}

class ExprNode extends NodePar {
    value: NodePar
    constructor(value: NodePar) {
        super()
        this.value = value
    }
}

class ProgramNode extends NodePar { }

function parseExpression(input: string, symbols: SymbolTable) {
    const tokens = lex(input);
    let parser = new Parser(tokens)
    const tree = parser.ast()
    let int = new Interpreter(tree, symbols)
    let values = int.interpret()
    return values
    // return ast(tokens);
}

function buildNumber(text: string, curPos: number): [string, number] {
    let num = text[curPos]
    while ("0123456789".includes(text[++curPos])) {
        num += text[curPos]
    }
    return [num, curPos]
}

function buildWord(text: string, curPos: number): [string, number] {
    let word = text[curPos]
    while (text[++curPos]?.match(/[a-zA-Z0-9_]/)) {
        word += text[curPos]
    }
    return [word, curPos]
}

function buildString(text: string, curPos: number): [string, number] {
    let str = text[curPos]
    let escaped = false
    for (let i = curPos + 1; i < text.length; i++) {
        let ch = text[i]
        if (ch === "\\") {
            escaped = true
            continue
        }
        if (escaped) {
            switch (ch) {
                case 'n': ch = "\n"; break
                case 't': ch = "\t"; break
                case '\\': ch = '\\'; break
                default: ch = "\\" + ch
            }
        } else if (ch === '"') {
            break
        }
        str += ch
    }
    return [str, curPos + str.length + 1]
}

function lex(input: string): Token[] {
    let pos = 0;

    let tokens = [];

    while (pos < input.length) {
        let ch = input[pos]
        if ("0123456789".includes(ch)) {
            let [num, newPos] = buildNumber(input, pos)
            tokens.push(new Token("Num", num));
            pos = newPos
        }
        else if (ch.match(/[a-zA-Z_]/)) {
            let [word, newPos] = buildWord(input, pos)
            tokens.push(new Token("Word", word))
            pos = newPos
        }
        //ignore whitespace
        else if (!ch.trim()) {
            pos++
            continue
        }
        else if (ch === '"') {
            pos++
            let [str, newPos] = buildString(input, pos)
            pos = newPos
            tokens.push(new Token("String", str))
        }
        else if (ch === '=') {
            pos++
            if (input[pos] === '=') {
                pos++
                tokens.push(new Token("DEq", "=="))
            } else {
                tokens.push(new Token("Eq", "="))
            }
        } else if (ch === '<') {
            pos++
            if (input[pos] === "<=") {
                pos++
                tokens.push(new Token("Le", "<="))
            } else {
                tokens.push(new Token("Lt", "<"))
            }
        } else if (ch === ">") {
            pos++
            if (input[pos] === ">=") {
                pos++
                tokens.push(new Token("Ge", ">="))
            } else {
                tokens.push(new Token("Gt", ">"))
            }
        }
        else {
            let foundTok = false
            let tok: keyof typeof TT
            for (tok in TT) {
                if (ch === TT[tok]) {
                    tokens.push(new Token(tok, ch))
                    pos++
                    foundTok = true
                    break
                }
            }
            if (!foundTok) {
                console.error(`Invalid token: ${ch}`)
                pos++
            }
        }
    }

    return tokens;
}

class Parser {
    tokens: Token[]
    i: number
    constructor(tokens: Token[]) {
        this.i = 0
        this.tokens = tokens
    }

    next() {
        this.i++
        return this.i < this.tokens.length
    }

    back() {
        this.i--
    }

    curTok() {
        return this.tokens[this.i]
    }
    atom(): NodePar {
        let tok = this.curTok()
        if (!tok) return new ErrorNode("Ran out of tokens")

        this.next()

        if (tok.ty === "Num") {
            return new NumNode(Number(tok.value))
        }
        else if (tok.ty === "String") {
            return new StringNode(tok.value)
        } else if (tok.ty === "Lparen") {
            let node = this.ast_expr()
            if (!(this.curTok()?.ty === "Rparen")) {
                return new ErrorNode("Missing matching ')'")
            }
            this.next() //skip Rparen
            return node
        } else if (tok.ty === "Word") {
            return new WordNode(tok.value)
        }
        return new ErrorNode(`Invalid token: (${tok.ty} ${tok.value})`)
    }

    l_unop() {
        let tok = this.curTok()
        if ("+-".includes(tok.value)) {
            this.next()
            let right = this.atom()
            return new LUnOpNode(right, tok)
        }
        return this.atom()
    }

    r_unop(): NodePar {
        let left = this.l_unop()

        let tok = this.curTok()

        if (!tok) return left

        if (tok.ty == "Lparen") {
            return this.funcCall(left)
        }
        return left
    }

    binop(ops: string, lower: (this: Parser) => NodePar) {
        let left = lower.bind(this)()
        let op = this.curTok()
        while (op && ops.includes(op.value)) {
            this.next()
            let right = lower.bind(this)()
            left = new BinOpNode(left, op, right)
            op = this.curTok()
        }
        return left
    }

    factor() {
        return this.binop("*/", this.r_unop)
    }

    term() {
        return this.binop("+-", this.factor)
    }

    comparison() {
        let left = this.term()
        let op = this.curTok()
        while (op && ["<", ">", "<=", ">=", "=="].includes(op.value)) {
            this.next()
            let right = this.comparison()
            left = new BinOpNode(left, op, right)
            op = this.curTok()
        }
        return left
    }

    funcCall(callable: NodePar): NodePar {
        this.next() //skip Lparen
        if (this.curTok().ty === 'Rparen') {
            this.next()
            return new CallNode(callable, [])
        }
        let inner = [this.ast_expr()]
        while (this.curTok()?.ty === "Comma") {
            this.next()
            inner.push(this.ast_expr())
        }
        let node = new CallNode(callable, inner)
        if (this.curTok()?.ty !== 'Rparen') {
            console.error(`Invalid token: ${this.curTok().ty}, expected ")"`)
            return new NumNode(0)
        }
        this.next() //skip ")"
        return node
    }

    varDef(): NodePar {
        this.next() // skip "var"

        if (this.curTok().ty === "Lparen") {
            return this.funcDef()
        }

        let name = this.curTok()

        this.next()
        if (this.curTok()?.ty !== "Eq") {
            console.error("Expected '='")
            return new NumNode(0)
        }
        this.next()
        return new VarDefNode(name, this.ast_expr())
    }

    funcDef() {
        this.next() //skip "("
        this.next() //skip ")"

        let name = this.curTok()
        this.next()
        if (this.curTok()?.ty !== "Eq") {
            console.error("Expected '='")
            return new NumNode(0)
        }
        this.next()
        let program = this.program()
        if (this.curTok().ty !== "Word" || this.curTok().value !== "rav") {
            console.error("Expected 'rav'")
            return new NumNode(0)
        }
        this.next()
        return new FuncDefNode(name, program)
    }

    ast_expr() {
        let t = this.curTok()
        if (t.ty === "Word" && t.value === "var") {
            return this.varDef()
        }
        let expr = new ExprNode(this.comparison())
        return expr
    }

    program() {
        let program = new ProgramNode()
        program.addChild(this.ast_expr())
        while (this.curTok()?.ty === "Semi") {
            this.next()
            program.addChild(this.ast_expr())
        }
        return program
    }

    ast() {
        let root = new NodePar()
        let node = this.program()
        root.addChild(node)

        return node;
    }
}

class Type {
    jsValue: any
    constructor(jsValue: any) {
        this.jsValue = jsValue
    }

    jsStr() {
        return String(this.jsValue)
    }

    toStr() {
        return new Str(this.jsStr())
    }

    toNum() {
        return new Num(Number(this.jsValue))
    }

    add(right: Type) {
        console.error(`Unable to add ${this.constructor.name} and ${right.constructor.name}`)
        return right
    }
    sub(right: Type) {
        console.error(`Unable to add ${this.constructor.name} and ${right.constructor.name}`)
        return right
    }
    mul(right: Type) {
        console.error(`Unable to add ${this.constructor.name} and ${right.constructor.name}`)
        return right
    }
    div(right: Type) {
        console.error(`Unable to add ${this.constructor.name} and ${right.constructor.name}`)
        return right
    }

    lt(right: Type) {
        console.error(`Unable to compare ${this.constructor.name} < ${right.constructor.name}`)
        return new Num(0)
    }

    gt(right: Type) {
        console.error(`Unable to compare ${this.constructor.name} > ${right.constructor.name}`)
        return new Num(0)
    }

    eq(right: Type) {
        console.error(`Unable to compare ${this.constructor.name} == ${right.constructor.name}`)
        return new Num(0)
    }

    call(params: Type[]) {
        console.error(`Cannot call ${this.constructor.name}`)
        return new Num(0)
    }
}

class Entry extends Type {
    constructor(entry: InfoEntry) {
        super(entry)
    }

    jsStr(): string {
        const fragment = document.createElement("div")
        renderDisplayItem(this.jsValue, fragment)
        return String(fragment.innerHTML)
    }
}

class Func extends Type {
    constructor(fn: (...params: Type[]) => Type) {
        super(fn)
    }

    toStr(): Str {
        return new Str("[Function]")
    }

    call(params: Type[]) {
        return this.jsValue(...params)
    }
}

class Num extends Type {
    call(params: Type[]) {
        if (params.length > 1) {
            console.error("Multiple values to multiply number by")
            return new Num(this.jsValue)
        }
        return new Num(this.jsValue * params[0].toNum().jsValue)
    }

    add(right: Type) {
        return new Num(this.jsValue + right.toNum().jsValue)
    }

    sub(right: Type) {
        return new Num(this.jsValue - right.toNum().jsValue)
    }

    mul(right: Type) {
        return new Num(this.jsValue * right.toNum().jsValue)
    }

    div(right: Type) {
        return new Num(this.jsValue / right.toNum().jsValue)
    }

    lt(right: Type) {
        if (this.jsValue < Number(right.jsValue)) {
            return new Num(1)
        }
        return new Num(0)
    }

    gt(right: Type) {
        return new Num(Number(this.jsValue > Number(right.jsValue)))
    }

    eq(right: Type) {
        return new Num(Number(this.jsValue === right.toNum().jsValue))
    }

    toNum() {
        return this
    }
}

class Str extends Type {
    add(right: Type) {
        this.jsValue += String(right.jsValue)
        return this
    }
    sub(right: Type) {
        this.jsValue = this.jsValue.replaceAll(String(right.jsValue), "")
        return this
    }
    mul(right: Type) {
        this.jsValue = this.jsValue.repeat(Number(right.jsValue))
        return this
    }

    eq(right: Type) {
        return new Num(Number(this.jsValue === right.toStr().jsValue))
    }
}

class List extends Type {

    jsStr() {
        let str = ""
        for (let item of this.jsValue) {
            str += item.jsStr() + ","
        }
        return str.slice(0, -1)
    }

    eq(right: Type) {
        if (!(right instanceof List)) {
            return new Num(0)
        }

        let l = new Set(this.jsValue)
        let r = new Set(right.jsValue)
        if (l.difference(r).size === 0) {
            return new Num(1)
        }
        return new Num(0)
    }
}

class SymbolTable {
    symbols: Map<string, Type>
    constructor() {
        this.symbols = new Map()

        this.setupDefaultFunctions()
    }
    setupDefaultFunctions() {
        //@ts-ignore
        this.symbols.set("abs", new Func(n => {
            return new Num(Math.abs(n.toNum().jsValue))
        }))

        this.symbols.set("pow", new Func((x, y) => {
            return new Num(x.toNum().jsValue ** y.toNum().jsValue)
        }))

        this.symbols.set("len", new Func(n => {
            if (!(n instanceof Str)) {
                return new Num(0)
            }
            return new Num(n.jsValue.length)
        }))

        this.symbols.set("str", new Func(n => {
            return n.toStr()
        }))

        this.symbols.set("round", new Func(n => {
            if (!(n instanceof Num)) {
                return new Num(0)
            }
            return new Num(Math.round(n.jsValue))
        }))

        this.symbols.set("floor", new Func(n => {
            if (!(n instanceof Num)) {
                return new Num(0)
            }

            return new Num(Math.floor(n.jsValue))
        }))

        this.symbols.set("max", new Func((...items) => {
            let max = items[0].toNum()
            for (let item of items) {
                if (item.toNum().jsValue > max.jsValue) {
                    max = item
                }
            }
            return max
        }))

        this.symbols.set("min", new Func((...items) => {
            let min = items[0].toNum()
            for (let item of items) {
                if (item.toNum().jsValue < min.jsValue) {
                    min = item
                }
            }
            return min
        }))

        this.symbols.set("int", new Func((n) => {
            return new Num(BigInt(n.jsStr()))
        }))

        this.symbols.set("openbyid", new Func((id) => {
            const jsId = id.toNum().jsValue
            if(typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            if(mode_isSelected(jsId)) {
                return new Str(`${id} already selected`)
            }
            const entry = findInfoEntryById(jsId)

            if(!entry) {
                return new Str(`${id} not found`)
            }

            selectItem(entry, mode)
            return new Str("")
        }))

        this.symbols.set("clear", new Func(() => {
            if("clear" in mode) {
                mode.clear()
                return new Num(0)
            }
            return new Num(1)
        }))

        this.symbols.set("put", new Func((...values) => {
            if("put" in mode) {
                for(let str of values.map(v => v.jsStr())) {
                    mode.put(str)
                }
                return new Str("")
            }
            return new Num(1)
        }))

        this.symbols.set("clearitems", new Func(() => {
            clearItems()
            return new Num(0)
        }))

        this.symbols.set("setrating", new Func((...params) => {
            let [itemId, newRating, done] = params;
            api_setRating(BigInt(itemId.jsStr()), newRating.jsStr()).then(async(res) => {
                if (!res) {
                    if (done) {
                        done.call([new Str("FAIL"), new Num(0)])
                    }
                    return
                }
                if (done) {
                    done.call([new Str(await res.text()), new Num(res.status)])
                }
            })
            return new Num(0)
        }))
    }
    set(name: string, value: Type) {
        this.symbols.set(name, value)
    }
    get(name: string) {
        return this.symbols.get(name)
    }

    copy() {
        let copy = new SymbolTable()
        for (let item of this.symbols.entries()) {
            copy.set(item[0], item[1])
        }
        return copy
    }
}

class Interpreter {
    tree: NodePar
    symbolTable: SymbolTable
    constructor(tree: NodePar, symbolTable: SymbolTable) {
        this.tree = tree
        this.symbolTable = symbolTable
    }

    NumNode(node: NumNode) {
        return new Num(node.value)
    }

    StringNode(node: WordNode) {
        return new Str(node.value)
    }

    WordNode(node: WordNode) {
        if (this.symbolTable.get(node.value)) {
            return this.symbolTable.get(node.value)
        }
        return new Str(node.value)
    }

    LUnOpNode(node: LUnOpNode) {
        let right = this.interpretNode(node.right)
        if (node.operator.ty === "Add") {
            return right
        } else {
            return right.mul(new Num(-1))
        }
    }

    BinOpNode(node: BinOpNode) {
        let left = this.interpretNode(node.left)
        let right = this.interpretNode(node.right)

        if (node.operator.ty === "Add") {
            return left.add(right)
        } else if (node.operator.ty === "Sub") {
            return left.sub(right)
        } else if (node.operator.ty === "Mul") {
            return left.mul(right)
        } else if (node.operator.ty === "Div") {
            return left.div(right)
        } else if (node.operator.ty === "DEq") {
            return left.eq(right)
        } else if (node.operator.ty === "Lt") {
            return left.lt(right)
        } else if (node.operator.ty === "Gt") {
            return left.gt(right)
        } else if (node.operator.ty === "Ge") {
            if (left.gt(right) || left.eq(right)) {
                return new Num(1)
            }
            return new Num(0)
        } else if (node.operator.ty === "Le") {
            if (left.lt(right) || left.eq(right)) {
                return new Num(1)
            }
            return new Num(0)
        }
        return right
    }

    interpretNode(node: NodePar): Type {
        //@ts-ignore
        return this[node.constructor.name](node)
    }

    ErrorNode(node: ErrorNode) {
        console.error(node.value)
        return new Str(node.value)
    }

    CallNode(node: CallNode): Type {
        let inner = node.inner.map(this.interpretNode.bind(this))
        let callable = this.interpretNode(node.callable)
        return callable.call(inner)
    }

    VarDefNode(node: VarDefNode) {
        let val = this.interpretNode(node.expr)
        this.symbolTable.set(node.name.value, val)
        return val
    }

    FuncDefNode(node: FuncDefNode) {
        node.closure = this.symbolTable.copy()

        this.symbolTable.set(node.name.value, new Func((...items) => {
            for (let i = 0; i < items.length; i++) {
                node.closure.set(`arg${i}`, items[i])
            }
            let interpreter = new Interpreter(node.program, node.closure)
            return interpreter.interpretNode(node.program)
        }))

        return this.symbolTable.get(node.name.value)
    }

    ExprNode(node: ExprNode) {
        return this.interpretNode(node.value)
    }

    ProgramNode(node: ProgramNode) {
        let values = []
        for (let child of node.children) {
            if (!(child.constructor.name in this)) {
                console.error(`Unimplmemented: ${child.constructor.name}`)
            } else {
                values.push(this.interpretNode(child))
            }
        }
        return values.slice(-1)[0]
    }

    interpret() {
        return this.interpretNode(this.tree)
    }
}

function jsVal2CalcVal(value: any): Type {
    switch (typeof value) {
        case 'string':
            return new Str(value)
        case 'number':
            return new Num(value)
        case 'boolean':
            return new Num(Number(value))
        case 'bigint':
            return new Num(BigInt(value))
        case 'function':
            return new Func(function() {
                return jsVal2CalcVal(value(...arguments))
            })
        default:
            return new Num(NaN)
    }
}

function makeSymbolsTableFromObj(obj: object): SymbolTable {
    let symbols = new SymbolTable()
    for (let name in obj) {
        //@ts-ignore
        let val = obj[name]
        let t = jsVal2CalcVal(val)
        if (symbols.get(name)) {
            name = `${name}2`
        }
        symbols.set(name, t)
    }
    return symbols
}
