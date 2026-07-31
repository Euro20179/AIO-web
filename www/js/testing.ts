function dotests(category: string) {
    let testCounts = new Map<string, bigint>

    let passFails = new Map<string, { pass: bigint, fail: bigint }>

    type Test = [Function, (left: any, right: any) => boolean, Function]
    type TestGroup = {
        [name: string]: {
            tests: {[name: string]: Test | TestGroup}
        }
    }

    function doTest(name: string, test: Test): [boolean, string] {
        return [test[1](test[0](), test[2]()), ""]
    }

    function doTestGroup(group: TestGroup) {
        for(let name in group) {
            console.group(name)
            let testOrGroup = group[name]
            const pf = passFails.get(name) || { pass: 0n, fail: 0n }
            for(let testName in testOrGroup.tests) {
                let test = testOrGroup.tests[testName]
                if (Array.isArray(test)) {
                    let l = test[0](),
                        r = test[2](),
                        res = test[1](l, r)

                    if(res) {
                        pf.pass++
                        const args = test[1] === call
                            ? ["%c [✓] %c %s %O %O", "background: limegreen; color: black", "background: transparent", testName, l, res]
                            : ["%c [✓] %c %s %O", "background: limegreen; color: black", "background: transparent", testName, l]
                        console.debug.apply(null, args)
                    }
                    else {
                        console.error(testName, l, r)
                        pf.fail++
                    }

                    passFails.set(name, {
                        pass: pf.pass,
                        fail: pf.fail
                    })
                } else {
                    doTestGroup(test)
                }
            }
            const { pass, fail } = passFails.get(name) || { pass: 0n, fail: 0n }
            let style = "color: red;"
            if (fail === 0n) {
                style = "color: limegreen"
            }
            console.info("%s %c%d/%d (%f%%)", name, style, pass, (pass + fail), Number(pass) / Number(pass + fail) * 100)
            console.groupEnd()
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

    const tests: TestGroup = {
        "settings backwards compatibility": {
            tests: {
                "user rating max": [r(settings_get, 0, "user_rating_max"), eq, l(100)],
                "currency": [r(settings_get, 0, "currency"), eq, l("USD")]
            }
        },
        "ui stuff": {
            tests: {
                ui_render: [r(ui_render, 1n), is, l(HTMLElement)],

                "set and get selected": [
                    r(() => {
                        items_setSelected([findInfoEntryById(1n)])
                        return ui_selected().map(v => v.ItemId)
                    }),
                    deq,
                    l([1n])
                ],

                "ui_addsort": [
                    r(ui_addsort, "TEST", () => 1),
                    call,
                    l(() => {
                        return Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
                    })
                ],

                "ui_delsort": [
                    r(ui_delsort, "TEST"),
                    call,
                    l(() => {
                        return !Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
                    })
                ],

                "ui_seterr": [
                    r(ui_seterr, "TESTING ERROR"),
                    call,
                    l(() => {
                        const err = components.errorOut
                        if (!err) return true
                        return err.getAttribute("data-error") === "TESTING ERROR"
                    })
                ],

                "ui_newscript": [
                    r(ui_newscript, "TESTING SCRIPT", () => 1, "TESTING SCRIPT"),
                    call,
                    l(() => {
                        const scriptSelect = dom_getel("#script-select", HTMLElement)
                        if (!scriptSelect) return false
                        return Boolean(userScripts.get("TESTING SCRIPT")) &&
                            Boolean(scriptSelect.querySelector("#user-script-TESTING\\ SCRIPT"))
                    })
                ],

                "ui_clearSelected": [r(ui_clear), eq, l(0)],

                "ui_select": [r(ui_select, 1n), not(in_), l([1, 2])],

                "ui create stats": {
                    "ui create stats": {
                        tests: {
                            ui_createstat: [r<typeof ui_createstat>(ui_createstat, 'test', true, (e, mult) => 1 * mult), eq, l(0)],

                            "ui_setstat (to 3)": [r(ui_setstat, 'test', 3), eq, l(3)],

                            "change stat (inc by 1)": [r(changeResultStatsWithItemUI, items_getEntry(1n)), call, l(() => {
                                for (let stat of statistics) {
                                    if (stat.name !== 'test') continue

                                    return stat.value === 4
                                }
                            })],

                            "delete stat": [r(ui_delstat, 'test'), eq, l(true)]
                        }
                    }
                },

                "set modes": {
                    "set modes": {
                        tests: (() => {
                            let tests: Record<string, Test> = {}
                            for (let [name, mode] of [...mode_map().entries()].reverse()) {
                                if (name === 'graph') continue
                                tests[name] = [r(ui_setmode, name), call, l(() => {
                                    //@ts-ignore
                                    return mode_cls2name(mode_getFirstModeInWindow(window)?.constructor) == name
                                })]
                            }
                            return tests
                        })()
                    }
                }
            }
        },

        catalog: {
            tests: {
               "isopen": [r(isCatalogModeUI), eq, l(false)],
               "openIt": [r(openCatalogModeUI), eq, l(undefined)],
               "isopenafteropen": [r(isCatalogModeUI), eq, l(true)],
               "closeIt": [r(closeCatalogModeUI), eq, l(undefined)],
               "isopenafterclose": [r(isCatalogModeUI), eq, l(false)],
            }
        },

        notes: {
            tests: {
                    "simple note": [r(parseNotes, "yes"), eq, l("yes")],
                    "unclosed note": [r(parseNotes, '[b]hi'), eq, l("[b]hi")],
                    "complex unclosed note": [r(parseNotes, '[b]hi[i]hi[/i]'), eq, l("[b]hi[i]hi[/i]")],
                    "complex note": [r(parseNotes, '[b]hi[i]hi[/i][/b]'), eq, l("<b>hi<i>hi</i></b>")],
                    "[item]": [r(parseNotes, "[item=1]my item[/item] cool item"), eq, l(`<button onclick="items_getEntryAny(1).then(res => res.ItemId && toggleItem(res.info))">my item</button> cool item`)],
                    "[spoiler]": [r(parseNotes, '[b]SPOILER[/b] [spoiler]hi[/spoiler]'), eq, l("<b>SPOILER</b> <span class='spoiler'>hi</span>")],
                    "complex + [list]": [r(parseNotes, `[list]
- [b]one[/b]
- two
[/list]`), eq, l('• <b>one</b>\n• two')],
                    'html': [r(parseNotes, '<p align="center">[b]hi[/b]</p>'), eq, l('<p align="center"><b>hi</b></p>')],

            }
        },

        "display entry mode": {
            tests: (() => {
                const el = ui_render_from(1n, "entry-output")
                const tests: TestGroup[string]["tests"] = {
                    render: [l(el), not(in_), l([1, 2])]
                }

                if (el == 1 || el == 2) return tests

                tests["_"] = {
                    "presense of elements": {
                        tests: {
                            'user actions filled': [
                                l(() => el.querySelector("#user-actions td:has(.delete)")),
                                not(eq),
                                l(null)
                            ],
                            'description not empty': [
                                l((left: HTMLElement) => {
                                    return left.querySelector("#description")?.innerHTML
                                }),
                                call,
                                l((left: string | null) => {
                                    alert(left)
                                    return true
                                })
                            ],
                        }
                    }
                }
                return tests
            })()
        }
    }


    doTestGroup(tests as TestGroup)


    //for the sake of backwards compat, some default settings must NEVER change
//     mktestgroup("ui stuff", [
//         ["ui_render", r(ui_render, 1n), is, l(HTMLElement)],
//
//         ["set and get selected", r(() => {
//             items_setSelected([findInfoEntryById(1n)])
//             return ui_selected().map(v => v.ItemId)
//         }), deq, l([1n])],
//
//         ["ui_addsort", r(ui_addsort, "TEST", () => 1), call, l(() => {
//             return Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
//         })],
//
//         ["ui_delsort", r(ui_delsort, "TEST"), call, l(() => {
//             return !Boolean(components["sortBySelector"]?.querySelector('option[value="TEST"]'))
//         })],
//
//         ["ui_seterr", r(ui_seterr, "TESTING ERROR"), call, l(() => {
//             const err = components.errorOut
//             if (!err) return true
//             return err.getAttribute("data-error") === "TESTING ERROR"
//         })],
//
//         ["ui_newscript", r(ui_newscript, "TESTING SCRIPT", () => 1, "TESTING SCRIPT"), call, l(() => {
//             const scriptSelect = dom_getel("#script-select", HTMLElement)
//             if (!scriptSelect) return false
//             return Boolean(userScripts.get("TESTING SCRIPT")) &&
//                 Boolean(scriptSelect.querySelector("#user-script-TESTING\\ SCRIPT"))
//         })],
//
//         ["ui_clearSelected", r(ui_clear), eq, l(0)],
//
//         ["ui_select", r(ui_select, 1n), not(in_), l([1, 2])],
//
//         ["ui_createstat", r<typeof ui_createstat>(ui_createstat, 'test', true, (e, mult) => 1 * mult), eq, l(0), {
//             subtest: (left) => {
//                 return mktestgroup("stat tests", [
//                     ["ui_setstat (to 3)", r(ui_setstat, 'test', 3), eq, l(3)],
//                     ["change stat (inc by 1)", r(changeResultStatsWithItemUI, items_getEntry(1n)), call, l(() => {
//                         for (let stat of statistics) {
//                             if (stat.name !== 'test') continue
//
//                             return stat.value === 4
//                         }
//                     })],
//                     ["delete stat", r(ui_delstat, 'test'), eq, l(true)]
//                 ])
//             }
//         }],
//
//         ["set modes", l(0), eq, l(0), {
//             subtest: () => {
//                 const tests: Test[] = []
//                 for (let [name, mode] of [...mode_map().entries()].reverse()) {
//                     if (name === 'graph') continue
//                     tests.push([name, r(ui_setmode, name), call, l(() => {
//                         //@ts-ignore
//                         return mode_cls2name(mode_getFirstModeInWindow(window)?.constructor) == name
//                     })])
//                 }
//                 return mktestgroup("each mode", tests)
//             }
//         }],
//     ])
//
//     mktestgroup("catalog", [
//         ["isopen", r(isCatalogModeUI), eq, l(false)],
//         ["openIt", r(openCatalogModeUI), eq, l(undefined)],
//         ["isopen", r(isCatalogModeUI), eq, l(true)],
//         ["closeIt", r(closeCatalogModeUI), eq, l(undefined)],
//     ])
//
//     mktestgroup("notes", [
//         ["simple note", r(parseNotes, "yes"), eq, l("yes")],
//         ["unclosed note", r(parseNotes, '[b]hi'), eq, l("[b]hi")],
//         ["complex unclosed note", r(parseNotes, '[b]hi[i]hi[/i]'), eq, l("[b]hi[i]hi[/i]")],
//         ["complex note", r(parseNotes, '[b]hi[i]hi[/i][/b]'), eq, l("<b>hi<i>hi</i></b>")],
//         ["[item]", r(parseNotes, "[item=1]my item[/item] cool item"), eq, l(`<button onclick="items_getEntryAny(1).then(res => res.ItemId && toggleItem(res.info))">my item</button> cool item`)],
//         ["[spoiler]", r(parseNotes, '[b]SPOILER[/b] [spoiler]hi[/spoiler]'), eq, l("<b>SPOILER</b> <span class='spoiler'>hi</span>")],
//         ["complex + [list]", r(parseNotes, `[list]
// - [b]one[/b]
// - two
// [/list]`), eq, l('• <b>one</b>\n• two')],
//         ['html', r(parseNotes, '<p align="center">[b]hi[/b]</p>'), eq, l('<p align="center"><b>hi</b></p>')],
//     ])
//
//     mktestgroup("display entry mode", [
//         ["render", r(() => ui_render_from(1n, "entry-output")), call, l((left: 1 | 2 | HTMLElement) => {
//             return left !== 1 && left !== 2
//         }), {
//                 subtest: left => {
//                     return mktestgroup("presense of elements", [
//                         ['user actions filled', l(() => left.querySelector("#user-actions td:has(.delete)")), not(eq), l(null)],
//                         ['description not empty', l(() => left.querySelector("#description")?.innerHTML), call, l((left: string | null) => {
//                             return true
//                         }), {
//                                 subtest: left => mktestgroup("description not empty", [
//                                     ['not null', l(left), not(eq), l(null)],
//                                     ['not empty string', l(left), not(eq), l("")]
//                                 ])
//                             }]
//                     ])
//                 }
//             }],
//     ])
//
//     const pitemsTests: Test[] = []
//     for (let probably of [probablyUserItem, probablyInfoEntry, probablyMetaEntry]) {
//         let pname = probably.name.match(/probably(.+?)(?:Item|Entry)/)?.[1] || "name"
//         if (pname === 'Meta') pname = 'Metadata'
//         for (let generic of [genericInfo, genericMetadata, genericUserEntry]) {
//             let gname = generic.name.match(/generic(.+)(?:Entry)?/)?.[1] || "name"
//             if (gname === 'UserEntry') gname = 'User'
//             pitemsTests.push([`probably ${pname} with generic ${gname} (${gname === pname})`, r(probably, generic(1n, 1)), eq, l(gname == pname)])
//         }
//     }
//     testgroups['probablyItems'] = mktestgroup("item object type heuristics", pitemsTests)
//
//     if (category) {
//         testgroups[category as keyof typeof testgroups]()
//     } else {
//         for (let test in testgroups) {
//             if (!Object.hasOwn(testgroups, test)) continue
//             testgroups[test as keyof typeof testgroups]()
//         }
//     }
    const { pass, fail } = passFails.values()
        .reduce((p, c) => ({ pass: p.pass + c.pass, fail: p.fail + c.fail }), { pass: 0n, fail: 0n })
    let style = "color: red;"
    if (fail === 0n) {
        style = "color: limegreen"
    }
    console.info("%c%d/%d (%f%%)", style, pass, (pass + fail), Number(pass) / Number(pass + fail) * 100)
}
