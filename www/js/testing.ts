async function dotests(category: string) {
    let passFails = new Map<string, { pass: bigint, fail: bigint }>

    type Test = [Function, (left: any, right: any) => boolean, Function]
    type TestGroup = {
        [name: string]: {
            tests: {[name: string]: Test | TestGroup}
            ondone?: Function
        }
    }

    async function doTest(group: string, name: string, test: Test): Promise<[boolean, string]> {
        const pf = passFails.get(group) || { pass: 0n, fail: 0n }
        let l = await test[0](),
            r = await test[2](),
            res = test[1](l, r)

        if(res) {
            pf.pass++
            const args = test[1] === call
                ? ["%c [✓] %c %s %O %O", "background: limegreen; color: black", "background: transparent", name, l, res]
                : ["%c [✓] %c %s %O", "background: limegreen; color: black", "background: transparent", name, l]
            console.debug.apply(null, args)
        }
        else {
            const args = test[1] === call
                ? ["%s %O %O", name, l, res]
                : ["%s %O", name, l]
            console.error.apply(null, args)
            pf.fail++
        }

        passFails.set(group, {
            pass: pf.pass,
            fail: pf.fail
        })

        return [res, ""]
    }

    async function doTestGroup(group: TestGroup) {
        for(let name in group) {
            console.group(name)
            let testOrGroup = group[name]
            for(let testName in testOrGroup.tests) {
                let test = testOrGroup.tests[testName]
                if (Array.isArray(test)) {
                    await doTest(name, testName, test)
                } else {
                    await doTestGroup(test)
                }
            }

            if(testOrGroup.ondone) {
                testOrGroup.ondone()
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

    //async run
    function ar<T extends (...args: any[]) => any>(fn: Function, ...args: Parameters<T>) {
        return async() => await fn.apply(null, args)
    }

    //literal
    function l(val: any) {
        return () => val
    }

    const username = '__TEST__'
    const password = "password"

    await (async() => {
        let params = new URLSearchParams([
            ["username", username],
            ["password", password]
        ])

        let res = await fetch(`${AIO}/account/create`, {
            method: "POST",
            body: params.toString()
        })

        await doTest("account creation", "create", [
            l(res.status),
            eq,
            l(200)
        ])

        await doTest("account creation", "ui signin", [
            ar(async() => {
                setUserAuth(btoa(`${username}:${password}`))
                const uid = await api_username2UID(username)
                storeUserUID(String(uid))
            }),
            call,
            l(() => {
                return getUserAuth() == btoa(`${username}:${password}`)
            })
        ])
    })()

    const tests: TestGroup = {
        "settings backwards compatibility": {
            tests: {
                "user rating max": [r(settings_get, 0, "user_rating_max"), eq, l(100)],
                "currency": [r(settings_get, 0, "currency"), eq, l("USD")]
            }
        },
        api: {
            tests: {
                create: [
                    ar(async() => {
                        const res = await api_createEntry({
                            title: "TEST ENTRY",
                            timezone: "UTC",
                            type: "Show",
                            format: 1,
                            "native-title": ""
                        })
                        return res?.status
                    }),
                    eq,
                    l(200)
                ],

                QUERY4: [
                    ar(async() => {
                        const res = await api_query("TEST ENTRY", getUserUID(), 4)
                        return res[0].En_Title
                    }),
                    eq,
                    l("TEST ENTRY")
                ],

                QUERY3: [
                    ar(async() => {
                        const res = await api_query("@TEST\\ ENTRY", getUserUID(), 3)
                        return res[0].En_Title
                    }),
                    eq,
                    l("TEST ENTRY")
                ],
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

                "ui_search": [
                    r(ui_search, "entryInfo.itemid = 1", () => {
                        doTest("search results", "resultcount", [r(() => items_getResults().length), eq, l(1)])
                    }), eq, l(0)
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
    };


    await (async () => {
        tests["display entry mode"] = {
            ondone: () => setUserExtra(items_getEntry(1n).user, "template", ""),
            tests: await (async() => {
                const e = items_getEntry(1n)
                e.user.Minutes = 300
                items_addChild(5n, e.ItemId)
                e.info.Library = 1n
                setUserExtra(e.user, "template", `
                    <h1 id="main-title"></h1>
                    <textarea id="style-editor" hidden></textarea>
                    <de-notes></de-notes>
                    <de-descendants></de-descendants>
                    <de-cost-calculation-modifiers></de-cost-calculation-modifiers>
                    <span id="user-rating"></span>
                    <span id="audience-rating"></span>
                    <span put-data="ViewCount" id="view-count"></span>
                    <span id="view-time"></span>
                    <input id="library"/>
                    <select id="tz-selector">
                        <option value="k"></option>
                        <option value="Atlantic/Reykjavik"></option>
                    </select>
                `)
                ui_clear()
                ui_setmode("entry")
                let el = ui_select(1n)
                //give element some time to hydrate
                await new Promise(res => setTimeout(res, 100))
                const tests: TestGroup[string]["tests"] = {
                    rendered: [l(el), not(in_), l([1, 2])],
                }
                if(el == 1 || el == 2) {
                    return tests
                }

                let qs = el.shadowRoot!.querySelector.bind(el.shadowRoot)

                return {
                    ...tests,
                    "fill title": [r(() => qs("#main-title")?.innerHTML), not(eq), l("")],
                    "notes exist": [r(() => qs("#notes")), not(eq), l(null)],
                    "descendants exist": [r(() => qs(`item-card[data-item-id="5"]`)), not(eq), l(null)],
                    "cost calculation modifiers exist": [r(() => qs("#include-recusively-in-cost")), not(eq), l(null)],
                    "style editor has styles": [r(() => qs("#style-editor")?.value), not(eq), l("")],
                    "template editor has template": [r(() => qs("#template-editor")?.value), not(eq), l("")],
                    "user-rating filled": [r(() => qs("#user-rating")?.innerHTML), not(eq), l("")],
                    "audience-rating filled": [r(() => qs("#audience-rating")?.innerHTML), not(eq), l("")],
                    "put-data=ViewCount filled": [r(() => qs("#view-count")?.innerHTML), not(eq), l("")],
                    "view-time filled": [r(() => qs("#view-time")?.innerHTML), not(eq), l("")],
                    "library filled": [r(() => qs("#library")?.value), not(eq), l("")],
                    "tz-selector set to user's tz": [r(() => qs("#tz-selector")?.value), eq, l('Atlantic/Reykjavik')],
                    _: {
                        legacy: {
                            tests: {
                                "displayEntryEditStyles()": [r(() => displayEntryEditStyles(qs("#root"))), call, l(() => qs("#style-editor").hidden === false)],
                            }
                        }
                    }
                }
            })()
        }
    })()

    if(category) {
        await doTestGroup({[category]: tests[category]})
    } else {
        await doTestGroup(tests as TestGroup)
    }

    await (async() => {
        const group = "account deletion"

        let res = await fetch(`${AIO}/account/delete`, {
            method: "DELETE",
            headers: {
                Authorization: `Basic ${btoa(`${username}:password`)}`
            }
        })

        doTest(group, "delete", [
            l(res.status), eq, l(200)
        ])
    })()


    const { pass, fail } = passFails.values()
        .reduce((p, c) => ({ pass: p.pass + c.pass, fail: p.fail + c.fail }), { pass: 0n, fail: 0n })
    let style = "color: red;"
    if (fail === 0n) {
        style = "color: limegreen"
    }
    console.info("%c%d/%d (%f%%)", style, pass, (pass + fail), Number(pass) / Number(pass + fail) * 100)
}
