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
    Lbracket: "[",
    Rbracket: "]",
    Comma: ",",
    Semi: ";",
    Eq: "=",
    Gt: ">",
    Lt: "<",
    Le: "<=",
    Ge: ">=",
    DEq: "==",
    NEq: "<>",
    Arrow: "->",
    TransformArrow: "=>",
    FilterArrow: "?>",
    Colon: ":",
    Bs: "\\"
}

const keywords = [
    "let", "var", "fun",
    "and", "or",
    "while",
    "for",
    "foreach",
    "rav",
    "rof",
    "do",
    "if",
    "else",
    "fi"
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

    serialize(): string {
        return ""
    }
}

class NumNode extends NodePar {
    value: number
    constructor(value: number) {
        super()
        this.value = value;
    }
    serialize(): string {
        return `${this.value}`
    }
}

class ArrNode extends NodePar {
    nodes: NodePar[]
    constructor(nodes: NodePar[]) {
        super(nodes[0])
        this.nodes = nodes
    }
    serialize(): string {
        return `[ ${this.nodes.map(v => v.serialize()).join(", ")} ]`
    }
}

class WordNode extends NodePar {
    value: string
    constructor(value: string) {
        super()
        this.value = value
    }

    serialize(): string {
        return this.value
    }
}

class StringNode extends NodePar {
    value: string
    constructor(value: string) {
        super()
        this.value = value
    }

    serialize(): string {
        return `"${this.value}"`
    }
}

class EscapedNode extends NodePar {
    value: NodePar
    constructor(value: NodePar) {
        super(value)
        this.value = value
    }

    serialize(): string {
        return `(${this.value.serialize()})`
    }
}

