class DisplayMode implements Mode {
    NAME = "entry-output"

    displayQueue: InfoEntry[]

    adding: boolean = false

    output: HTMLElement | DocumentFragment
    win: Window & typeof globalThis
    container: HTMLElement | null

    constructor(output?: HTMLElement | DocumentFragment, win?: Window & typeof globalThis) {
        this.win = win ||= window
        let c = null
        if(!output) {
            ({output, container: c} = this.mkcontainers(getElementOrThrowUI("#viewing-area", null, this.win.document)))
            c = output
        }
        this.output = output
        this.container = c
        this.displayQueue = []

        if (this.output instanceof this.win.HTMLElement) {
            this.output.addEventListener("scroll", (e) => {
                if (!(this.output instanceof this.win.HTMLElement))
                    throw new Error("this.parent mutated into a DocumentFragment when it was previously an HTMLElement")

                if (this.output.scrollHeight - this.output.scrollTop > innerHeight + 1000) return

                if (this.displayQueue.length) {
                    const item = this.displayQueue.shift()
                    if (item?.ItemId) {
                        renderDisplayItem.call(this, item.ItemId)
                    }
                }
            })
        }
    }

    mkcontainers(into: HTMLElement) {
        const c = this.mkcontainer()
        into.append(c)
        return { container: c, output: c }
    }

    mkcontainer() {
        const c = document.createElement("div")
        c.classList.add("overflow")
        c.id = 'entry-output'
        return c
    }

    displayEntryAction(func: (this: DisplayMode, item: InfoEntry, root: ShadowRoot, target: HTMLElement) => any) {
        return function(this: DisplayMode, target: HTMLElement) {
            let id = getIdFromDisplayElement(target)
            let item;
            (item = findInfoEntryById(id)) && func.call(this, item, target.getRootNode() as ShadowRoot, target)
        }.bind(this)
    }

    close() {
        if(this.container)
            this.container.remove()
        else {
            this.clearSelected()
            this.clear()
        }
        this.displayQueue = []
        this.adding = false
    }

