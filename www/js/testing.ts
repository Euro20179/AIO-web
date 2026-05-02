function dotests(category: string) {
    let testCounts = new Map<string, bigint>

    let passFails = new Map<string, { pass: bigint, fail: bigint }>

    type Test = [string, Function, (left: any, right: any) => boolean, Function, {
        subtest: (left: any, right: any) => Function
    }?]

    function mktestgroup(
        groupName: string,
        tests: Test[]
    ) {
        testCounts.set(groupName, 0n)
        return () => {
            console.group(groupName, 'tests')
            for (let [
                name, left, comp, right, options
            ] of tests) {
                testCounts.set(groupName, (testCounts.get(groupName) || 0n) + 1n);
                const pf = passFails.get(groupName) || { pass: 0n, fail: 0n }
                let l, r;
                if (comp(l = left(), r = right())) {
                    passFails.set(groupName, {
                        pass: pf.pass + 1n,
                        fail: pf.fail
                    })
                    const args = comp === call
                        ? ["%c [✓] %c %s %O %O", "background: limegreen; color: black", "background: transparent", name, l, r]
                        : ["%c [✓] %c %s %O", "background: limegreen; color: black", "background: transparent", name, l]
                    console.info.apply(null, args)
                } else {
                    passFails.set(groupName, {
                        pass: pf.pass,
                        fail: pf.fail + 1n
                    })
                    console.error(name, l, r)
                }

                if (options?.subtest) {
                    options?.subtest(l, r)()
                }
            }
            const { pass, fail } = passFails.get(groupName) || { pass: 0n, fail: 0n }
            let style = "color: red;"
            if (fail === 0n) {
                style = "color: limegreen"
            }
            console.log("%c%d/%d (%f%%)", style, pass, (pass + fail), Number(pass) / Number(pass + fail) * 100)
            console.groupEnd()
            return { pass, fail }
        }
    }

    function eq(left: any, right: any) {
        return left === right
    }

    function in_(left: any, right: any) {
        return right.includes(left)
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

    function call(left: any, right: Function) {
        return right(left)
    }

    //run
    function r<T extends (...args: any[]) => any>(fn: Function, ...args: Parameters<T>) {
        return () => fn.apply(null, args)
    }

    //literal
    function l(val: any) {
        return () => val
    }

    const tests = {
        js_api: mktestgroup("js api", [
            ["ui_render", r(ui_render, 1n), is, l(HTMLElement)],

            ["set and get selected", r(() => {
                items_setSelected([findInfoEntryById(1n)])
                return ui_selected().map(v => v.ItemId)
            }), deq, l([1n])],

            ["ui_addsort", r(ui_addsort, "TEST", () => 1), call, l(() => {
                return Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
            })],

            ["ui_delsort", r(ui_delsort, "TEST"), call, l(() => {
                return !Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
            })],

            ["ui_seterr", r(ui_seterr, "TESTING ERROR"), call, l(() => {
                const err = components.errorOut
                if (!err) return true
                return err.getAttribute("data-error") === "TESTING ERROR"
            })],

            ["ui_newscript", r(ui_newscript, "TESTING SCRIPT", () => 1, "TESTING SCRIPT"), call, l(() => {
                const scriptSelect = dom_getel("#script-select", HTMLElement)
                if (!scriptSelect) return false
                return Boolean(userScripts.get("TESTING SCRIPT")) &&
                    Boolean(scriptSelect.querySelector("#user-script-TESTING\\ SCRIPT"))
            })],

            ["ui_clearSelected", r(ui_clear), eq, l(0)],

            ["ui_select", r(ui_select, 1n), not(in_), l([1, 2])],

            ["ui_createstat", r<typeof ui_createstat>(ui_createstat, 'test', true, (e, mult) => 1 * mult), eq, l(0), {
                subtest: (left) => {
                    return mktestgroup("stat tests", [
                        ["ui_setstat (to 3)", r(ui_setstat, 'test', 3), eq, l(3)],
                        ["change stat (inc by 1)", r(changeResultStatsWithItemUI, items_getEntry(1n)), call, l(() => {
                            for(let stat of statistics) {
                                if(stat.name !== 'test') continue

                                return stat.value === 4
                            }
                        })],
                        ["delete stat", r(ui_delstat, 'test'), eq, l(true)]
                    ])
                }
            }]
        ]),

        notes: mktestgroup("notes", [
            ["simple note", r(parseNotes, "yes"), eq, l("yes")],
            ["unclosed note", r(parseNotes, '[b]hi'), eq, l("[b]hi")],
            ["complex unclosed note", r(parseNotes, '[b]hi[i]hi[/i]'), eq, l("[b]hi[i]hi[/i]")],
            ["complex note", r(parseNotes, '[b]hi[i]hi[/i][/b]'), eq, l("<b>hi<i>hi</i></b>")],
            ["[item]", r(parseNotes, "[item=1]my item[/item] cool item"), eq, l(`<button onclick="items_getEntryAny(1).then(res => res.ItemId && toggleItem(res.info))">my item</button> cool item`)],
            ["[spoiler]", r(parseNotes, '[b]SPOILER[/b] [spoiler]hi[/spoiler]'), eq, l("<b>SPOILER</b> <span class='spoiler'>hi</span>")],
            ["complex + [list]", r(parseNotes, `[list]
- [b]one[/b]
- two
[/list]`), eq, l('• <b>one</b>\n• two')],
        ]),

        catalog: mktestgroup("catalog", [
            ["open catalog mode", r(openCatalogModeUI), call, l(isCatalogModeUI)],
            ["get current doc", r(currentDocument), eq, r(() => modeWin?.document)],
            ["get current window", r(currentWindow), eq, r(() => modeWin)],
            ["close catalog mode", r(closeCatalogModeUI), not(call), l(isCatalogModeUI)]
        ]),

        display_entry_mode: mktestgroup("display entry mode", [
            ["render", r(() => ui_render_from(1n, "entry-output")), call, l((left: 1 | 2 | HTMLElement) => {
                return left !== 1 && left !== 2
            }), {
                    subtest: left => {
                        return mktestgroup("presense of elements", [
                            ['user actions filled', l(() => left.querySelector("#user-actions td:has(.delete)")), not(eq), l(null)],
                            ['description not empty', l(() => left.querySelector("#description")?.innerHTML), call, l((left: string | null) => {
                                return true
                            }), {
                                    subtest: left => mktestgroup("description not empty", [
                                        ['not null', l(left), not(eq), l(null)],
                                        ['not empty string', l(left), not(eq), l("")]
                                    ])
                                }]
                        ])
                    }
                }],
        ]),
    } as const

    if (category) {
        tests[category as keyof typeof tests]()
    } else {
        for (let test in tests) {
            if (!Object.hasOwn(tests, test)) continue
            tests[test as keyof typeof tests]()
        }
    }
    const { pass, fail } = passFails.values()
        .reduce((p, c) => ({ pass: p.pass + c.pass, fail: p.fail + c.fail }), { pass: 0n, fail: 0n })
    let style = "color: red;"
    if (fail === 0n) {
        style = "color: limegreen"
    }
    console.log("%c%d/%d (%f%%)", style, pass, (pass + fail), Number(pass) / Number(pass + fail) * 100)
}