class ErrorNode extends NodePar {
    value: string
    constructor(value: string) {
        super()
        this.value = value
    }
    serialize(): string {
        return `ERROR(${this.value})`
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

    serialize(): string {
        return `${this.left.serialize()}${this.operator.value}`
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

    serialize(): string {
        return `${this.operator.value}${this.right.serialize()}`
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

    serialize(): string {
        return `${this.left.serialize()} ${this.operator.value} ${this.right.serialize()}`
    }
}

class PipeFunNode extends NodePar {
    input: NodePar
    funs: FuncDefNode[]
    constructor(input: NodePar, funs: FuncDefNode[]) {
        super()
        this.input = input
        this.funs = funs
    }

    serialize(): string {
        return `${this.input.serialize()} ${this.funs.map(v => {
            switch (v.paramNames[0].ty) {
                case "FilterArrow":
                    return `?> ${v.program.serialize()} `
                case "TransformArrow":
                    return `=> ${v.program.serialize()} `
            }
        })}`
    }
}

class PipeNode extends NodePar {
    constructor(children: NodePar[]) {
        super()
        this.children = children
    }

    serialize(): string {
        return `${this.children.map(v => v.serialize()).join(" -> ")}`
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

    serialize(): string {
        return `var ${this.name.value} = ${this.expr.serialize()}`
    }
}

class WhileNode extends NodePar {
    condition: NodePar
    body: NodePar
    returnType: "last" | "list"
    constructor(condition: NodePar, body: NodePar, returnType: "last" | "list") {
        super()
        this.body = body
        this.condition = condition
        this.returnType = returnType
    }
}

class ForNode extends NodePar {
    varName: Token
    start: NodePar
    end: NodePar
    body: NodePar
    returnType: "last" | "list"
    constructor(varName: Token, start: NodePar, end: NodePar, body: NodePar, returnType: "last" | "list") {
        super()
        this.varName = varName
        this.start = start
        this.end = end
        this.body = body
        this.returnType = returnType
    }

    serialize(): string {
        return `for ${this.varName.value} = ${this.start.serialize()}, ${this.end.serialize()} ${this.returnType === "last" ? "do" : ":"} ${this.body.serialize()} rof`
    }
}

class ForEachNode extends NodePar {
    varName: Token
    of: NodePar
    body: NodePar
    returnType: "last" | "list"
    constructor(varName: Token, of: NodePar, body: NodePar, returnType: "last" | "list") {
        super()
        this.varName = varName
        this.of = of
        this.body = body
        this.returnType = returnType
    }

    serialize(): string {
        return `foreach ${this.varName.value} in ${this.of.serialize()} ${this.returnType === "last" ? "do" : ":"} ${this.body.serialize()} rof`
    }
}

class IfNode extends NodePar {
    condition: NodePar
    body: NodePar
    elsePart: NodePar
    constructor(condition: NodePar, body: NodePar, elsePart: NodePar) {
        super()
        this.body = body
        this.condition = condition
        this.elsePart = elsePart
    }

    serialize(): string {
        return `if ${this.condition.serialize()} do ${this.body.serialize} eles ${this.elsePart.serialize()} fi`
    }
}

class FuncDefNode extends NodePar {
    name: Token
    program: ProgramNode
    paramNames: Token[]
    constructor(name: Token, program: ProgramNode, paramNames: Token[]) {
        super()
        this.name = name
        this.program = program
        this.paramNames = paramNames
    }

    serialize(): string {
        return `fun ${this.name.value}(${this.paramNames.map(v => v.value).join(" ")}) ${this.program.serialize()}`
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

    serialize(): string {
        return `${this.callable.serialize()}(${this.inner.map(v => v.serialize()).join(", ")})`
    }
}

class PropertyAccessNode extends NodePar {
    of: NodePar
    value: NodePar
    constructor(of: NodePar, value: NodePar) {
        super(value)
        this.value = value
        this.of = of
    }

    serialize(): string {
        return `${this.of.serialize()}[${this.value.serialize()}]`
    }
}

class ExprNode extends NodePar {
    value: NodePar
    constructor(value: NodePar) {
        super()
        this.value = value
    }

    serialize(): string {
        return this.value.serialize()
    }
}

class ProgramNode extends NodePar {
    serialize(): string {
        return this.children.map(v => v.serialize()).join(";\n")
    }
}

function parseExpression(input: string, symbols: CalcVarTable) {
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
            } else if (input[pos] === ">") {
                pos++
                tokens.push(new Token("TransformArrow", "=>"))
            } else {
                tokens.push(new Token("Eq", "="))
            }
        } else if (ch === '<') {
            pos++
            if (input[pos] === "=") {
                pos++
                tokens.push(new Token("Le", "<="))
            } else if (input[pos] == ">") {
                pos++
                tokens.push(new Token("NEq", "<>"))
            } else {
                tokens.push(new Token("Lt", "<"))
            }
        } else if (ch === ">") {
            pos++
            if (input[pos] === "=") {
                pos++
                tokens.push(new Token("Ge", ">="))
            } else {
                tokens.push(new Token("Gt", ">"))
            }
        }
        else if (ch === "-") {
            pos++
            if (input[pos] === ">") {
                pos++
                tokens.push(new Token("Arrow", "->"))
            } else {
                tokens.push(new Token("Sub", "-"))
            }
        } else if (ch === "?") {
            pos++
            if (input[pos] === ">") {
                pos++
                tokens.push(new Token("FilterArrow", "?>"))
            } else {
                console.error(`Invalid token: ${ch}`)
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
        else if (tok.ty == "Bs") {
            let v = this.atom()
            return new EscapedNode(v)
        }
        else if (tok.ty == "Lbracket") {
            let nodes: NodePar[] = []
            tok = this.curTok()
            while (tok?.ty !== "Rbracket") {
                let item = this.ast_expr()
                nodes.push(item)
                tok = this.curTok()
                if (tok?.ty === "Comma") {
                    this.next()
                }
                tok = this.curTok()
            }
            this.next()
            return new ArrNode(nodes)
        }
        else if (tok.ty === "String") {
            return new StringNode(tok.value)
        } else if (tok.ty === "Lparen") {
            let node = this.program()
            if (!(this.curTok()?.ty === "Rparen")) {
                return new ErrorNode("Missing matching ')'")
            }
            this.next() //skip Rparen
            return node
        } else if (tok.ty === "Word") {
            if (tok.ty === "Word") {
                switch (tok.value) {
                    case "var":
                    case "fun":
                    case "let":
                        return this.varDef()
                    case "while":
                        return this.whileLoop()
                    case "foreach":
                        return this.forEachLoop()
                    case "for":
                        return this.forLoop()
                    case "if":
                        return this.ifStatement()
                }
            }
            return new WordNode(tok.value)
        }
        return new ErrorNode(`Invalid token: (${tok.ty} ${tok.value})`)
    }

    l_unop() {
        let tok = this.curTok()
        let right
        while ("+-".includes(tok?.value)) {
            this.next()
            right ||= this.atom()
            right = new LUnOpNode(right, tok)
            tok = this.curTok()
        }
        return right || this.atom()
    }

    r_unop(): NodePar {
        let left = this.l_unop()

        let tok = this.curTok()

        if (!tok) return left

        while (tok?.ty == "Lparen" || tok?.ty == "Lbracket") {
            switch (tok.ty) {
                case "Lparen":
                    left = this.funcCall(left)
                    tok = this.curTok()
                    break
                case "Lbracket":
                    left = this.propertyAccess(left)
                    tok = this.curTok()
                    break
            }
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
        while (op && ["<", ">", "<=", ">=", "==", "<>"].includes(op.value)) {
            this.next()
            let right = this.comparison()
            left = new BinOpNode(left, op, right)
            op = this.curTok()
        }
        return left
    }

    logicalComp() {
        let left = this.comparison()
        let logic = this.curTok()
        while (logic?.ty === "Word" && ["and", "or", "xor", "nand"].includes(logic.value)) {
            this.next()
            let right = this.logicalComp()
            left = new BinOpNode(left, logic, right)
            logic = this.curTok()
        }
        return left
    }

    //filter (?>) and map (=>)
    pipeOPS() {
        let left = this.logicalComp()
        let op = this.curTok()
        let funs = []
        while (["TransformArrow", "FilterArrow"].includes(op?.ty)) {
            this.next()
            let right = this.logicalComp()
            let f = new FuncDefNode(new Token("Word", ""), right, [op])
            funs.push(f)
            op = this.curTok()
        }
        if (funs.length) {
            return new PipeFunNode(left, funs)
        }
        return left
    }

    pipe() {
        let left = [this.pipeOPS()]
        let tok = this.curTok()
        while (tok?.ty === "Arrow") {
            this.next()
            let right = this.pipeOPS()
            left.push(right)
            tok = this.curTok()
        }
        return new PipeNode(left)
    }

    propertyAccess(of: NodePar) {
        this.next() //skip [
        let val = this.ast_expr()
        if (this.curTok()?.ty !== "Rbracket") {
            console.error("Expected ']'")
            return new NumNode(0)
        }
        this.next()
        return new PropertyAccessNode(of, val)
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
        //lambda
        if (this.curTok().ty === "Lparen") {
            return this.funcDef(new Token("Word", `lambda_${String(Math.random()).replace("0.", "")}`))
        }

        let name = this.curTok()
        this.next()

        if (this.curTok().ty === "Lparen") {
            return this.funcDef(name)
        }

        if (this.curTok()?.ty !== "Eq") {
            console.error("Expected '='")
            return new NumNode(0)
        }
        this.next()
        return new VarDefNode(name, this.ast_expr())
    }

    whileLoop(): NodePar {
        let condition = this.ast_expr()

        if ((this.curTok()?.ty !== "Word" || this.curTok()?.value !== "do") && this.curTok()?.ty !== "Colon") {
            console.error("Expected 'do' or ':' after while")
            return new NumNode(0)
        }

        const rtType = this.curTok()?.value === "do" ? "last" : "list" as const

        this.next()

        let body = this.ast_expr()

        if (this.curTok()?.ty === "Word" && ["fi", "elihw", "done"].includes(this.curTok()?.value)) {
            this.next()
        }
        return new WhileNode(condition, body, rtType)
    }

    ifStatement(): NodePar {
        let condition = this.ast_expr()

        if ((this.curTok()?.ty !== "Word" || this.curTok()?.value !== "do")) {
            console.error("Expected 'do' or ':' after if")
            return new NumNode(0)
        }
        this.next()

        let body = this.atom()

        let elsePart: NodePar = new NumNode(0)
        if (this.curTok()?.ty === "Word" && this.curTok()?.value === "else") {
            this.next()
            elsePart = this.atom()
        }

        if (this.curTok()?.ty === "Word" && this.curTok()?.value === "fi") {
            this.next()
        }

        return new IfNode(condition, body, elsePart)
    }

    forEachLoop(): NodePar {
        if (this.curTok()?.ty !== "Word") {
            return new ErrorNode("Expected variable name after 'foreach'")
        }

        let name = this.curTok()
        this.next()

        //be nice and dont require 'in' after var name
        if (this.curTok()?.ty === "Word" && this.curTok()?.value === "in") {
            this.next()
        }

        let of = this.ast_expr()

        if ((this.curTok().ty !== "Word" || this.curTok().value !== "do") && this.curTok()?.ty !== "Colon") {
            console.error("Expected 'do' or ':'")
            return new NumNode(0)
        }

        const rtType = this.curTok()?.value === "do" ? "last" : "list" as const

        this.next()

        let body = this.ast_expr()

        if (this.curTok()?.ty !== "Word" || this.curTok()?.value !== "rof") {
            return new ErrorNode("Expected 'rof' after 'foreach'")
        }

        this.next()

        return new ForEachNode(name, of, body, rtType)
    }

    forLoop(): NodePar {
        if (this.curTok().ty !== "Word") {
            console.error("Expected variable name")
            return new NumNode(0)
        }
        const name = this.curTok()
        this.next()
        if (this.curTok().ty !== "Eq") {
            console.error("Expected =")
            return new NumNode(0)
        }
        this.next()
        let start = this.ast_expr()
        if (this.curTok().ty !== "Comma") {
            console.error("Expected comma")
            return new NumNode(0)
        }
        this.next() //skip comma
        let end = this.ast_expr()

        if ((this.curTok().ty !== "Word" || this.curTok().value !== "do") && this.curTok()?.ty !== "Colon") {
            console.error("Expected 'do' or ':'")
            return new NumNode(0)
        }

        const rtType = this.curTok()?.value === "do" ? "last" : "list" as const

        this.next()

        let body = this.ast_expr()

        if (this.curTok()?.ty !== "Word" || this.curTok()?.value !== "rof") {
            console.error("Expected 'rof'")
            return new NumNode(0)
        }

        this.next()

        return new ForNode(name, start, end, body, rtType)
    }

    funcDef(name: Token) {
        let paramNames: Token[] = []
        this.next() //skip "("
        while (this.curTok()?.ty !== "Rparen" && this.curTok()?.ty === "Word") {
            paramNames.push(this.curTok())
            this.next()

            //be friendly and skip the comma
            if (this.curTok()?.ty === "Comma") {
                this.next()
            }
        }
        if (this.curTok()?.ty !== "Rparen") {
            console.error("Expected ')'")
            return new NumNode(0)
        }
        this.next() //skip ")"

        //= is optional
        if (this.curTok()?.ty === "Eq") {
            this.next()
        }

        let program = this.program()
        if (this.curTok().ty !== "Word" || this.curTok().value !== "rav") {
            console.error("Expected 'rav'")
            return new NumNode(0)
        }
        this.next()
        return new FuncDefNode(name, program, paramNames)
    }

    ast_expr() {
        let expr = new ExprNode(this.pipe())
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

    static from(value: any): Type {
        if (value instanceof HTMLElement) {
            return new Elem(value)
        } else if (value instanceof Type) {
            return value
        }

        else if (Array.isArray(value)) {
            let arr = []
            for (let item of value) {
                arr.push(Type.from(item))
            }
            return new Arr(arr)
        }

        switch (typeof value) {
            case 'string':
                return new Str(value)
            case 'number':
            case 'bigint':
                return new Num(value)
            case 'boolean':
                return new Num(Number(value))
            case 'symbol':
                return new Str(String(value))
            case 'undefined':
                return new Str("undefined")
            case 'object':
                if (value instanceof Type) {
                    return value
                } else if (probablyUserItem(value) || probablyInfoEntry(value) || probablyMetaEntry(value)) {
                    return new EntryTy(value)
                }
                let o: Record<string, Type> = {}
                for (let key in value) {
                    o[key] = Type.from(value[key])
                }
                return new Obj(o)
            case 'function':
                return new Func(function() {
                    return Type.from(value(...arguments))
                })
        }
    }


    len(): Num {
        console.error(`Unable to get the len of ${this.constructor.name}`)
        return new Num(0)
    }

    truthy() {
        return false
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

    call(params: Type[]): Type {
        console.error(`Cannot call ${this.constructor.name}`)
        return new Num(0)
    }

    getattr(prop: Type): Type {
        console.error(`Unable to access ${prop.jsStr()} in ${this.constructor.name}`)
        return new Num(0)
    }

    setattr(name: Type, value: Type): Type {
        console.error(`Unable to set property ${name.jsStr()} in ${this.constructor.name}`)
        return new Num(0)
    }
}

class Elem extends Type {
    el: HTMLElement
    constructor(element: HTMLElement) {
        super(element)
        this.el = element
    }

    add(right: Type): Type {
        if (!(right instanceof Elem)) {
            return new Num(0)
        }

        this.el.appendChild(right.el)
        return this
    }

    jsStr(): string {
        return this.el.innerHTML
    }

    toStr(): Str {
        return new Str(this.jsStr())
    }

    setattr(name: Type, value: Type): Type {
        this.el.setAttribute(name.jsStr(), value.jsStr())
        return this
    }

    getattr(prop: Type): Type {
        return new Str(this.el.getAttribute(prop.jsStr()))
    }
}

class Code extends Type {
    code: ProgramNode
    constructor(code: ProgramNode) {
        super(code)
        this.code = code
    }

    len(): Num {
        return new Num(this.code.children.length)
    }

    truthy(): boolean {
        let int = new Interpreter(this.code, new CalcVarTable)
        return int.interpret().truthy()
    }

    call(params: Type[]): Type {
        let tbl = new CalcVarTable()
        for (let i = 0; i < params.length; i++) {
            tbl.set(`arg${i}`, params[i])
        }
        let int = new Interpreter(this.code, tbl)
        return int.interpret()
    }

    jsStr(): string {
        return this.code.serialize()
    }

    toStr(): Str {
        return new Str(this.jsStr())
    }

    add(right: Type): Type {
        if (!(right instanceof Code)) {
            return super.add(right)
        }

        let cpy = new ProgramNode
        cpy.children = [...this.code.children, ...right.code.children]
        return new Code(cpy)
    }

    getattr(prop: Type): Type {
        return new Code(new ProgramNode(this.code.children[prop.toNum().jsValue]))
    }
}

class Arr extends Type {
    constructor(values: Type[]) {
        super(values)
    }

    truthy(): boolean {
        return this.jsValue.length > 0
    }

    len(): Num {
        return new Num(this.jsValue.length)
    }

    call(params: Type[]) {
        let idx = params[0].toNum().jsValue
        return this.jsValue[idx]
    }

    toStr(): Str {
        let str = ""
        for (let item of this.jsValue) {
            str += item.jsStr()
        }
        return new Str(str)
    }

    jsStr(): string {
        return this.toStr().jsValue
    }

    toNum(): Num {
        return this.jsValue.reduce((p: Type, c: Type) => p.toNum().add(c), new Num(0))
    }

    getattr(prop: Type): Type {
        return this.call([prop])
    }

    setattr(name: Type, value: Type): Type {
        return this.jsValue[name.toNum().jsValue] = value
    }
}

class Obj extends Type {
    constructor(value: object) {
        super(value)
    }

    truthy(): boolean {
        return Object.keys(this.jsValue).length > 0
    }

    jsStr(): string {
        return JSON.stringify(this.jsValue, (_, v) => {
            if (typeof v === 'bigint') {
                return String(v)
            }
            if (v instanceof Obj) {
                return v.jsValue
            }
            if (v instanceof Type) {
                return v.jsStr()
            }
            return v
        })
    }

    toStr(): Str {
        return new Str(this.jsStr())
    }

    call(params: Type[]) {
        let curObj = this.jsValue
        for (let param of params) {
            curObj = curObj[param.jsStr()]
        }

        return Type.from(curObj)
    }

    getattr(prop: Type): Type {
        return this.call([prop])
    }

    setattr(name: Type, value: Type): Type {
        return this.jsValue[name.jsStr()] = value
    }
}

class EntryTy extends Type {
    constructor(entry: InfoEntry | MetadataEntry | UserEntry) {
        //create a copy, dont let the user accidentally fuck shit up
        super({ ...entry })
    }

    truthy(): boolean {
        return true
    }

    toNum(): Num {
        return new Num(this.jsValue["ItemId"])
    }

    jsStr(): string {
        return (new Obj(this.jsValue)).jsStr()
    }

    toStr(): Str {
        return new Str(this.jsStr())
    }

    getattr(prop: Type): Type {
        let name = prop.jsStr()
        let v = this.jsValue[name]
        if (name === "Thumbnail" && probablyMetaEntry(this.jsValue)) {
            //be nice and dont make the user fix the thumbnail
            return new Str(fixThumbnailURL(v))
        }
        switch (typeof v) {
            case 'string':
                return new Str(v)
            case 'number':
            case 'bigint':
                return new Num(v)
            case 'boolean':
                return new Num(Number(v))
            case 'symbol':
                return new Str(String(v))
            case 'undefined':
                return new Str("undefined")
            case 'object':
                return new Str(JSON.stringify(v, (_, v) => typeof v === "bigint" ? String(v) : v))
            case 'function':
                return new Str(String(v))
        }
    }

    setattr(name: Type, value: Type): Type {
        let n = name.jsStr()
        if (n === "ItemId" || n === "Uid") {
            console.error(`name cannot be ItemId or Uid`)
            return new Num(0)
        }
        return this.jsValue[n] = value.jsValue
    }
}

class Func extends Type {
    constructor(fn: (...params: Type[]) => Type) {
        super(fn)
    }

    truthy(): boolean {
        return true
    }

    jsStr(): string {
        return "[Function]"
    }

    toStr(): Str {
        return new Str(this.jsStr())
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
        if (params.length < 1) {
            return this
        }
        return new Num(this.jsValue * params[0].toNum().jsValue)
    }

    truthy(): boolean {
        return this.jsValue !== 0
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
        this.jsValue += right.jsStr()
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

    truthy(): boolean {
        return this.jsValue.length !== 0
    }

    len(): Num {
        return new Num(this.jsValue.length)
    }

    getattr(prop: Type): Type {
        return new Str(this.jsValue[prop.toNum().jsValue])
    }
}

class CalcVarTable {
    symbols: Map<string, Type>
    constructor() {
        this.symbols = new Map()

        this.setupDefaultFunctions()
    }
    setupDefaultFunctions() {

        this.symbols.set("eval", new Func(code => {
            if (!(code instanceof Code)) {
                return new Num(0)
            }
            let int = new Interpreter(code.code, this)
            return int.interpret()
        }))

        this.symbols.set("true", new Num(1))
        this.symbols.set("false", new Num(0))
        this.symbols.set("end", new Str(""))

        this.symbols.set("len", new Func(n => {
            return n.len()
        }))

        this.symbols.set("str", new Func(n => {
            return n.toStr()
        }))

        this.symbols.set("join", new Func((arr, by) => {
            if (!(arr instanceof Arr)) {
                return new Num(0)
            }

            const byStr = by.jsStr()
            let str = ""
            for (let i = 0; i < arr.jsValue.length; i++) {
                if (i !== arr.jsValue.length - 1) {
                    str += arr.jsValue[i].jsStr() + byStr
                } else {
                    str += arr.jsValue[i].jsStr()
                }
            }
            return new Str(str)
        }))

        //@ts-ignore
        this.symbols.set("abs", new Func(n => {
            return new Num(Math.abs(n.toNum().jsValue))
        }))

        this.symbols.set("pow", new Func((x, y) => {
            return new Num(x.toNum().jsValue ** y.toNum().jsValue)
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

        this.symbols.set("type", new Func(i => {
            return new Str(i.constructor.name)
        }))

        this.symbols.set("map", new Func((list, fn) => {

            let newList = []
            let len = list.len().jsValue
            for (let i = 0; i < len; i++) {
                let item = list.getattr(new Num(i))
                newList.push(fn.call([item]))
            }

            return new Arr(newList)
        }))

        this.symbols.set("sort", new Func((list, fn) => {
            if (!(list instanceof Arr)) {
                return new Num(1)
            }

            return new Arr(list.jsValue.sort((a: Type, b: Type) => fn.call([a, b]).toNum().jsValue))
        }))

        this.symbols.set("slice", new Func((list, start, end) => {
            let newList = []
            let len = list.len().jsValue
            let s = 0, e = len

            if (start && !end) {
                e = start.toNum().jsValue
            } else if (start && end) {
                s = start.toNum().jsValue
                e = end.toNum().jsValue
            }

            for (let i = s; i < e; i++) {
                newList.push(list.getattr(new Num(i)))
            }
            return new Arr(newList)
        }))

        this.symbols.set("shuf", new Func((list) => {
            let len = list.len().jsValue
            let curIdx = len
            while (curIdx != 0) {
                let randIdx = Math.floor(Math.random() * curIdx)
                curIdx--

                let cur = list.getattr(new Num(curIdx))
                let rand = list.getattr(new Num(randIdx))
                list.setattr(new Num(curIdx), rand)
                list.setattr(new Num(randIdx), cur)
            }
            return list
        }))

        this.symbols.set("randitem", new Func(list => {
            let len = list.len().jsValue
            let idx = Math.floor(Math.random() * len)
            return list.getattr(new Num(idx))
        }))

        this.symbols.set("rand", new Func((low, high) => {
            let l = 0, h = 100
            if (low && !high) {
                h = low.toNum().jsValue
            } else if (low && high) {
                l = low.toNum().jsValue
                h = high.toNum().jsValue
            }

            return new Num(Math.floor(Math.random() * (h - l) + l))
        }))

        this.symbols.set("filter", new Func((list, fn) => {
            let newList = []
            let len = list.len().jsValue
            for (let i = 0; i < len; i++) {
                let item = list.getattr(new Num(i))
                if (fn.call([item]).truthy()) {
                    newList.push(item)
                }
            }

            return new Arr(newList)
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

        this.symbols.set("num", new Func(n => {
            return n.toNum()
        }))

        this.symbols.set("pow", new Func((x, y) => {
            return new Num(Math.pow(x.toNum().jsValue, y.toNum().jsValue))
        }))

        this.symbols.set("set", new Func((obj, name, val) => {
            obj.setattr(name, val)
            return obj
        }))
        this.symbols.set("get", new Func((obj, name) => {
            return obj.getattr(name)
        }))

        this.symbols.set("obj", new Func((...items) => {
            if (items.length % 2 !== 0) {
                return new Num(0)
            }
            let obj: Record<string, Type> = {}
            for (let i = 0; i < items.length; i += 2) {
                obj[items[i].jsStr()] = items[i + 1]
            }
            return new Obj(obj)
        }))

        const findByid = (id: Type, finder: (id: bigint | "s-rand" | "a-rand") => Type) => {
            const s = id.jsStr()
            if (s === "s-rand") {
                return finder(s)
                // return new Obj(globalsNewUi.results[Math.floor(Math.random() * globalsNewUi.results.length)])
            } else if (s === "a-rand") {
                // const v = Object.values(globalsNewUi.entries)
                return finder(s)
                // return new Obj(v[Math.floor(Math.random() * v.length)])
            }

            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            const entry = finder(jsId)

            if (!entry) {
                return new Str(`${id} not found`)
            }

            return entry
        }

        this.symbols.set("confirm", new Func((p) => {
            let pText = p.jsStr()
            return new Num(confirm(pText) ? 1 : 0)
        }))

        this.symbols.set("ask", new Func((p) => {
            const pText = p.jsStr()
            return new Str(prompt(pText) ?? "")
        }))
        this.symbols.set("prompt", this.symbols.get("ask") as Type)

        this.symbols.set("getall", new Func((of) => {
            let v = of.jsStr()
            if (v === "entry" || v === "info") {
                return new Arr(Object.values(globalsNewUi.entries).map(v => new EntryTy(v.info)))
            } else if (v === "user") {
                return new Arr(Object.values(globalsNewUi.entries).map(v => new EntryTy(v.user)))
            } else if (v === "meta") {
                return new Arr(Object.values(globalsNewUi.entries).map(v => new EntryTy(v.meta)))
            }
            return new Arr([])
        }))

        this.symbols.set("children", new Func(id => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            let children = [...findDescendants(jsId)]

            return new Arr(children.map(v => new EntryTy(v.info)))
        }))

        this.symbols.set("copies", new Func(id => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            let children = [...findCopies(jsId)]

            return new Arr(children.map(v => new EntryTy(v.info)))
        }))

        this.symbols.set("entry", new Func((id) => {
            return findByid(id, i => {
                switch (i) {
                    case "s-rand":
                        return new EntryTy(globalsNewUi.results[Math.floor(Math.random() * globalsNewUi.results.length)].info)
                    case "a-rand":
                        const v = Object.values(globalsNewUi.entries)
                        return new EntryTy(v[Math.floor(Math.random() * v.length)].info)
                    default:
                        return new EntryTy(findInfoEntryById(i) as InfoEntry)
                }
            })
        }))

        this.symbols.set("meta", new Func((id) => {
            return findByid(id, i => {
                switch (i) {
                    case "s-rand":
                        return new EntryTy(findMetadataById(globalsNewUi.results[Math.floor(Math.random() * globalsNewUi.results.length)].info.ItemId) as MetadataEntry)
                    case "a-rand":
                        const v = Object.values(globalsNewUi.entries)
                        return new EntryTy(findMetadataById(v[Math.floor(Math.random() * v.length)].info.ItemId) as MetadataEntry)
                    default:
                        return new EntryTy(findMetadataById(i) as MetadataEntry)
                }
            })
        }))

        this.symbols.set("user", new Func((id) => {
            return findByid(id, i => {
                switch (i) {
                    case "s-rand":
                        return new EntryTy(findUserEntryById(globalsNewUi.results[Math.floor(Math.random() * globalsNewUi.results.length)].ItemId) as UserEntry)
                    case "a-rand":
                        const v = Object.values(globalsNewUi.entries)
                        return new EntryTy(findUserEntryById(v[Math.floor(Math.random() * v.length)].ItemId) as UserEntry)
                    default:
                        return new EntryTy(findUserEntryById(i) as UserEntry)
                }
            })
        }))

        this.symbols.set("withfmt", new Func((o, fmtStr) => {
            let f = fmtStr.jsStr()
            let obj
            if (o instanceof Num) {
                const i = o.toNum().jsValue
                let user = findUserEntryById(i)
                let meta = findMetadataById(i)
                let info = findInfoEntryById(i)
                if (!user || !meta || !info) return new Num(0)
                obj = new Obj({
                    u: user,
                    m: meta,
                    i: info
                })
            } else {
                obj = o
            }


            let final = ""
            let braceC = 0
            let curFmtName = ""
            for (let i = 0; i < f.length; i++) {
                let ch = f[i]
                if (ch === "{") {
                    braceC++
                    continue
                } else if (ch === "}") {
                    braceC--

                    if (braceC === 0) {
                        let params = curFmtName.split(".").map(v => new Str(v))
                        final += obj.call(params).jsStr()
                        curFmtName = ""
                        continue
                    }
                }

                if (braceC > 0) {
                    curFmtName += ch
                } else {
                    final += ch
                }
            }

            return new Str(final)
        }))

        this.symbols.set("serialize", new Func((obj) => {
            return new Str(JSON.stringify(obj.jsValue, (_, v) => typeof v === "bigint" ? String(v) : v))
        }))

        this.symbols.set("deserialize", new Func(text => {
            console.log(text.jsStr())
            return new Obj(api_deserializeJsonl(text.jsStr()).next().value)
        }))

        this.symbols.set("clear", new Func(() => {
            return Type.from(ui_modeclear())
        }))

        this.symbols.set("put", new Func((...values) => {
            return Type.from(ui_put(...values.map(v => v instanceof Elem ? v.el : v.jsStr())))
        }))

        this.symbols.set("ua_download", new Func((data, name, ft) => {
            let jsName = name?.jsStr() || "file.dat"
            let fileType = ft?.jsStr() || "text/plain"
            let d = data.jsStr()
            return Type.from(ua_download(d, jsName, fileType))
        }))

        this.symbols.set("ui_askitem", new Func(cb => {
            ui_askitem().then(id => {
                let result
                if (typeof id === 'bigint') {
                    result = new EntryTy(findInfoEntryById(id))
                } else {
                    result = new Num(0)
                }
                cb.call([result])
            })
            return new Num(0)
        }))

        this.symbols.set("ui_setstat", new Func((name, val) => {
            let n = name.jsStr()
            let v = val.toNum()
            return Type.from(ui_setstat(n, v.jsValue))
        }))

        this.symbols.set("ui_delstat", new Func((name) => {
            let n = name.jsStr()
            return Type.from(Number(ui_delstat(n)))
        }))

        this.symbols.set("ui_sort", new Func(by => {
            return Type.from(ui_sort(by.jsStr()))
        }))

        this.symbols.set("ui_search", new Func((query, cb) => {
            return Type.from(ui_search(query.jsStr(), results => {
                cb?.call([new Arr(results.map(v => new EntryTy(v.info)))])
            }))
        }))

        this.symbols.set("ui_setmode", new Func((modeName) => {
            let name = modeName.jsStr()
            let res = ui_setmode(name)
            if (res == 1) {
                return new Str("Invalid mode")
            }
            return Type.from(res)
        }))

        this.symbols.set("ui_sidebarclear", new Func(() => {
            return Type.from(ui_sidebarclear())
        }))

        this.symbols.set("ui_sidebarreorder", new Func((...items) => {
            let ids = items.map(v => v.toNum().jsValue) as bigint[]
            return Type.from(ui_sidebarreorder(...ids))
        }))

        this.symbols.set("ui_sidebarselect", new Func((id) => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            let res = ui_sidebarselect(jsId)
            if (res === 1) {
                return new Str(`${id} not found`)
            }
            return Type.from(res)
        }))

        this.symbols.set("ui_sidebarrender", new Func(id => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }
            let res = ui_sidebarrender(jsId)
            if (res === 1)
                return new Str(`${id} not found`)
            return Type.from(res)
        }))

        this.symbols.set("ui_toggle", new Func(id => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            let res = ui_toggle(jsId)
            if (res == 2) {
                return new Str(`${id} not found`)
            }
            return Type.from(res)
        }))

        this.symbols.set("ui_select", new Func((id) => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            let res = ui_select(jsId)
            if (res === 2) {
                return new Str(`${id} already selected`)
            } else if (res === 1) {
                return new Str(`${id} not found`)
            } else {
                return Type.from(res)
            }
        }))

        this.symbols.set("ui_render", new Func(id => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            let res = ui_render(jsId)
            if (res === 1) {
                return new Str(`${id} not found`)
            } else {
                return Type.from(res)
            }
        }))

        this.symbols.set("ui_deselect", new Func((id) => {
            const jsId = id.toNum().jsValue
            if (typeof jsId !== 'bigint') {
                return new Str("id is not a bigint")
            }

            let res = ui_deselect(jsId)
            if (res === 2) {
                return new Str(`${id} is not selected`)
            } else if (res === 1) {
                return new Str(`${id} not found`)
            } else {
                return Type.from("")
            }
        }))

        this.symbols.set("ui_clear", new Func(() => {
            return Type.from(clearItems())
        }))

        this.symbols.set("ui_setuid", new Func((newUid) => {
            return Type.from(ui_setuid(newUid.toNum().jsStr()))
        }))

        this.symbols.set("ui_getuid", new Func(() => {
            return Type.from(ui_getuid())
        }))

        this.symbols.set("ui_setresults", new Func(newResults => {
            if (!(newResults instanceof Arr)) {
                return new Str("ui_setresults expects array")
            }
            let results = newResults.jsValue
                .filter((v: Type) => v instanceof EntryTy && probablyInfoEntry(v.jsValue))
                .map((v: Type) => v.jsValue)
            return Type.from(ui_setresults(results))
        }))

        this.symbols.set("ui_getresults", new Func(() => {
            return Type.from(ui_getresults())
        }))

        this.symbols.set("ui_selected", new Func(() => {
            return Type.from(ui_selected())
        }))

        this.symbols.set("js_eval", new Func(text => {
            return Type.from(eval(text.jsStr()))
        }))

        this.symbols.set("elem_on", new Func((root, event, cb) => {
            if (!(root instanceof Elem)) {
                return new Str("root must be an element")
            }

            if (!(cb instanceof Func)) {
                return new Str("callback must be a func")
            }

            let evName = event.jsStr()

            root.el.addEventListener(evName, e => {
                cb.call([new Obj(e)])
            })

            return new Num(0)
        }))

        this.symbols.set("elem_byid", new Func((root, id) => {
            if (!(root instanceof Elem)) {
                return new Str("root must be an element")
            }

            let selectorId = id.jsStr()

            let el = root.el.querySelector(`[id="${selectorId}"]`)
            if (!el || !(el instanceof HTMLElement)) {
                return new Num(0)
            }
            return new Elem(el)
        }))

        this.symbols.set("elem_getshadow", new Func(root => {
            if (!(root instanceof Elem)) {
                return new Str("root must be an element")
            }

            let div = document.createElement("div")
            let shadow = root.el.shadowRoot
            if (!shadow) {
                return new Num(0)
            }
            div.replaceChildren(...shadow.children)
            return new Elem(div)
        }))

        this.symbols.set("elem_setshadow", new Func((root, tobeShadow) => {
            if (!(root instanceof Elem)) {
                return new Str("root must be an element")
            }
            if (!(tobeShadow instanceof Elem)) {
                return new Str("shadow must be an element")
            }

            let shadow = root.el.shadowRoot ?? root.el.attachShadow({ mode: "open" })
            shadow.replaceChildren(tobeShadow.el)
            return root
        }))

        this.symbols.set("elem_sethtml", new Func((root, html) => {
            if (!(root instanceof Elem)) {
                return new Str("root must be an element")
            }
            let newHTML = html.jsStr()
            root.el.innerHTML = newHTML
            return new Str(newHTML)
        }))

        this.symbols.set("elem_getohtml", new Func(root => {
            if (!(root instanceof Elem)) {
                return new Str("root must be an element")
            }
            return new Str(root.el.outerHTML)
        }))

        this.symbols.set("elem_gethtml", new Func(root => {
            if (!(root instanceof Elem)) {
                return new Str("root must be an element")
            }
            return new Str(root.el.innerHTML)
        }))

        this.symbols.set("elem_create", new Func(tagName => {
            let name = tagName.jsStr()
            return new Elem(document.createElement(name))
        }))

        this.symbols.set("elem_append", new Func((parent, child) => {
            if (!(parent instanceof Elem) || !(child instanceof Elem)) {
                return new Str("parent, and child must be Elem")
            }

            parent.el.append(child.el)
            return parent
        }))

        this.symbols.set("uname2uid", new Func((name, cb) => {
            let u = name.jsStr()
            api_username2UID(u).then(res => {
                cb.call([new Num(res)])
            })
            return new Num(0)
        }))

        this.symbols.set("search", new Func((query, cb) => {
            api_queryV3(query.jsStr(), getUidUI()).then(entries => {
                let es = new Arr(entries.map(v => new EntryTy(v)))
                cb?.call([es])
            }).catch(console.error)
            return new Num(0)
        }))

        this.symbols.set("setrating", new Func((...params) => {
            let [itemId, newRating, done] = params;
            api_setRating(BigInt(itemId.jsStr()), newRating.jsStr()).then(async (res) => {
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

        this.symbols.set("setentry", new Func((entry) => {
            if (!(entry instanceof EntryTy) || !probablyInfoEntry(entry.jsValue)) {
                return new Str("NOT AN ENTRY")
            }
            aio_setentry(entry.jsValue).then(success => {
                if (!success && mode.put) {
                    mode.put(`Failed to update: ${entry.jsValue.En_Title}`)
                }
            })
            return new Str("")
        }))

        this.symbols.set("setmeta", new Func((entry) => {
            if (!(entry instanceof EntryTy) || !probablyMetaEntry(entry.jsValue)) {
                return new Str("NOT AN ENTRY")
            }

            aio_setmeta(entry.jsValue).then(success => {
                let info = findInfoEntryById(entry.jsValue.ItemId) as InfoEntry
                if (!success && mode.put) {
                    mode.put(`Failed to update: ${info.En_Title}'s metadata`)
                }
            })

            return new Str("")
        }))

        this.symbols.set("setuser", new Func((entry) => {
            if (!(entry instanceof EntryTy) || !probablyUserItem(entry.jsValue)) {
                return new Str("NOT AN ENTRY")
            }
            aio_setuser(entry.jsValue).then(success => {
                let info = findInfoEntryById(entry.jsValue.ItemId) as InfoEntry
                if (!success && mode.put) {
                    mode.put(`Failed to update: ${info.En_Title}'s user entry`)
                }
            })

            return new Str("")
        }))

        this.symbols.set("env", new Func(() => {
            let res = ""
            for (let key of this.symbols.keys()) {
                res += key + "\n"
            }
            return new Str(res.trim())
        }))
    }
    delete(name: string) {
        this.symbols.delete(name)
    }
    set(name: string, value: Type) {
        this.symbols.set(name, value)
    }
    get(name: string) {
        return this.symbols.get(name)
    }

    copy() {
        let copy = new CalcVarTable()
        for (let item of this.symbols.entries()) {
            copy.set(item[0], item[1])
        }
        return copy
    }
}

class Interpreter {
    tree: NodePar
    symbolTable: CalcVarTable
    stack: Type[]
    constructor(tree: NodePar, symbolTable: CalcVarTable) {
        this.tree = tree
        this.symbolTable = symbolTable
        this.stack = []
    }

    NumNode(node: NumNode) {
        return new Num(node.value)
    }

    ArrNode(node: ArrNode) {
        return new Arr(node.nodes.map(v => this.interpretNode(v)))
    }

    StringNode(node: WordNode) {
        return new Str(node.value)
    }

    EscapedNode(node: EscapedNode) {
        return new Code(new ProgramNode(node.value))
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
            return right.toNum()
        } else {
            return right.mul(new Num(-1))
        }
    }

    BinOpNode(node: BinOpNode) {
        let left = this.interpretNode(node.left)

        if (node.operator.ty === "Add") {
            let right = this.interpretNode(node.right)
            return left.add(right)
        } else if (node.operator.ty === "Sub") {
            let right = this.interpretNode(node.right)
            return left.sub(right)
        } else if (node.operator.ty === "Mul") {
            let right = this.interpretNode(node.right)
            return left.mul(right)
        } else if (node.operator.ty === "Div") {
            let right = this.interpretNode(node.right)
            return left.div(right)
        } else if (node.operator.ty === "DEq") {
            let right = this.interpretNode(node.right)
            return left.eq(right)
        } else if (node.operator.ty === "Lt") {
            let right = this.interpretNode(node.right)
            return left.lt(right)
        } else if (node.operator.ty === "Gt") {
            let right = this.interpretNode(node.right)
            return left.gt(right)
        } else if (node.operator.ty === "Ge") {
            let right = this.interpretNode(node.right)
            if (left.gt(right).truthy() || left.eq(right).truthy()) {
                return new Num(1)
            }
            return new Num(0)
        } else if (node.operator.ty === "Le") {
            let right = this.interpretNode(node.right)
            if (left.lt(right).truthy() || left.eq(right).truthy()) {
                return new Num(1)
            }
            return new Num(0)
        } else if (node.operator.ty === "NEq") {
            let right = this.interpretNode(node.right)
            if (!left.eq(right).truthy()) {
                return new Num(1)
            }
            return new Num(0)
        } else if (node.operator.ty === "Word") {
            switch (node.operator.value) {
                case "and": {
                    let right = this.interpretNode(node.right)
                    return new Num(left.truthy() && right.truthy() ? 1 : 0)
                }
                case "or":
                    if (!left.truthy()) {
                        let right = this.interpretNode(node.right)
                        return new Num(right.truthy() ? 1 : 0)
                    }
                    return new Num(1)
                case "xor": {
                    let right = this.interpretNode(node.right)
                    if ((left || right) && !(left && right)) {
                        return new Num(1)
                    }
                    return new Num(0)
                }
                case "nand": {
                    let right = this.interpretNode(node.right)
                    if (!(left && right)) {
                        return new Num(1)
                    }
                    return new Num(0)
                }
            }
        }
        return this.interpretNode(node.right)
    }

    PipeFunNode(node: PipeFunNode) {
        let input = this.interpretNode(node.input)

        let compiledFuncs: [Type, keyof typeof TT][] = []
        for (let f of node.funs) {
            compiledFuncs.push([this.interpretNode(f), f.paramNames[0].ty])
        }

        let newItems = []
        let len = input.len().jsValue
        for (let i = 0; i < len; i++) {
            let item = input.getattr(new Num(i))
            let finalItem = item
            let shouldAdd = true
            for (let [f, ty] of compiledFuncs) {
                let res = f.call([finalItem])
                if (ty === "FilterArrow") {
                    if (!res.truthy()) {
                        shouldAdd = false
                        break
                    }
                } else if (ty === "TransformArrow") {
                    finalItem = res
                }
            }
            if (shouldAdd)
                newItems.push(finalItem)
        }
        return new Arr(newItems)
    }

    PipeNode(node: PipeNode) {
        let val = this.interpretNode(node.children[0])
        for (let child of node.children.slice(1)) {
            this.symbolTable.set("_", val)
            if (child instanceof CallNode) {
                val = this.interpretNode(child, val)
            } else {
                val = this.interpretNode(child).call([val])
            }
        }
        return val
    }

    interpretNode(node: NodePar, pipeValue?: Type): Type {
        //@ts-ignore
        let val = this[node.constructor.name](node, pipeValue)
        this.symbolTable.set("_1", val)
        return val
    }

    ErrorNode(node: ErrorNode) {
        console.error(node.value)
        return new Str(node.value)
    }

    CallNode(node: CallNode, pipeValue?: Type): Type {
        //@ts-ignore
        let inner = node.inner.map(this.interpretNode.bind(this))
        if (pipeValue) {
            inner = [pipeValue, ...inner]
        }
        let callable = this.interpretNode(node.callable)
        return callable.call(inner)
    }

    PropertyAccessNode(node: PropertyAccessNode): Type {
        let of = this.interpretNode(node.of)
        let inner = this.interpretNode(node.value)
        return of.getattr(inner)
    }

    VarDefNode(node: VarDefNode) {
        let val = this.interpretNode(node.expr)
        this.symbolTable.set(node.name.value, val)
        return val
    }

    ForNode(node: ForNode) {
        let name = node.varName.value
        let start = this.interpretNode(node.start).toNum().jsValue
        let end = this.interpretNode(node.end).toNum().jsValue

        let vals: Type[] = []
        let out: Type = new Num(0)
        for (let i = start; i < end; i++) {
            this.symbolTable.set(name, new Num(i))
            this.symbolTable.set("_", out)
            out = this.interpretNode(node.body)
            if (node.returnType === "list") {
                vals.push(out)
            }
        }
        return node.returnType === "last" ? out : new Arr(vals)
    }

    ForEachNode(node: ForEachNode) {
        let name = node.varName.value
        let iterable = this.interpretNode(node.of)

        let len = iterable.len().jsValue

        let vals: Type[] = []
        let lastVal: Type = new Num(0)
        for (let i = 0; i < len; i++) {
            let cur = iterable.getattr(new Num(i))
            this.symbolTable.set(name, cur)
            this.symbolTable.set("_", lastVal)
            lastVal = this.interpretNode(node.body)
            if (node.returnType === "list") {
                vals.push(lastVal)
            }
        }
        return node.returnType === "last" ? lastVal : new Arr(vals)
    }

    IfNode(node: IfNode) {
        let shouldEval = this.interpretNode(node.condition).truthy()

        if (shouldEval) {
            let b = this.interpretNode(node.body)
            return b
        }
        return this.interpretNode(node.elsePart)
    }

    WhileNode(node: WhileNode) {
        let outList = []
        let out: Type = new Num(0)
        while (this.interpretNode(node.condition).truthy()) {
            this.symbolTable.set("_", out)
            let val = this.interpretNode(node.body)
            out = val
            if (node.returnType === "list") {
                outList.push(val)
            }
        }
        return node.returnType === "last" ? out : new Arr(outList)
    }

    FuncDefNode(node: FuncDefNode) {
        const closure = this.symbolTable.copy()
        console.log("CLOSING: ", closure.get("i"))

        let fun = new Func((...items) => {
            for (let i = 0; i < items.length; i++) {
                closure.set(`arg${i}`, items[i])
            }
            for (let i = 0; i < node.paramNames.length; i++) {
                closure.set(node.paramNames[i].value, items[i])
            }
            let interpreter = new Interpreter(node.program, closure)
            return interpreter.interpretNode(node.program)
        })

        if (node.name.value) {
            this.symbolTable.set(node.name.value, fun)
        }
        return fun
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

function makeSymbolsTableFromObj(obj: object): CalcVarTable {
    let symbols = new CalcVarTable()
    for (let name in obj) {
        //@ts-ignore
        let val = obj[name]
        let t = Type.from(val)
        if (symbols.get(name)) {
            name = `${name}2`
        }
        symbols.set(name, t)
    }
    return symbols
}
