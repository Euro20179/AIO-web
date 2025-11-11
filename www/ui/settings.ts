const settings = {
    //list so that the user can determine the tier order
    tiers: [
        //name of the tier, (minimum rating, or a func => boolean), optional css className
        ["splus", 101],
        ["s", 95],
        ["a", 88],
        ["b", 79],
        ["c", 70],
        ["d", 60],
        ["f", 25],
        ["z", 1],
        ["zero", 0]
    ],

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
    backgound: var(--lavender)
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
    enable_unsafe: ENABLE_UNSAFE
} as const

type Settings = typeof settings

/**
 * @description Gets a tier from a rating
 * returns false if it could not find the tier
 * @returns string | false
 */
function settings_tier_from_rating(rating: number): string | false {
    for (let [name, minRating] of settings_get("tiers")) {
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
    return Object.hasOwn(settings, key)
}

function settings_set<T extends keyof Settings>(key: T, value: Settings[T]) {
    settings[key] = value
}

function settings_get<T extends keyof Settings>(key: T): Settings[T] {
    return settings[key]
}