    /**
     * Actions can be put onto elements with the entry-action attribute
     * **this element** refers to the element that the action is on
     * **current item** refers to the item that the
         * &lt;display-entry&gt; element parent is displaying
     */
    de_actions = { //{{{
        /**
         * Allows the user to choose a library for this item
         */
        chooselibrary: this.displayEntryAction((item) => {
            const libraries = Object.fromEntries(
                Object.entries(items_getLibraries())
                    .map(e => [e[0], items_getEntry(e[1].ItemId)]))

            const container = fillItemListingUI(libraries)
            selectItemUI({
                container,
                onsearch: async function(search) {
                    let results = await api_queryV4(search, getUidUI())
                    results = results.filter(v => v.Type == "Library")

                    return fillItemListingUI(Object.fromEntries(
                        results.map(v => [
                            String(v.ItemId),
                            new items_Entry(
                                v,
                                findUserEntryById(v.ItemId),
                                findMetadataById(v.ItemId)
                            )
                        ])
                    ))
                }
            }).then(id => {
                if(!id) return
                item.Library = id
                return api_setItem("", item, "Set library of item")
            })
            .then((res) => {
                if(!res) return
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
                alert(`Updated library to ${items_getEntry(item.Library).info.En_Title}`)
            })
        }),
        /**
         * Deletes a tag based on the target's tag-name
        */
        deletetag: this.displayEntryAction((item, root, target) => {
            const tag = target.getAttribute("tag-name")
            if (!tag) {
                console.warn("The target with entry-aciton=deletetag has no tag-name")
                alert("This button is not hooked up to a tag")
                return
            }

            api_deleteEntryTags(item.ItemId, [tag])
                .then(res => {
                    if (res?.status !== 200) return ""
                    res.text().then(() => {
                        item.Tags = item.Tags.filter((t: string) => t != tag)
                        updateInfo2({
                            [String(item.ItemId)]: {
                                info: item
                            }
                        })
                    })
                })
        }),

        /**
         * deletes a recommender from the list of recommended bys
         */
         deleterecommendedby: this.displayEntryAction((item, root, target) => {
             const r = target.getAttribute("recommender-idx")
             if(!r) {
                 console.warn("The target with entry-action=deleterecommendedby has no recommender-idx attribute")
                 alert("This button is not hooked up to a recommender-idx")
                 return
             }

             let idx = Number(r)
             let recs = items_getRecommendedBy(item.ItemId).filter((_, i) => i !== idx)
             item.RecommendedBy = JSON.stringify(recs)
             api_setItem("", item, "Remove recommender").then(() => {
                 updateInfo2({
                     [String(item.ItemId)]: {
                         info: item
                     }
                 })
             })
         }),

        /**
         * Deletes the item
         */
        delete: this.displayEntryAction(item => deleteEntryUI(item)),

        /**
         * Overwrites the metadata
         */
        refresh: this.displayEntryAction((item, root) => overwriteEntryMetadataUI(root, item)),

        /**
         * Attempts to set the location
         */
        fetchlocation: this.displayEntryAction((item) => _fetchLocation.call(this, item.ItemId)),

        /**
         * Saves changes to styles and the template
         */
        save: this.displayEntryAction((item, root) => saveItemChanges(root, item.ItemId)),

        /**
         * Deselects the current item
         */
        close: this.displayEntryAction(item => mode_deselectItem(item)),

        /**
         * Creates a copy of the current item
         */
        copythis: this.displayEntryAction(item => copyThis.call(this, item)),

        /**
         * Adds a copy fo the current object. The copy taht is added
         * is the copy with the id that is the value of this element
         */
        selectnewcopy: this.displayEntryAction(item => {
            selectItemUI().then(id => {
                if (!id) {
                    alert("Could not add copy")
                    return
                }
                api_addCopy(item.Uid, id, item.ItemId).then(() => {
                    items_addCopy(id, item.ItemId)
                    updateInfo2({
                        [String(item.ItemId)]: { info: item },
                        [String(id)]: { info: findInfoEntryById(id) }
                    })
                })
            })
        }),

        /**
         * Adds a child to the current object. The child that is added
         * is the child with the id that is the value of this element
         */
        addchild: this.displayEntryAction((item, _, target) => {
            if (!("value" in target)) {
                throw new Error("add child button has no value")
            }

            let childId = BigInt(String(target.value))
            let child = findInfoEntryById(childId)
            api_addChild(item.Uid, childId, item.ItemId).then(() => {
                items_addChild(child.ItemId, item.ItemId)
                updateInfo2({
                    [String(item.ItemId)]: { info: item },
                    [String(target.value)]: { info: child }
                })
            })
        }),

        /**
         * Lets the user select an item to be added as a requirement of
         * the current item
         */
        selectnewrequirement: this.displayEntryAction(item => {
            selectItemUI().then(id => {
                if (!id) {
                    alert("Could not add requirement")
                    return
                }

                api_addRequires(item.Uid, item.ItemId, id).then(() => {
                    let requirement = findInfoEntryById(id)
                    items_addRequires(item.ItemId, id)
                    updateInfo2({
                        [String(item.ItemId)]: { info: item },
                        [String(requirement.ItemId)]: { info: requirement }
                    })
                })
            })
        }),

        /**
         * Opens the new entry dialog
         * with requires filled in as the current item
         */
        newrequires: this.displayEntryAction(item => {
            const newEntryDialog = getElementOrThrowUI("#new-entry", this.win.HTMLDialogElement, this.output.ownerDocument)
            const requiresIdEl = getElementOrThrowUI(`[name="requires"]`, this.win.HTMLInputElement, newEntryDialog)

            requiresIdEl.value = String(item.ItemId)
            newEntryDialog.showModal()
        }),

        /**
         * Lets the user select an item to be added as a child of
         * the current item
         */
        selectnewchild: this.displayEntryAction(item => {
            selectItemUI().then(id => {
                if (!id) {
                    alert("Could not set child")
                    return
                }
                api_addChild(item.Uid, id, item.ItemId).then(() => {
                    let child = findInfoEntryById(id)
                    items_addChild(child.ItemId, item.ItemId)
                    updateInfo2({
                        [String(item.ItemId)]: { info: item },
                        [String(id)]: { info: child }
                    })
                })
            })
        }),

        /**
         * Creates a new item with the parentId set to the current item
         */
        newchild: this.displayEntryAction((item) => {
            const newEntryDialog = getElementOrThrowUI("#new-entry", this.win.HTMLDialogElement, this.output.ownerDocument)
            const parentIdInput = getElementOrThrowUI(`[name="parentId"]`, this.win.HTMLInputElement, newEntryDialog)

            parentIdInput.value = String(item.ItemId)
            newEntryDialog.showModal()
        }),

        /**
         * Sets the requirement
         */
        setrequired: this.displayEntryAction(function(item) {
            let id = item.ItemId

            fillItemListingUI(items_getAllMeta())
            selectItemUI().then(itemid => {
                itemid ||= 0n
                let info = findInfoEntryById(id)

                api_setItem("", info, "update the requirement")
                items_getEntry(id).relations.requires.push(itemid)
                updateInfo2({
                    [String(id)]: {
                        info
                    }
                })
            })
        }),

        /**
         * Creates a new item with copyOf set to the current item
         */
        newcopy: this.displayEntryAction((item) => {
            const newEntryDialog = getElementOrThrowUI("#new-entry", this.win.HTMLDialogElement, this.output.ownerDocument)
            const parentIdInput = getElementOrThrowUI(`[name="parentId"]`, this.win.HTMLInputElement, newEntryDialog)

            parentIdInput.value = String(item.ItemId)
            newEntryDialog.showModal()
        }),

        /**
         * Updates the custom styles with the value of this element
         * **NOTE**: DOES NOT SAVE
         */
        updatecustomstyles: this.displayEntryAction((item, root, target) => {
            const customStyles = root.getElementById("custom-styles")
            if (!(customStyles instanceof this.win.HTMLStyleElement)) {
                throw new Error("custom-styles must be a style element in order to update it")
            }

            if (!("value" in target)) { throw new Error("style editor must have a value attribute") }

            customStyles.innerText = String(target.value)

        }),

        /**
         * Updates the status of the current item with the value of this element
         */
        updatestatus: this.displayEntryAction((item, _, target) => {
            if (!(target instanceof this.win.HTMLSelectElement)) return

            updateStatusUI(item.ItemId, target.value as UserStatus)
        }),

        /**
         * Updates the cost, and event list
         *
         * This is called togglerelationinclude because it's supposed to be
         * called by the "include" checkboxes
         */
        togglerelationinclude: this.displayEntryAction((item, root) => {
            updateCostDisplay.call(this, root, item.ItemId)
            for(let el of root.querySelectorAll("#user-actions")) {
                if(!(el instanceof this.win.HTMLTableElement)) continue
                updateEventsDisplay.call(this, root, el, item.ItemId)
            }
        }),

        /**
         * Sets the current object table to the value of this element
         * Value can be
         * + user-extra
         * + meta-datapoints
         * + meta-media-dependant
         * + aio-web
         * + user
         * + meta
         * + entry
         */
        setobjtable: this.displayEntryAction((item, root, target) => {
            if (!("value" in target)) {
                throw new Error("set object table element has no value")
            }

            const objectTbl = getElementOrThrowUI("#display-info-object-tbl", this.win.HTMLTableElement, root)
            const user = findUserEntryById(item.ItemId)
            const meta = findMetadataById(item.ItemId)
            switch (target.value) {
                case "user-extra":
                    updateObjectTbl(JSON.parse(user.Extra), objectTbl)
                    break
                case "meta-datapoints":
                    updateObjectTbl(JSON.parse(meta.Datapoints), objectTbl)
                    break
                case "meta-media-dependant":
                    updateObjectTbl(JSON.parse(meta.MediaDependant), objectTbl)
                    break
                case "aio-web":
                    updateObjectTbl(getAIOWeb(user), objectTbl)
                    break
                case "user":
                    updateObjectTbl(user, objectTbl)
                    break
                case "meta":
                    updateObjectTbl(meta, objectTbl)
                    break
                case "entry":
                    updateObjectTbl(item, objectTbl)
                    break

            }
        }),

        /**
         * Toggles the art style of the current item,
         * the value of this element is used as the art style to toggle
         */
        toggleartstyle: this.displayEntryAction((item, _, target) => {
            if (!("checked" in target)) return

            const as = target.id.slice(3) as ASName
            if (target.checked) {
                items_setArtStyle(item, as as ASName)
            } else {
                items_unsetArtStyle(item, as)
            }

            api_setItem("", item).then(() => {
                alert(target.checked ? `${as} set` : `${as} unset`)
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
        }),

        /**
         * Sets the thumbnail of the current item to the value of this element
         */
        setthumbnail: this.displayEntryAction((item, _, target) => {
            const fileUpload = target.getRootNode().getElementById("thumbnail-file-upload")
            if (!fileUpload || !("value" in fileUpload)) return

            fileUpload.click()
        }),

        /**
         * Toggles the digitization of the current item based on
         * the checked state of this element
         */
        setdigitization: this.displayEntryAction((item, _, target) => {
            if (!target || !(target instanceof this.win.HTMLInputElement)) return
            if (target.checked) {
                item.Format |= DIGI_MOD
            } else if (items_isDigitized(item.Format)) {
                item.Format -= DIGI_MOD
            }
            api_setItem("", item).then(() => {
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
        }),

        /**
         * Toggles a display item with id of the value of
         * the elem-id attribute on this element
         */
        toggle: this.displayEntryAction((item, root, elem) => {
            let id = elem.getAttribute("elem-id")
            if (!id) return
            let toShow = root.getElementById(id)
            if (!toShow) return
            if (toShow instanceof this.win.HTMLDialogElement) {
                if (toShow.open) {
                    toShow.close()
                } else {
                    toShow.showModal()
                }
            } else {
                toShow.hidden = !toShow.hidden
            }
        }),

        /**
         * Sets the format of the current item to the value of this element
         */
        setformat: this.displayEntryAction((item, _, target) => {
            if (!("value" in target)) return
            api_listFormats().then(formats => {
                if (!Object.keys(formats).includes(String(target.value))) return
                item.Format = Number(target.value)
                api_setItem("", item)
                    .catch(console.error)
                    .then(alert.bind(window, `Switched format to: ${formats[Number(target.value)]}`))
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
        }),

        /**
         * Sets the type of the current item to the value of this element
         */
        settype: this.displayEntryAction((item, _, target) => {
            if (!("value" in target)) return
            api_listTypes().then(types => {
                if (!types.includes(target.value as EntryType)) return
                item.Type = target.value as EntryType
                api_setItem("", item)
                    .catch(console.error)
                    .then(alert.bind(window, `Switched type to: ${target.value}`))
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
        }),

        //TODO: this function is a disaster, each edited object should probably get its own save function
        /**
         * Saves the current object table
         */
        saveobject: this.displayEntryAction((item, root) => {
            const tbl = root.getElementById("display-info-object-tbl")

            const editedObject = getElementOrThrowUI("#current-edited-object", this.win.HTMLSelectElement, root)?.value

            let into: Record<string, any> = {}
            let keyName
            let endpoint: Parameters<typeof api_setItem>["0"] = ""
            switch (editedObject) {
                case "meta":
                    endpoint = "metadata/"
                    break
                case "entry":
                    endpoint = ""
                    break
                case "user":
                    endpoint = "engagement/"
                    break
                case "user-extra":
                    into = findUserEntryById(item.ItemId) as UserEntry
                    keyName = "Extra"
                    endpoint = "engagement/"
                    break
                case "meta-datapoints":
                    into = findMetadataById(item.ItemId) as MetadataEntry
                    keyName = "Datapoints"
                    endpoint = "metadata/"
                    break
                case "meta-media-dependant":
                    into = findMetadataById(item.ItemId) as MetadataEntry
                    keyName = "MediaDependant"
                    endpoint = "metadata/"
                    break
                case "aio-web":
                    keyName = "_AIOWEB"
                    endpoint = "engagement/"
                    break
                default:
                    alert(`${editedObject} saving is not implemented yet`)
                    return
            }

            let newObj: Record<string, any> = {}
            for (let row of tbl?.querySelectorAll("tr:has(td)") || []) {
                let key = row.firstElementChild?.textContent || ""
                //invalid key
                if (editedObject === "entry" && key === "Tags") continue

                let valueEl = row.firstElementChild?.nextElementSibling
                if (!valueEl) continue
                let value = valueEl?.textContent || ""
                if (key == "") continue

                let valueType = valueEl.getAttribute("data-type")
                if (valueType === 'bigint') {
                    newObj[key] = BigInt(value)
                } else if (valueType === 'number') {
                    newObj[key] = Number(value)
                } else {
                    newObj[key] = value
                }
            }

            if (keyName && keyName !== "_AIOWEB")
                into[keyName] = JSON.stringify(newObj)
            else if (keyName === "_AIOWEB") {
                let user = findUserEntryById(item.ItemId)
                let extra = JSON.parse(user.Extra || "{}")
                extra["AIOWeb"] = newObj
                user.Extra = JSON.stringify(extra)
                into = user
                updateInfo2({
                    [String(item.ItemId)]: { user }
                })
            }
            else into = newObj

            if (editedObject === "entry") {
                into["Tags"] = findInfoEntryById(into["ItemId"]).Tags
            }

            const strId = String(item.ItemId)
            api_setItem(endpoint, into as UserEntry)
                .then(res => res?.text())
                .then(console.log)
                .catch(console.error)
            if (editedObject === "user-extra" || editedObject === "user") {
                updateInfo2({
                    [strId]: { user: into as UserEntry }
                })
            } else if (editedObject === "entry") {
                updateInfo2({
                    [strId]: { info: into as InfoEntry }
                })
            } else if (probablyMetaEntry(into)) {
                updateInfo2({
                    [strId]: { meta: into as MetadataEntry }
                })
            }
        }),

        /**
         * Creates a new field in the current object table
         * **NOTE**: fails if the current object table is one of:
         * + user
         * + meta
         * + entry
         */
        newobjectfield: this.displayEntryAction(async (item, root) => {
            const name = await promptUI("Field name")
            if (!name) return

            const editedObject = getElementOrThrowUI("#current-edited-object", this.win.HTMLSelectElement, root)?.value

            //These should not get arbitrary field names
            if (["user", "meta", "entry"].includes(editedObject)) return

            const obj: any = getCurrentObjectInObjEditor(item.ItemId, root)
            if (name in obj) return

            obj[name] = ""

            const objectTbl = getElementOrThrowUI("#display-info-object-tbl", this.win.HTMLTableElement, root)
            updateObjectTbl(obj, objectTbl, false)
        }),

        /**
         * Toggles the hiddenness of the #style-editor element
         */
        editstyles: this.displayEntryAction((item, root, elem) => {
            const styleEditor = root.getElementById("style-editor")
            if (!styleEditor) return
            if ("value" in styleEditor) {
                styleEditor.value = getUserExtra(findUserEntryById(item.ItemId), "styles")
            }
            styleEditor.hidden = !styleEditor.hidden
        }),

        /**
         * Toggles the hiddenness of the #template-editor element
         */
        edittemplate: this.displayEntryAction((item, root, elem) => {
            const templEditor = root.getElementById("template-editor")
            if (!templEditor) return

            templEditor.hidden = !templEditor.hidden
        }),

        /**
         * Opens a preview window to display what the custom template will
         * look like
         */
        previewtemplate: this.displayEntryAction(function(item, root) {
            const templEditor = root.getElementById("template-editor")
            if (!templEditor || !(templEditor instanceof this.win.HTMLTextAreaElement)) return

            const urlParams = new URLSearchParams(location.search)
            urlParams.set("item-id", String(item.ItemId))
            const preview = this.output.ownerDocument.open(location.pathname + "?" + urlParams.toString(), "_blank", "popup=true")
            if (!preview) return

            preview.onload = () => {
                preview.document.title = `${item.En_Title} PREVIEW`
                //this tells the new window that this is the template to use for this item no matter what
                preview.self.GLOBAL_TEMPLATE = { [`${item.ItemId}`]: templEditor.value }
            }

            templEditor._updatePreview = templEditor.oninput = () => {
                preview.self.GLOBAL_TEMPLATE = { [`${item.ItemId}`]: templEditor.value }
                preview.self.mode_deselectItem(item, false)
                preview.self.mode_selectItem(item, false)
            }
        }),

        /**
         * Copy user info to another item
         */
        copyto: this.displayEntryAction(async (item) => {
            let id = await promptNumber("Copy user info to (item id)", "Not a number, mmust be item id number", BigInt)
            if (id === null) return
            let idInt = BigInt(id)

            api_copyUserInfo(item.ItemId, idInt)
                .then(res => res?.text())
                .then(console.log)
        }),

        /**
         * Asks the user to set the number of minutes they've spent
         * on the current item
         */
         setviewminutes: this.displayEntryAction(async (item) => {
            let count = await promptNumber("The number of minutes you've spent viewing this entry", 'Not a number, minutes spent')
            if (count === null) return

            authorizedRequest(`${apiPath}/engagement/mod-entry?id=${item.ItemId}&minutes=${count}`)
                .then(res => res?.text())
                .then(alert)
                .then(() => {
                    let user = findUserEntryById(item.ItemId)
                    if (!user) {
                        refreshInfo(getUidUI()).then(() => {
                            refreshDisplayItem.call(this, item.ItemId)
                        })
                    } else {
                        user.Minutes = count
                        updateInfo2({
                            [String(item.ItemId)]: { user }
                        })
                    }
                })
                .catch(console.error)
         }),

        /**
         * Asks the user to set the view count of the current item
         */
        setviewcount: this.displayEntryAction(async (item) => {
            let count = await promptNumber("New view count", 'Not a number, view count')
            if (count === null) return

            authorizedRequest(`${apiPath}/engagement/mod-entry?id=${item.ItemId}&view-count=${count}`)
                .then(res => res?.text())
                .then(alert)
                .then(() => {
                    let user = findUserEntryById(item.ItemId)
                    if (!user) {
                        refreshInfo(getUidUI()).then(() => {
                            refreshDisplayItem.call(this, item.ItemId)
                        })
                    } else {
                        user.ViewCount = count
                        updateInfo2({
                            [String(item.ItemId)]: { user }
                        })
                    }
                })
                .catch(console.error)
        }),

        /**
         * Asks the user to set the current position of the current item
         */
        setprogress: this.displayEntryAction(async (item, root) => {
            const user = findUserEntryById(item.ItemId) as UserEntry
            let newEp = await promptUI("Current position", undefined, undefined, user.CurrentPosition)
            if (!newEp) return

            await api_setPos(item.ItemId, String(newEp))
            user.CurrentPosition = String(newEp)
            updateInfo2({
                [String(item.ItemId)]: { user }
            })
        }),

        /**
         * Asks teh user to set the rating of the current item
         */
        setrating: this.displayEntryAction(async (item) => {
            let user = findUserEntryById(item.ItemId)
            if (!user) {
                alert("Failed to get current rating")
                return
            }
            let newRating = await promptUI("New rating")
            if (!newRating || isNaN(Number(newRating))) {
                return
            }

            api_setRating(item.ItemId, newRating)
                .then(async () => {
                    let user = findUserEntryById(item.ItemId)
                    await loadUserEvents(item.Uid)
                    user.UserRating = Number(newRating)
                    updateInfo2({
                        [String(item.ItemId)]: { user, events: findUserEventsById(item.ItemId) }
                    })
                })
                .catch(console.error)
            api_registerEvent(item.ItemId, `rating-change - ${user?.UserRating} -> ${newRating}`, Date.now(), 0)
                .then(() => {
                    reloadEventsUI(item.ItemId)
                })
                .catch(console.error)
        }),
    } as const //}}}

    add(entry: InfoEntry) {
        const el = renderDisplayItem.call(this, entry.ItemId)

        //shortcut: <c-s-a-MouseLeft>
        //replicate what happens when the template editor button is clicked
        //this way if the user locks themselves out of the template editor
        //they can always do this
        el.onmousedown = (e) => {
            if (e.ctrlKey && e.altKey && e.shiftKey && e.button === 0) {
                e.preventDefault()
                const toShow = el.shadowRoot?.querySelector("#template-editor-container")
                if (!toShow || !(toShow instanceof this.win.HTMLElement)) return
                if (toShow instanceof this.win.HTMLDialogElement) {
                    if (toShow.open) {
                        toShow.close()
                    } else {
                        toShow.showModal()
                    }
                } else {
                    toShow.hidden = !toShow.hidden
                }
            }
        }
        return el
    }

    sub(entry: InfoEntry) {
        removeDisplayItem.call(this, entry.ItemId)
    }

    chwin(win: Window & typeof globalThis) {
        const newOutput = Mode.prototype.chwin.call(this, win)

        this.output = newOutput

        newOutput.addEventListener("scroll", (e) => {
            if (newOutput.scrollHeight - newOutput.scrollTop > innerHeight + 1000) return

            if (this.displayQueue.length) {
                const item = this.displayQueue.shift()
                if (item?.ItemId) {
                    renderDisplayItem.call(this, item.ItemId)
                }
            }
        })
        return newOutput
    }

    refresh(id: bigint) {
        let el = this.output.querySelector(`display-entry[data-item-id="${id}"]`) as HTMLElement
        //only refresh if the item is on screen
        if (el)
            refreshDisplayItem.call(this, id)
    }

    addList(entry: InfoEntry[]) {
        this.adding = true;
        (async () => {
            //We need to keep track of whether or not we're adding so that
            //it can be canceled
            //such as in the case when we are still adding, but mode_clearItems()
            //is called
            for (let i = 0; i < entry.length && this.adding; i++) {
                if ("scheduler" in window && i % 10 === 0 && i !== 0) {
                    //@ts-ignore
                    await window.scheduler.yield()
                } else if (i > 5 && !("scheduler" in window)) {
                    this.displayQueue.push(entry[i])
                } else {
                    renderDisplayItem.call(this, entry[i].ItemId)
                }
            }

            this.adding = false
        })()
    }

    subList(entry: InfoEntry[]) {
        const itemIdsToRemove = entry.map(v => v.ItemId)
        this.displayQueue = this.displayQueue.filter(i => !itemIdsToRemove.includes(i.ItemId))

        for (let item of entry) {
            removeDisplayItem.call(this, item.ItemId)
        }
    }

    put(html: string | HTMLElement | ShadowRoot) {
        this.output.append(html)
    }

    clearSelected() {
        this.displayQueue.length = 0
        this.adding = false
        // displayEntryIntersected.clear()
        for (let child of this.output.querySelectorAll("display-entry")) {
            const itemId = child.getAttribute("data-item-id")
            if (!itemId) continue
            removeDisplayItem.call(this, BigInt(itemId))
        }
    }

    clear() {
        for (let child of this.output.childNodes) {
            if (child.nodeName === 'DISPLAY-ENTRY') continue
            child.remove()
        }
    }
}

async function itemIdentification(form: HTMLFormElement) {
    closeModalUI("item-identification-form", form.getRootNode() as ShadowRoot)
    let data = new FormData(form)

    let provider = data.get("provider") as string

    let queryType = data.get("query-type") as "by-title" | "by-id"

    let search = data.get("search") as string

    let shadowRoot = form.getRootNode() as ShadowRoot

    let itemId = shadowRoot.host.getAttribute("data-item-id")

    if (!itemId) {
        alert("Could not get item id")
        return
    }

    let finalItemId = ""

    switch (queryType) {
        case "by-title":
            let titleSearchContainer = getElementOrThrowUI("#identify-items", HTMLDialogElement, shadowRoot)
            finalItemId = await titleIdentification(provider, search, titleSearchContainer) || ""

            if (!finalItemId) {
                alert("Failed to identify item")
                return
            }

            break
        case "by-id":
            finalItemId = search
            break
    }

    api_finalizeIdentify(finalItemId, provider, BigInt(itemId))
        .then((res) => res?.text())
        .then((json) => {
            if (!json) {
                alert(`Failed to reload meta: ${json}, please refresh`)
                return
            }

            const newMeta = [...api_deserializeJsonl<MetadataEntry>(json)][0]

            //if the provider also has a location provider might as well get the location for it
            if (["steam", "sonarr"].includes(provider)) {
                fetchLocationUI(BigInt(itemId), provider)
            }

            updateInfo2({
                [String(itemId)]: {
                    meta: newMeta
                }
            })
        })
}

async function titleIdentification(provider: string, search: string, selectionElemOutput: HTMLElement): Promise<string | null> {
    let res = await api_identify(search, provider)
    if (!res) {
        return null
    }
    let text = await res.text()
    let [_, rest] = text.split("\x02")

    let items: any[]
    try {
        items = rest.split("\n").filter(Boolean).map(v => JSON.parse(v))
    }
    catch (err) {
        console.error("Could not parse json", rest.split('\n'))
        return ""
    }

    let obj = Object.fromEntries(items.map(v => [String(v.ItemId), v]))
    const container = fillItemListingUI(obj)
    let item = await selectItemUI({
        container,
        async onsearch(query) {
            let res = await api_identify(query, provider)
            if (!res) return document.createElement("div")
            let text = await res.text()
            let [_, rest] = text.split("\x02")
            let items = rest.split("\n").filter(Boolean).map(v => JSON.parse(v))
            let obj = Object.fromEntries(items.map(v => [String(v.ItemId), v]))
            return fillItemListingUI(obj)
        },
    })
    return item ? String(item) : null
}


function saveItemChanges(root: ShadowRoot, itemId: bigint) {
    let userEntry = findUserEntryById(itemId)
    if (!userEntry) return

    const customStylesElem = root.getElementById("style-editor")
    const customTemplElem = root.getElementById("template-editor")

    if (customStylesElem && "value" in customStylesElem)
        setUserExtra(userEntry, "styles", String(customStylesElem.value))

    if (customTemplElem && "value" in customTemplElem) {
        let val = String(customTemplElem.value).trim()
        setUserExtra(userEntry, "template", val)
    }

    api_setItem("engagement/", userEntry)
        .then(res => res?.text())
        .then(() => alert("saved user info"))
        .catch(console.error)

    updateInfo2({
        [String(itemId)]: {
            user: userEntry
        }
    })
}

function changeDisplayItemData(this: DisplayMode, item: InfoEntry, user: UserEntry, meta: MetadataEntry, events: UserEvent[], el: HTMLElement) {
    updateDisplayEntryContents.call(this, item, user, meta, events, el.shadowRoot as ShadowRoot)
    el.setAttribute("data-item-id", String(item.ItemId))
}


function hookActionButtons(shadowRoot: ShadowRoot, itemId: bigint) {

    let multiActionButton = shadowRoot.querySelector('[data-action="Begin+Pause+Resume"]')

    if (multiActionButton) {
        multiActionButton.addEventListener("click", _ => {
            const item = findInfoEntryById(itemId) as InfoEntry

            let user = findUserEntryById(itemId)
            if (!user) return

            let action = ""

            const tz = INTL_OPTIONS.timeZone

            if (canBegin(user.Status)) {
                action = "begin"
            } else if (canResume(user.Status)) {
                action = "resume"
            } else if (canPause(user.Status)) {
                action = "pause"
            }

            if (!action) {
                alert("Cannot begin, resume, or pause")
                return
            }

            confirmUI(`Are you sure you want to ${action} this entry`)
                .then(() => {
                    return authorizedRequest(`${apiPath}/engagement/${action?.toLowerCase()}-media?id=${user.ItemId}&timezone=${encodeURIComponent(tz)}`)
                })
                .then(res => {
                    if (res && res.status === 200) {
                        updateStatusDisplay(action, shadowRoot)
                    } else if (!res) {
                        alert("Could not update status")
                        return ""
                    }
                    return res.text()
                })
                .then(text => {
                    alert(text)

                    Promise.all([loadUserEvents(getUidUI()), items_refreshUserEntries(getUidUI())]).then(() =>
                        updateInfo2({
                            [String(item.ItemId)]: {
                                user: findUserEntryById(item.ItemId)
                            }
                        })
                    )
                })
        })
    }

    for (let btn of shadowRoot.querySelectorAll("[data-action]") || []) {
        let action = btn.getAttribute("data-action") as string

        //this action does multiple things
        if (action?.includes("+")) continue

        btn.addEventListener("click", async (_) => {
            const item = findInfoEntryById(itemId) as InfoEntry
            confirmUI(`Are you sure you want to ${action} this entry`)
                .then(async () => {
                    let queryParams = `?id=${item.ItemId}`
                    if (action === "Finish") {
                        let rating = await promptNumber("Rating", "Not a number\nRating")
                        if (rating !== null) {
                            queryParams += `&rating=${rating}`
                        }
                    }

                    const tz = INTL_OPTIONS.timeZone
                    return authorizedRequest(`${apiPath}/engagement/${action?.toLowerCase()}-media${queryParams}&timezone=${encodeURIComponent(tz)}`)
                })
                .then(res => {
                    if (res && res.status === 200) {
                        updateStatusDisplay(action, shadowRoot)
                    } else if (!res) {
                        alert("Could not update status")
                        return ""
                    }
                    return res.text()
                })
                .then(text => {
                    alert(text)
                    Promise.all([loadUserEvents(item.Uid), items_refreshUserEntries(item.Uid)]).then(() =>
                        updateInfo2({
                            [String(item.ItemId)]: {
                                user: findUserEntryById(item.ItemId),
                                events: findUserEventsById(item.ItemId),
                            }
                        })
                    )
                })

        })
    }


    const fileUpload = shadowRoot.getElementById("thumbnail-file-upload")

    if (fileUpload instanceof HTMLInputElement && "files" in fileUpload) {
        fileUpload.onchange = async function(_) {
            const item = findInfoEntryById(itemId) as InfoEntry

            const reader = new FileReader()
            const blob = (fileUpload.files)?.[0]
            if (!blob) return
            reader.readAsDataURL(blob)
            reader.onload = () => {
                if (!reader.result) return
                let result = reader.result.toString()
                api_setThumbnail(item.ItemId, result)
                    .then(() => {
                        let meta = findMetadataById(item.ItemId)
                        meta.Thumbnail = result
                        updateInfo2({
                            [String(item.ItemId)]: {
                                meta
                            }
                        })
                    })
            }
        }
    }
}


function whatToInclude(el: ShadowRoot): { self: boolean, children: boolean, copies: boolean, recursive: boolean, requires: boolean } {
    const self = (el.getElementById("include-self-in-cost") as HTMLInputElement)?.checked
    const children = (el.getElementById("include-children-in-cost") as HTMLInputElement)?.checked
    const copies = (el.getElementById("include-copies-in-cost") as HTMLInputElement)?.checked
    const requires = (el.getElementById("include-requires-in-cost") as HTMLInputElement)?.checked
    const recursive = (el.getElementById("include-recusively-in-cost") as HTMLInputElement)?.checked
    return {
        self,
        children,
        copies,
        requires,
        recursive
    }
}

function updateCostDisplay(this: DisplayMode, el: ShadowRoot, itemId: bigint) {
    const costEl = el.getElementById("cost")
    if (!costEl) return

    const info = findInfoEntryById(itemId)
    if (!info) return

    const { self, children, copies, recursive, requires } = whatToInclude(el)

    costEl.innerText = String(items_calculateCost(itemId, self, children, copies, requires, recursive))
}

function updateEventsDisplay(this: DisplayMode, el: ShadowRoot, eventsTbl: HTMLTableElement, itemId: bigint, eventFilter = "") {

    const { self, children, copies, recursive, requires } = whatToInclude(el)

    const eventsToLookAt = items_findAllEvents(itemId, self, children, copies, requires, recursive)
        .filter(v => {
            if(!eventFilter) return true
            return v.Event.includes(eventFilter) ||
                findInfoEntryById(v.ItemId).En_Title.includes(eventFilter)
        })
        .sort(items_compareEventTiming).reverse()


    let hasNonSelfEvent = false
    let tbodyHTML = ""


    for(let event of eventsToLookAt) {
        if(event.ItemId !== itemId) {
            hasNonSelfEvent = true
        }
    }

    for (let event of eventsToLookAt) {
        tbodyHTML += `<tr>`

        if(hasNonSelfEvent) {
            if(event.ItemId !== itemId) {
                tbodyHTML += `<td>${findInfoEntryById(event.ItemId).En_Title}</td>`
            } else {
                tbodyHTML += `<td><b>self</b></td>`
            }
        }

        tbodyHTML += ` <td>
            <div class="grid column">
                <button class="delete" onclick="deleteEventByEventId(${event.EventId}).then(res => res && reloadEventsUI(${event.ItemId}n))">🗑</button>
                ${event.Event}
            </div>
        </td>`

        tbodyHTML += `<td>${items_eventTSHTML(event)}</td>`
    }

    eventsTbl.innerHTML = `
            <thead>
                <tr>
                    ${hasNonSelfEvent ? "<th>For</th>" : ""}
                    <!-- this nonsense is so that the title lines up with the events -->
                    <th>
                        <div class="grid column">
                            <button onclick="openEventFormUI('${itemId}')">➕︎</button><span style="text-align: center">Event</span>
                        </div>
                    </th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
            ${tbodyHTML}
            </tbody>
        `
}

async function createRelationButtons(thisId: bigint, elementParent: HTMLElement, relationGenerator: Generator<items_Entry>, relationType: "descendants" | "copies" | "required-items") {
    var relationships = relationGenerator.toArray()
    let titles = relationships.map(i => i.info.En_Title)

    relationships = relationships.sort((a, b) => {
        return (items_sequenceNumberGrabber(a.info.En_Title, titles) || 0) - (items_sequenceNumberGrabber(b.info.En_Title, titles) || 0)
    })

    const elements = []

    for (let child of relationships) {
        child = await items_getEntryAny(child.ItemId)
        let el = createClickableEntryUI(child.ItemId)

        el.setAttribute("data-view-count", String(child.user.ViewCount))
        elements.push(el)

        el.addEventListener("contextmenu", e => {
            e.preventDefault()
            const confirmationText = {
                "descendants": "Would you like to remove this item as a descendant of it's parent",
                "copies": "Would you like to remove this item as a copy",
                "required-items": "Would you like to remove this item as a requirement"
            }

            confirmUI(confirmationText[relationType])
                .then(() => {
                    const [apiFunc, itemsFunc] = ({
                        "copies": [api_delCopy, items_removeCopy],
                        "descendants": [api_delChild, items_removeChild],
                        "required-items": [
                            (uid: number, right: bigint, left: bigint) => api_delRequires(uid, left, right),
                            (right: bigint, left: bigint) => items_removeRequires(left, right)
                        ],
                    } as const)[relationType]

                    //since copyof left/right doesn't matter
                    //we'll just use the left/right for adding a child
                    apiFunc(child.info.Uid, child.ItemId, thisId).then(() => {
                        itemsFunc(child.ItemId, thisId)
                        updateInfo2({
                            [String(thisId)]: { info: findInfoEntryById(thisId) },
                            [String(child.ItemId)]: { info: child.info }
                        })
                    })
                })
        })
    }

    elementParent.replaceChildren(...elements)
}

function updateStatusDisplay(newStatus: string, display: HTMLElement) {
    if (!display || !("value" in display)) return

    display.value = newStatus
    // statusText.innerText = newStatus
}

function updateObjectTbl(obj: object, objectTbl: HTMLTableElement, clear = true) {

    if (clear) {
        const firstTr = objectTbl.firstElementChild
        //remove all rows except the first
        while (objectTbl.lastElementChild && objectTbl.lastElementChild !== firstTr) {
            objectTbl.removeChild(objectTbl.lastElementChild)
        }
    }

    for (let key in obj) {
        let val = obj[key as keyof typeof obj] as any
        //if the key alr is in the table, and we aren't clearing, then skip
        //otherwise the key will get duplicated
        if (objectTbl.querySelector(`[data-keyname="${key}"]`) && !clear) {
            continue;
        }
        const tr = document.createElement("tr")
        const nameTd = document.createElement("td")
        const valTd = document.createElement("td")

        nameTd.setAttribute("data-keyname", key)
        nameTd.innerText = key

        valTd.setAttribute("data-type", typeof val)
        if (typeof val === 'bigint') {
            val = String(val)
        }
        else if (typeof val !== 'string' && typeof val !== 'number') {
            val = JSON.stringify(val)
        }
        valTd.innerText = val

        valTd.contentEditable = "true"
        nameTd.contentEditable = "true"

        tr.append(nameTd)
        tr.append(valTd)

        objectTbl.append(tr)
    }
}

function getCurrentObjectInObjEditor(itemId: bigint, el: ShadowRoot): object {
    const editedObject = (el.getElementById("current-edited-object") as HTMLSelectElement).value
    const user = findUserEntryById(itemId) as UserEntry
    const meta = findMetadataById(itemId) as MetadataEntry

    switch (editedObject) {
        case "user-extra":
            return JSON.parse(user.Extra) || {}
        case "meta-datapoints":
            return JSON.parse(meta.Datapoints) || {}
        case "meta-media-dependant":
            return JSON.parse(meta.MediaDependant) || {}
        case "aio-web":
            return getAIOWeb(user)
        case "user":
            return user || {}
        case "meta":
            return meta || {}
        case "entry":
            return findInfoEntryById(itemId) || {}
        default:
            return {}
    }
}


/**
 * @description updates special-case legacy elements
 */
async function updateDisplayEntryContents(this: DisplayMode, item: InfoEntry, user: UserEntry, meta: MetadataEntry, events: UserEvent[], el: ShadowRoot) {
    const renderComponent = (query: string,
        fill: (element: HTMLElement, itemId: bigint) => any) => {
        for (let l of el.querySelectorAll(query)) {
            fill(l as HTMLElement, item.ItemId)
        }
    }

    //just in case we have generic metadata
    //if meta is not generic, this operation is cheap, no need for a guard
    meta = await findMetadataByIdAtAllCosts(meta.ItemId)

    renderComponent("#library", el => {
        if(!("value" in el)) return
        if(!item.Library) {
            el.value = "None"
            return
        }
        el.value = items_getEntry(item.Library).info.En_Title
    })

    renderComponent("#recommended-bys", el => {
        el.querySelectorAll("div").forEach(div => div.remove())
        let i = 0
        for(let r of items_getRecommendedBy(item.ItemId)) {
            const recommender = document.createElement("de-recommender")
            el.append(recommender)

            const b = getElementOrThrowUI('[role="button"]', this.win.HTMLElement, recommender)
            b.setAttribute("recommender", r)
            const db = getElementOrThrowUI("button.delete", this.win.HTMLElement, recommender)
            db.setAttribute("recommender-idx", String(i))

            const s = getElementOrThrowUI("span", this.win.HTMLElement, recommender)
            s.append(r)
            i++
        }
    })

    //item item interaction menu
    renderComponent("#item-interaction-menu", el => {
        if (!(el instanceof this.win.HTMLElement)) return
        const buttons = settings_get("de_item_interactions")

        let btns = []

        for (let btnCls in buttons) {
            let btnData = buttons[btnCls as keyof typeof buttons]
            const btn = document.createElement("button")
            btn.setAttribute("toggle-hint", "")

            if("text" in btnData) {
                const txt = document.createElement("span")
                txt.append(btnData.text)
                btn.append(txt)
            }


            if ("title" in btnData) {
                const hint = document.createElement("span")
                hint.setAttribute("popover", "hint")
                hint.append(btnData.title)
                btn.append(hint)
            }

            if("shortTitle" in btnData) {
                const st = document.createElement('span')
                st.append(btnData.shortTitle)
                btn.append(st)
            }

            if ("attributes" in btnData) {
                for (let attr in btnData.attributes) {
                    btn.setAttribute(attr, btnData.attributes[attr as keyof typeof btnData.attributes])
                }
            }

            if ("action" in btnData) {
                btn.setAttribute("entry-action", btnData.action)
            }

            btns.push(btn)
        }

        el.replaceChildren(...btns)
    })

    renderComponent("#display-info-object-tbl", objTable => {
        if (!(objTable instanceof this.win.HTMLTableElement)) {
            console.warn("#display-info-object-tbl must be a <table>")
            return
        }

        updateObjectTbl(getCurrentObjectInObjEditor(item.ItemId, el), objTable)
    })

    renderComponent("#status-selector",
        el => updateStatusDisplay(user.Status, el))

    renderComponent("#cost", l => {
        const { self, children, copies, recursive, requires } = whatToInclude(el)
        l.innerText = String(items_calculateCost(item.ItemId, self, children, copies, requires, recursive))
    })

    renderComponent("#tz-selector", tzEl => {
        if (!(tzEl instanceof this.win.HTMLSelectElement)) {
            console.warn("#tz-selector must be a <select>")
            return
        }
        tzEl.value = INTL_OPTIONS.timeZone
    })

    //Art Style
    api_listArtStyles().then(as => {
        for (let a in as) {
            renderComponent(`#is-${as[a]}`, cb => {
                if (!cb || !(cb instanceof HTMLInputElement)) return
                if (items_hasArtStyle(item, Number(a) as ArtStyle)) {
                    cb.checked = true
                }
            })
        }
    })

    renderComponent("#location-link", el => {
        if (!("value" in el)) return
        let loc = item.Location
        el.value = loc
    })

    //user styles
    renderComponent("#custom-styles", el => {
        let userExtra = getUserExtra(user, "styles")
        let styles = userExtra || ""
        el.innerText = styles
    })

    //type selector
    renderComponent("#type-selector", el => {
        if (!(el instanceof this.win.HTMLSelectElement)) {
            console.warn("#type-selector must be a <select>")
            return
        }
        fillTypeSelectionUI(el).then(() => {
            el.value = item.Type
        })
    })

    //format selector
    renderComponent("#format-selector", formatSelector => {
        if (!(formatSelector instanceof this.win.HTMLSelectElement)) {
            console.warn("#format-selector must be a <select>")
            return
        }
        fillFormatSelectionUI(formatSelector).then(() => {
            if (items_isDigitized(item.Format)) {
                formatSelector.value = String(item.Format - DIGI_MOD)
            } else {
                formatSelector.value = String(item.Format)
            }
        })
    })


    renderComponent("#format-digitized", () => {
        const digitized = el.getElementById("format-digitized")
        if (!(digitized instanceof this.win.HTMLInputElement)) {
            console.warn("#format-digitized must be a <input>")
            return
        }
        digitized.checked = items_isDigitized(item.Format)
    })


    renderComponent("#genres", genresRoot => {
        const genres = JSON.parse(meta.Genres || "[]")
        const children = []
        for (let genre of genres) {
            const el = document.createElement("button")
            el.classList.add("genre")
            el.onclick = function() {
                ui_search(`#g:${genre.replaceAll(" ", "\\ ")}`)
            }
            el.append(genre)
            children.push(el)
        }
        genresRoot.replaceChildren(...children)
    })

    //tags
    renderComponent("#tags", tagsRoot => {
        tagsRoot.querySelectorAll("div").forEach(div => div.remove())

        const tagTempl = el.querySelector("template#tag") as HTMLTemplateElement
        if (tagTempl)
            for (let tag of item.Tags || []) {
                tag = tag.trim()
                if (!tag) continue

                const copy = tagTempl.content.cloneNode(true) as HTMLElement
                const del = copy.querySelector("#delete-tag") as HTMLElement

                del.setAttribute("tag-name", tag)

                const btn = copy.querySelector("#tag-name") as HTMLElement
                btn.prepend(tag)
                btn.setAttribute("tag-name", tag)

                btn.onclick = function(e) {
                    if (e.target?.id === "delete-tag") return

                    let btn = e.target as HTMLButtonElement
                    let tag = btn.getAttribute("tag-name")
                    ui_search(`#tag:${tag}`)
                }

                tagsRoot?.prepend(copy)
            }
    })

    //type icon
    let typeIcon = typeToSymbol(item.Type)
    let formatIcon = formatToSymbolUI(item.Format)
    renderComponent("#on-format", async (onFormat) => {
        const name = await formatToName(item.Format)
        if (!(name).startsWith("UNOWNED")) {
            onFormat.title = name
            onFormat.innerHTML = formatToSymbolUI(item.Format)
        }
    })

    renderComponent("#media-type", el => {
        el.innerText = typeIcon
        el.title = item.Type
    })
    renderComponent("#country-origin", el => {
        if(meta.Country) {
            let flags = items_countryOfOrigin2Flag(meta.Country)
            el.title = ` (${meta.Country})`
            el.innerText =  flags
        }
    })
    renderComponent("#main-title", displayEntryTitle => {
        displayEntryTitle.innerText = meta.Title || item.En_Title
        //only set the title of the heading to the user's title if the metadata title exists
        //otherwise it looks dumb
        if (meta.Title && item.En_Title) {
            displayEntryTitle.title = item.En_Title
        }

        displayEntryTitle?.setAttribute("data-type-icon", typeIcon)
        if (getUidUI() !== item.Uid)
            displayEntryTitle?.setAttribute("data-owner", ACCOUNTS[item.Uid] || (item.Uid && `uid ${item.Uid}`) || 'unknown')

        displayEntryTitle?.setAttribute("data-format-icon", formatIcon)

        if(meta.Country) {
            let flags = items_countryOfOrigin2Flag(meta.Country)
            displayEntryTitle.title += ` (${meta.Country})`
            displayEntryTitle.setAttribute("data-country-origin-flag", flags)
        }

        //format
        formatToName(item.Format).then(name => {
            displayEntryTitle?.setAttribute("data-format-name", name)
        })
    })




    //Native title
    renderComponent("#official-native-title", displayEntryNativeTitle => {
        displayEntryNativeTitle.innerText = meta.Native_Title || item.Native_Title
        //Same as with the regular title
        if (meta.Native_Title && item.Native_Title) {
            displayEntryNativeTitle.title = item.Native_Title
        }
    })

    //Thumbnail
    renderComponent("#thumbnail", imgEl => {
        if (!(imgEl instanceof this.win.HTMLImageElement)) {
            console.warn("#thumbnail must be an <img>")
            return
        }
        imgEl.alt = meta.Title || item.En_Title
        imgEl.src = fixThumbnailURL(meta.Thumbnail)
    })

    //Notes
    renderComponent("#notes-edit-box", notesEditBox => {
        if (!("value" in notesEditBox)) return
        notesEditBox.value = user.Notes
    })

    renderComponent("#notes", notesEl =>
        notesEl.innerHTML = parseNotes(user.Notes))

    //Rating
    renderComponent("#user-rating", ratingEl => {
        applyUserRating(user.UserRating, ratingEl)
        ratingEl.innerHTML = user.UserRating
            ? String(user.UserRating)
            : "Unrated"
    })

    //Audience Rating
    let max = meta.RatingMax
    renderComponent("#audience-rating", audienceRatingEl => {
        if (meta.Rating) {
            let rating = meta.Rating
            let normalizedRating = rating
            if (max !== 0) {
                normalizedRating = rating / max * 100
            }
            applyUserRating(normalizedRating, audienceRatingEl)
            audienceRatingEl.innerHTML = String(rating)
        } else if (audienceRatingEl) {
            audienceRatingEl.innerText = "Unrated"
        }
    })

    let data = meta
    let mediaDependant
    try {
        mediaDependant = JSON.parse(data["MediaDependant"] || "{}")
    } catch (err) {
        console.error("Could not parse media dependant meta info json")
        return
    }

    let type = item.Type

    //View count
    renderComponent("#view-time", viewCountEl => {
        const user = findUserEntryById(item.ItemId)
        let mins = user.Minutes
            || Number(user.ViewCount) * Number(mediaDependant[`${type}-length`] || 0)

        viewCountEl.title = String(mins) + " minutes"

        if (mins > 0 && user.Minutes !== mins && getUserExtra(user, "allow-minutes-override") === "true") {
            user.Minutes = mins
            api_setItem("engagement/", user).then(() => alert(`Updated viewing minutes to: ${mins}`))
        }
        viewCountEl.innerText = String((mins / 60).toFixed(2))
    })

    renderComponent("#media-info", mediaInfoTbl => {
        //remove the <Media>- part from the key looks ugly
        let modifiedKeys: { [k: string]: string } = {}
        for (let key in mediaDependant) {
            let title = key.split("-")[1]
            title = title[0].toLocaleUpperCase() + title.slice(1)
            const val = mediaDependant[key]
            modifiedKeys[title] = val
        }
        mkGenericTbl(mediaInfoTbl, modifiedKeys)
    })

    let userPos = parseInt(user.CurrentPosition)

    el.host.setAttribute("data-user-status", user.Status)

    //Media dependant
    let lengthInNumber: 0 | string = 0
    for(let key in mediaDependant) {
        if(
            key.endsWith("episodes")
            || key.endsWith(`volumes`)
            || key.endsWith(`chapters`)
            || key.endsWith(`page-count`)
        ) {
            lengthInNumber = mediaDependant[key]
        }
    }

    renderComponent("#entry-progressbar", progressEl => {
        if (!("max" in progressEl &&
            "value" in progressEl &&
            /(Re)?Viewing/.test(user.Status))) return
        progressEl.max = lengthInNumber || 1
        progressEl.value = userPos || 0
    })

    renderComponent("#entry-progressbar-position-label", captionEl => {
        captionEl.innerText = `${user.CurrentPosition}/${lengthInNumber}`
        captionEl.title = `${Math.round(userPos / parseInt(lengthInNumber || '0') * 1000) / 10}%`
    })

    renderComponent("#multiple-progress", multipleProgressEl => {
        //even if the status != (Re)?Viewing,
        //we should still clear all progress bars
        // multipleProgressEl.innerHTML = ""

        if (!/(Re)?Viewing/.test(user.Status)) return

        if(!user.CurrentPosition) {
            user = { ...user }
            user.CurrentPosition = "0"
        }

        multipleProgressEl.innerHTML = ""

        //for each [P]x[/y] in userPos create a progress element
        //for example "10, S1/3" would use 10 in the standard progress bar, then create a new progress bar for S with a max of 3 and value of 1
        //"10/30, S1/3" would use the standard progress bar for 10 but override lengthInNumber with 30, then create a second bar for S with max of 3 and value of 1
        //"10 S3" would create 2 progress bars, the first uses lengthInNumber as max, the 2nd uses 0 as max, so it would be S3/0
        //"," is optional
        const parts =
            user.CurrentPosition.split(/,\s*|\s+/)
                .map(v => v.trim())
                .map(v => v.match(/(\D*)(\d+(?:\.\d+)?)(?:\/(\d+))?/))

        for (let part of parts) {
            if (!part) continue
            let label = part[1]

            let container = document.createElement("de-progress")

            multipleProgressEl.append(container)

            let max =
                //if there's no label, and no total is given
                //use the mediaDependant determined length
                !label && part[3] === undefined
                    ? (lengthInNumber || "0")
                    : (part[3] || "0") //part[3] could be empty string

            let p = getElementUI(
                "progress",
                this.win.HTMLProgressElement,
                container
            )
            if(!p) break
            p.max = parseFloat(String(max))
            p.value = parseFloat(part[2])

            let c = getElementOrThrowUI(
                ".entry-progressbar-position-label",
                this.win.HTMLElement,
                container
            )
            const node = document.createTextNode(`${label || ""}${part[2]}`)
            if (parseInt(max)) {
                node.appendData( `/${max}`)
            }
            c.append(node)

            const upHint = getElementOrThrowUI(
                "#user-progress-hint",
                this.win.HTMLElement,
                c
            )
            upHint.innerHTML = `${(Math.round(parseFloat(part[2]) / parseInt(max) * 1000) / 10) || 0}%`
        }
    })

    //relation elements
    for (let relationship of [["descendants", findDescendants], ["copies", findCopies], ["required-items", findRequirements]] as const) {
        renderComponent(`#${relationship[0]}`, relationshipEl => {
            relationshipEl.innerHTML = ""
            createRelationButtons(
                item.ItemId,
                relationshipEl,
                relationship[1](item.ItemId),
                relationship[0]
            )
        })
    }

    //Events
    renderComponent("#user-actions", tbl => {
        if(!(tbl instanceof this.win.HTMLTableElement)) return
        updateEventsDisplay.call(this, el, tbl, user.ItemId)
    })

    //update this last because some legacy elements get filled with new elements
    //that rely on stuff like entry-action
    updateDeclarativeDSL(this.de_actions, item, user, meta, el)
}

function displayItemInWindow(itemId: bigint, target: string = "_blank", popup: boolean = false) {
    return openDisplayWinUI(itemId, target, popup)
}

/**
 * @description legacy version of de_actions.editstyles
 * @deprecated
 */
function displayEntryEditStyles(el: HTMLElement) {
    let root = el.getRootNode() as ShadowRoot
    const styleEditor = root.getElementById("style-editor")
    if (!styleEditor) return

    styleEditor.hidden = !styleEditor.hidden
}

/**
 * @description legacy version of de_actions.edittemplate
 * @deprecated
 */
function displayEntryEditTemplate(el: HTMLElement) {
    let root = el.getRootNode() as ShadowRoot
    const templEditor = root.getElementById("template-editor")
    if (!templEditor) return

    templEditor.hidden = !templEditor.hidden
}

function renderDisplayItem(this: DisplayMode, itemId: bigint, template?: string): HTMLElement {
    let el = document.createElement("display-entry")
    let root = el.shadowRoot

    if (!root) {
        throw new Error("shadow root is falsey while rendering display item")
    }

    const
        user = findUserEntryById(itemId),
        meta = findMetadataById(itemId),
        events = findUserEventsById(itemId),
        item = findInfoEntryById(itemId)

    let userStyles = getUserExtra(user, "styles")

    const renderComponent = function(query: string,
        fill: (element: HTMLElement, itemId: bigint) => any) {
        for (let el of root.querySelectorAll(query)) {
            fill(el as HTMLElement, itemId)
        }
    }

    //use the dumbest hack imaginable to allow the previewtemplate function to force the window it opens to do the rendering
    //that hack being setting a global variable called GLOBAL_TEMPLATE which is the template to use
    //@ts-ignore
    if (self.GLOBAL_TEMPLATE && String(itemId) in self.GLOBAL_TEMPLATE) {
        //@ts-ignore
        template = self.GLOBAL_TEMPLATE[String(itemId)]
    }

    if (template || ((template = getUserExtra(user, "template")?.trim()))) {
        (root.getElementById("root") as HTMLDivElement).innerHTML = template
    }

    this.output.append(el)

    hookActionButtons(root, itemId)

    renderComponent("#recommended-by",
        el => {
            if (!(el instanceof this.win.HTMLDataListElement)) {
                console.warn("#recommended-by must be a datalist element")
                return
            }
            fillRecommendedListUI(el, getUidUI())
        })

    api_listArtStyles().then(as => {
        for (let a in as) {
            renderComponent(`#is-${as[a]}`, el => {
                if (!el || !(el instanceof HTMLInputElement)) return
                el.onchange = (e) => e.target instanceof HTMLElement && this.de_actions.toggleartstyle(e.target)
            })
        }
    })

    renderComponent("#current-edited-object",
        el => {
            el.onchange =
                e =>
                    e.target instanceof this.win.HTMLElement &&
                    this.de_actions.setobjtable(e.target)
        })

    for (let input of [
        "include-self-in-cost",
        "include-copies-in-cost",
        "include-children-in-cost",
        "include-requires-in-cost",
        "include-recusively-in-cost"
    ]) {
        renderComponent(`#${input}`, el => {
            el.onchange =
                (e) =>
                    e.target instanceof this.win.HTMLElement &&
                    this.de_actions.togglerelationinclude(e.target)
        })
    }

    renderComponent("button.popout", el => popoutUI(el))
    renderComponent("#status-selector", el => {
        el.onchange =
            e =>
                e.target instanceof this.win.HTMLSelectElement &&
                this.de_actions.updatestatus(e.target)
    })

    renderComponent("#style-editor", el => {
        if (!(el instanceof this.win.HTMLTextAreaElement)) return
        el.value = userStyles || ""
        el.addEventListener("change", e => {
            e.target instanceof HTMLElement &&
                this.de_actions.updatecustomstyles(e.target)
        })
    })

    renderComponent("#template-editor", el => {
        if (!(el instanceof this.win.HTMLTextAreaElement)) return
        el.value = getUserExtra(user, "template") || ""
    })

    renderComponent("#new-child", el => {
        el.addEventListener("click", e => {
            this.de_actions.newchild(e.target as HTMLElement)
        })
    })

    renderComponent("#new-copy", el => {
        el.addEventListener("click", e => {
            this.de_actions.newcopy(e.target as HTMLElement)
        })
    })

    renderComponent("#new-child-by-id", el => {
        if (!("value" in el)) return
        el.onchange = e => {
            e.target instanceof HTMLElement && this.de_actions.addchild(e.target)
        }
    })

    renderComponent("#notes-edit-box", el => {
        if (!("value" in el)) return

        el.onchange = () => {
            updateNotesUI(item.ItemId, String(el.value))
        }
    })

    renderComponent("#cost", el => {
        el.onclick = async function() {
            await updateCostUI(itemId)
        }
    })

    renderComponent("#create-tag", el => {
        el.onclick = async () => {
            await newTagsUI(itemId)
        }
    })

    renderComponent("#create-recommended-by", el => {
        el.onclick = async () => {
            await newRecommendedByUI(itemId)
        }
    })

    renderComponent("#location-link", el => {
        if (!("value" in el)) return

        el.onchange = async () => {
            await updateLocationUI(itemId, String(el.value))
        }
    })

    renderComponent("#user-actions-filter", el => {
        if(!("value" in el)) return
        el.oninput = (e) => {
            renderComponent("#user-actions", eventsTbl => {
                if(!(eventsTbl instanceof this.win.HTMLTableElement)) return
                updateEventsDisplay.call(this, root, eventsTbl, itemId, String(el.value))
            })
        }
    })

    changeDisplayItemData.call(this, item, user, meta, events, el)
    return el
}

function removeDisplayItem(this: DisplayMode, itemId: bigint) {
    // displayEntryIntersected.delete(String(itemId))
    const el = this.output.querySelector(`[data-item-id="${itemId}"]`)
    if (!el) return
    el.remove()
}

function refreshDisplayItem(this: DisplayMode, itemId: bigint) {
    let el = this.output.querySelector(`display-entry[data-item-id="${itemId}"]`) as HTMLElement
    let info = findInfoEntryById(itemId)
    if (!info) return

    if (el) {
        let user = findUserEntryById(itemId)
        let events = findUserEventsById(itemId)
        let meta = findMetadataById(itemId)
        if (!info || !user || !events || !meta) return
        changeDisplayItemData.call(this, info, user, meta, events, el)
    } else {
        renderDisplayItem.call(this, itemId)
    }
}

function getIdFromDisplayElement(element: HTMLElement) {
    let rootNode = element.getRootNode() as ShadowRoot
    let host = rootNode.host
    if (!host) {
        return 0n
    }
    return BigInt(String(host.getAttribute("data-item-id")))
}

function _fetchLocationBackup(this: DisplayMode, itemId: bigint) {
    const item = findInfoEntryById(itemId) as InfoEntry

    let provider = item.Type === "Show" ? "sonarr" : "radarr"
    alert(`Using ${provider} to find location`)

    const popover = this.output.ownerDocument.getElementById("items-listing") as HTMLDivElement

    async function onfetchLocation(res: Response | null) {
        if (!res) {
            alert("Failed to set location")
            return
        }
        if (res.status !== 200) {
            console.error(await res.text())
            alert("Failed to set location")
            return
        }

        const newLocation = await res.text()
        alert(`Location set to: ${newLocation}`)
        item.Location = newLocation
        updateInfo2({
            [String(item.ItemId)]: { info: item }
        })
        // popover.hidePopover()
    }

    api_identify(item.En_Title || item.Native_Title, provider).then(async (res) => {
        if (!res) return

        if (res.status !== 200) {
            alert("Failed to find entries")
            return
        }

        const [_, metaText] = (await res.text()).split("\x02")
        const metaInfo = [...api_deserializeJsonl<MetadataEntry>(metaText.trim().split("\n"))]

        //TODO: if the length is 0, ask the user for a search query

        if (metaInfo.length === 1) {
            api_fetchLocation(item.ItemId, getUidUI(), provider, String(metaInfo[0].ItemId)).then(onfetchLocation)
            return
        }

        const metaRecord = Object.fromEntries(metaInfo.map(v => [v.ItemId, v]))

        const container = fillItemListingUI(metaRecord)

        const figs = container.querySelectorAll("figure")
        for (const fig of figs) {
            fig.onclick = function() {
                const id = fig.getAttribute("data-item-id") as string
                api_fetchLocation(item.ItemId, getUidUI(), provider, id)
                    .then(onfetchLocation)
            }
        }

        popover.showPopover()
    })
}

function _fetchLocation(this: DisplayMode, itemId: bigint) {
    api_fetchLocation(itemId, getUidUI())
        .then(async (res) => {
            if (res == null) {
                alert("Failed to get location")
                return
            }

            let newLocation = await res.text()

            if (res.status !== 200) {
                alert("Failed to get location, loading possible options")
                if (newLocation.includes("could not")) {
                    _fetchLocationBackup.call(this, itemId)
                }
                return
            }

            const info = findInfoEntryById(itemId) as InfoEntry
            info.Location = newLocation

            updateInfo2({
                [String(itemId)]: { info }
            })
            alert(`Location set to: ${newLocation}`)
        })
}

function copyThis(this: DisplayMode, item: InfoEntry) {
    const user = findUserEntryById(item.ItemId) as UserEntry
    const meta = findMetadataById(item.ItemId) as MetadataEntry
    const events = findUserEventsById(item.ItemId) as UserEvent[]

    api_createEntry({
        title: item.En_Title,
        "native-title": item.Native_Title,
        timezone: INTL_OPTIONS.timeZone,
        format: item.Format,
        price: item.PurchasePrice,
        "art-style": item.ArtStyle,
        libraryId: item.Library || undefined,
        copyOf: item.ItemId,
        tags: item.Collection,
        location: item.Location,
        "user-notes": user.Notes,
        "user-status": user.Status,
        "user-view-count": user.ViewCount,
        "user-rating": user.UserRating,
        "get-metadata": false,
        type: item.Type,
    }).then(async (res) => {
        if (!res || res.status !== 200) {
            alert("failed to create copy")
            return
        }

        const text = await res.text()
        const itemCopy = api_deserializeJsonl(text.trim()).next().value as InfoEntry
        const userCopy = { ...user }
        userCopy.ItemId = itemCopy.ItemId
        const metaCopy = { ...meta }
        metaCopy.ItemId = itemCopy.ItemId

        const promises = []
        promises.push(api_setItem("", itemCopy))
        promises.push(api_setItem("engagement/", userCopy))
        promises.push(api_setItem("metadata/", metaCopy))
        for (let event of events) {
            promises.push(api_registerEvent(metaCopy.ItemId, event.Event, event.Timestamp, event.After, event.TimeZone))
        }

        Promise.all(promises)
            .then(responses => {
                for (let res of responses) {
                    if (res?.status !== 200) {
                        alert("Failed to make a complete copy")
                        return
                    }
                }

                alert(`Coppied: ${item.En_Title}`)

                items_addItem({
                    info: itemCopy,
                    user: userCopy,
                    meta: metaCopy,
                    events: events.map(v => {
                        let e = { ...v }
                        e.ItemId = metaCopy.ItemId
                        return e
                    })
                })

                items_addCopy(itemCopy.ItemId, item.ItemId)

                mode_selectItem(itemCopy, true, this)
                renderSidebarItem(itemCopy, sidebarItems, { below: String(item.ItemId) })
                updateInfo2({
                    [String(item.ItemId)]: {
                        info: item
                    }
                })
            })
            .catch(console.error)
    })
}


async function deleteEventByEventId(eventId: number) {
    const uid = getUidUI()
    return await new Promise(final => {
        confirmUI("Are you sure you want to delete this event")
            .then(async () => {
                const res = await api_deleteEventV2(eventId, uid)
                if (res?.status !== 200) {
                    alert(res?.text() || "Failed to delete event")
                    final(true)
                }
                alert("Successfully deleted event")
                final(true)
            })
            .catch(() => {
                console.log("confirmUI() failed")
            })
    })

}
