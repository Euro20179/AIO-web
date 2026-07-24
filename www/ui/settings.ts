const defaultSettings = {
    //list so that the user can determine the tier order
    tiers: {
        //name of the tier, (minimum rating, or a func => boolean), optional css className
        "s": 95,
        "a": 90,
        "b": 80,
        "c": 70,
        "d": 60,
        "f": 30,
        "z": 1,
        "zero": 0
    },

    user_rating_max: 100,

    currency: "USD",

    ///styles to use for the tierlist mode
    ///names must be the same as tiers
    tierlist_styles: {
        "splus": `
tier-label {
    background: hsl(from var(--green) h 100% 50%);
}
`,
        's': `
tier-label {
background: hsl(from var(--green) h 100% 50%)
}
`,
        'a': `
tier-label {
background: hsl(from var(--green) h 50% 50%);
}
`,
        'b': `
tier-label {
background: color-mix(in srgb, var(--green) 50%, var(--yellow) 50%)
}
`,
        'c': `
tier-label {
background: var(--yellow);
}
`,
        'd': `
tier-label {
background: color-mix(in srgb, var(--yellow) 50%, var(--red) 50%)
}
`,
        'f': `
tier-label {
background: var(--red)
}
`,
        'z': `
    tier-label {
    background: var(--lavender)
    }
`,
    },

    custom_item_formats: {
        /*
         * 0: "VHS",
         * 11: " 1"
         * 12: ""
         */
    } as Record<number, string>,

    location_generator: "" as `${string}{}${string}` | ((info: InfoEntry) => string),

    enable_unsafe: ENABLE_UNSAFE,

    de_item_interactions: {
        close: {
            text: "✗ close",
            title: "close",
            action: "close",
        },

        identify: {
            text: "🔍︎",
            title: "identify item",
            shortTitle: "identify",
            action: 'identifymetadata',
        },

        refresh: {
            action: "refresh",
            title: "refresh metadata",
            text: "🗘",
            shortTitle: "metadata",
        },

        ['fetch-location']: {
            action: "fetchlocation",
            title: "find location",
            shortTitle: "🌎︎ locate"
        },

        ["library"]: {
            action: "chooselibrary",
            title: "choose library",
            shortTitle: "📚︎ library",
            attributes: {
                id: "library"
            }
        },

        ['toggle-object-editor']: {
            text: "✏",
            title: "Raw object editor",
            shortTitle: "edit",
            attributes: {
                onclick: "openModalUI('display-info-object-editor-popup', this.getRootNode())"
            }
        },

        ['edit-styles']: {
            action: "editstyles",
            title: "edit item's stylesheet",
            text: "🖌",
            shortTitle: "style"
        },

        ['edit-template']: {
            title: "edit item's html template",
            text: "<>",
            shortTitle: "template",
            attributes: {
                command: "showmodal",
                commandfor: "template-editor-container"
            }
        },

        ['delete']: {
            action: "delete",
            title: "permanently delete item",
            text: "🗑",
            shortTitle: "delete",
            attributes: {
                class: "delete"
            }
        }
    },

    UIStartupScript: "",
    StartupLang: "",
}

type Settings = typeof defaultSettings

const userSettings = new Map<number, Settings>

/** users who's settings are being loaded (dont load twice at same time) */
const _loading = new Set
async function settings_load(uid: number, force: boolean = false): Promise<Settings | boolean >{
    if(_loading.has(uid)) {
        return await new Promise(res => {
            const ck = () => {
                if(_loading.has(uid)) {
                    setTimeout(ck, 60)
                    return
                }
                res(true)
            }
            setTimeout(ck, 60)
        })
    }

    if((!force && userSettings.has(uid))) return false

    _loading.add(uid)

    const newSettings = {...defaultSettings}
    const res = await fetch(`${location.protocol}//${location.host}/settings/get?uid=${uid}`)
    const serverSettings = await res.json()
    for(let key in serverSettings) {
        //@ts-ignore
        newSettings[key] = serverSettings[key]
    }
    userSettings.set(uid, newSettings)

    _loading.delete(uid)

    return newSettings
}

/**
 * @description Gets a tier from a rating
 * returns false if it could not find the tier
 * @returns string | false
 */
function settings_tier_from_rating(tiers: Settings["tiers"], rating: number): string | false {
    for (let [name, minRating] of Object.entries(tiers)) {
        if (
            (typeof minRating === 'function' && minRating(rating))
            || (typeof minRating === 'number' && rating >= minRating)
        ) {
            return name
        }
    }

    return false
}

function settings_isASetting(key: string): key is keyof Settings {
    return Object.hasOwn(defaultSettings, key)
}

function settings_set<T extends keyof Settings>(uid: number, key: T, value: Settings[T]) {
    if(!userSettings.has(uid)) {
        throw new Error(`${uid}'s setting have not been loaded`)
    }
    userSettings.get(uid)![key] = value
}

function settings_get<T extends keyof Settings>(uid: number, key: T): Settings[T] {
    if(uid === 0) {
        return defaultSettings[key]
    }

    if(!userSettings.has(uid)) {
        throw new Error(`${uid}'s setting have not been loaded`)
    }
    return userSettings.get(uid)![key]
}

function settings_all(uid: number): Settings {
    if(!userSettings.has(uid)) {
        throw new Error(`${uid}'s setting have not been loaded`)
    }
    return userSettings.get(uid)!
}
