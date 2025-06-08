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
    ]
}

type Settings = typeof settings

function settings_isASetting(key: string): key is keyof Settings {
    return Object.hasOwn(settings, key)
}

function settings_set(key: keyof Settings, value: Settings[typeof key]) {
    settings[key] = value
}

function settings_get(key: keyof Settings) {
    return settings[key]
}
