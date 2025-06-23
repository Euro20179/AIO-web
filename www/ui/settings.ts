const settings = {
    //list so that the user can determine the tier order
    tiers: [
        //name of the tier, (minimum rating, or a func => boolean), optional css className
        ["splus", 101],
        ["s", 97],
        ["a", 88],
        ["b", 79],
        ["c", 70],
        ["d", 66],
        ["f", 1],
        ["z", (n: number) => n < 0],
        ["zero", 0]
    ],
    custom_item_formats: {
        /*
         * 0: "VHS",
         * 11: " 1"
         * 12: ""
         */
    } as Record<number, string>
} as const

type Settings = typeof settings

function settings_isASetting(key: string): key is keyof Settings {
    return Object.hasOwn(settings, key)
}

function settings_set<T extends keyof Settings>(key: T, value: Settings[T]) {
    settings[key] = value
}

function settings_get<T extends keyof Settings>(key: T): Settings[T] {
    return settings[key]
}
