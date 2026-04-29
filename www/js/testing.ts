function dotests() {
    let testCounts = new Map<string, bigint>

    let passFails = new Map<string, { pass: bigint, fail: bigint }>

    function mktestgroup(
        groupName: string,
        tests: [string, Function, (left: any, right: any) => boolean, Function][]
    ) {
        testCounts.set(groupName, 0n)
        return () => {
            console.group(groupName, 'tests')
            for (let [
                name, left, comp, right
            ] of tests) {
                testCounts.set(groupName, (testCounts.get(groupName) || 0n) + 1n);
                const pf = passFails.get(groupName) || { pass: 0n, fail: 0n }
                if (comp(left(), right())) {
                    passFails.set(groupName, {
                        pass: pf.pass + 1n,
                        fail: pf.fail
                    })
                    console.info("%s %c[✓]", name, "background: limegreen; color: black")
                } else {
                    passFails.set(groupName, {
                        pass: pf.pass,
                        fail: pf.fail + 1n
                    })
                    console.error(name, left, right)
                }
            }
            const {pass, fail} = passFails.get(groupName) || { pass: 0n, fail: 0n}
            let style = "color: red;"
            if(fail === 0n) {
                style = "color: limegreen"
            }
            console.log("%c%d/%d (%f%%)", style, pass, (pass + fail), Number(pass) / Number(pass + fail) * 100)
            console.groupEnd()
        }
    }

    function eq(left: any, right: any) {
        return left === right
    }

    function deq(left: any, right: any) {
        if (typeof left !== typeof right) return false
        switch (typeof left) {
            case 'string':
            case 'number':
            case 'bigint':
            case 'boolean':
            case 'symbol':
            case 'undefined':
            case 'function':
                return left === right
            case 'object':
                for (let key in left) {
                    if (!deq(left[key], right[key])) {
                        return false
                    }
                }
                return true
        }
    }

    function is(left: any, right: any) {
        return left instanceof right
    }

    function not(cmp: Function) {
        return (left: any, right: any) => !cmp(left, right)
    }

    function nop(left: any, right: Function) { 
        return right()
    }

    //run
    function r(fn: Function, ...args: any[]) {
        return () => fn.apply(null, args)
    }

    //literal
    function l(val: any) {
        return () => val
    }

    const tests = {
        js_api: mktestgroup("js api", [
            [ "ui_render", r(ui_render, 1n), is, l(HTMLElement) ],

            [ "set and get selected", r(() => {
                items_setSelected([findInfoEntryById(1n)])
                return ui_selected().map(v => v.ItemId)
            }), deq, l([1n]) ],

            [ "ui_addsort", r(ui_addsort, "TEST", () => 1), nop, l(() => {
                return Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
            })],

            ["ui_delsort", r(ui_delsort, "TEST"), nop, l(() => {
                return !Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
            })]
        ])
    } as const

    for (let test in tests) {
        if (!Object.hasOwn(tests, test)) continue
        tests[test as keyof typeof tests]()
    }
}
