/**
 * @module js_api
 * @requires modes.ts
 * @requires ui.ts
 * @requires items.ts
 * @requires api.ts
 * @description
 * a module consisting of basic uitility-like functions
 * that either provide an api for small tasks, or are wrappers around other apis
 */

/**
 * Downloads data as a file in the browser
 * @param {string} data - The content to download
 * @param {string} name - The filename for the download
 * @param {string} ft - The file type/mime type
 * @returns 0 on success
 */
function ua_download(data: string, name: string, ft: string): number {
    let e = document.createElement("a")
    e.download = name
    let b = new Blob([data], { type: ft })
    e.href = URL.createObjectURL(b)
    e.click()
    URL.revokeObjectURL(e.href)
    return 0
}

/**
 * Sets the favicon
 * @param {string} path - the url for the favicon
 */
function ua_setfavicon(path: string) {
    let link = (document.querySelector("link[rel=\"shortcut icon\"]") || document.createElement("link")) as HTMLLinkElement
    link.setAttribute("rel", "shortcut icon")
    //prevent unecessary fetching
    if (link.href !== path) {
        link.href = path
        document.head.append(link)
    }
}

/**
 * Creates a popup window, attempts to use dPiP.requestWindow, falls back to open()
 * @param {string} [doc] an html document to put into the window
 * @param {DocumentPictureInPictureOptions} [pipOptions={}] options to give dPiP if dPiP is supported
 * @returns {Promise<Window | null>}
 */
async function ua_popup(doc?: string, pipOptions = {}): Promise<Window | null> {
    let win: Window
    if (window.documentPictureInPicture) {
        try {
            win = await documentPictureInPicture.requestWindow(pipOptions)
        } catch(err) {
            win = open("", "_blank", "popup=true")
        }
    } else {
        win = open("", "_blank", "popup=true")
    }

    if(doc) {
        const parser = new DOMParser
        win.document.documentElement.replaceWith(parser.parseFromString(doc, "text/html").documentElement)
    }

    const cspicker = dom_getel("color-scheme-selector select", HTMLSelectElement)
    if(cspicker) {
        const clone = win.document.adoptNode(cspicker.cloneNode(true)) as HTMLSelectElement
        clone.value = cspicker.value
        win.document.body.prepend(clone)
    }

    const closebtn = dom_getel("close-button")
    if(closebtn) {
        win.document.body.prepend(closebtn.cloneNode(true))
    }

    if(!cspicker && !closebtn) return win

    const s = document.createElement("script")
    s.src = "/ui/components.js"
    win.document.body.append(s)

    const psel = dom_getel("select", win.self.HTMLSelectElement, win.document)

    if(psel) {
        const v = dom_getel("select", HTMLSelectElement, cspicker)
        if(v)
            psel.value = v.value
    }
    return win
}

/**
 * run cb after timeout milliseconds, but restart the timer if the function is rerun.
 * @param {Function} cb
 * @param {number} timeout
 * @returns a function that can be run to start/restart the timer
 */
function util_debounce(cb: Function, timeout: number) {
    let to: number | undefined
    return function() {
        if (to) {
            clearTimeout(to)
        }
        to = setTimeout(cb, timeout)
    }
}

/**
 * Given an iso 3166-1 country code, or a flag, attempt to normalize into a name
 */
function util_countrycode2name(name: string): string {
    let cp0 = name.codePointAt(0)
    if(!cp0) return name

    // we have a flag (0x1F1E6 is regional indicator A)
    if(cp0 > 0x1F1E5) {
        name = [...name]
                    .map(v => String.fromCodePoint(
                                v.codePointAt(0)! - 0x1F1E6 + 0x41
                            ))
                    .join("")
    }
    const flags = {
        "ABW":  "Aruba",
        "AFG":  "Afghanistan",
        "AGO":  "Angola",
        "AIA":  "Anguilla",
        "ALA":  "Åland Islands",
        "ALB":  "Albania",
        "AND":  "Andorra",
        "ARE":  "United Arab Emirates",
        "ARG":  "Argentina",
        "ARM":  "Armenia",
        "ASM":  "American Samoa",
        "ATA":  "Antarctica",
        "ATF":  "French Southern Territories",
        "ATG":  "Antigua and Barbuda",
        "AUS":  "Australia",
        "AUT":  "Austria",
        "AZE":  "Azerbaijan",
        "BDI":  "Burundi",
        "BEL":  "Belgium",
        "BEN":  "Benin",
        "BES":  "Bonaire, Sint Eustatius and Saba",
        "BFA":  "Burkina Faso",
        "BGD":  "Bangladesh",
        "BGR":  "Bulgaria",
        "BHR":  "Bahrain",
        "BHS":  "Bahamas",
        "BIH":  "Bosnia and Herzegovina",
        "BLM":  "Saint Barthélemy",
        "BLR":  "Belarus",
        "BLZ":  "Belize",
        "BMU":  "Bermuda",
        "BOL":  "Bolivia, Plurinational State of",
        "BRA":  "Brazil",
        "BRB":  "Barbados",
        "BRN":  "Brunei Darussalam",
        "BTN":  "Bhutan",
        "BVT":  "Bouvet Island",
        "BWA":  "Botswana",
        "CAF":  "Central African Republic",
        "CAN":  "Canada",
        "CCK":  "Cocos (Keeling) Islands",
        "CHE":  "Switzerland",
        "CHL":  "Chile",
        "CHN":  "China",
        "CIV":  "Côte d'Ivoire",
        "CMR":  "Cameroon",
        "COD":  "Congo, Democratic Republic of the",
        "COG":  "Congo",
        "COK":  "Cook Islands",
        "COL":  "Colombia",
        "COM":  "Comoros",
        "CPV":  "Cabo Verde",
        "CRI":  "Costa Rica",
        "CUB":  "Cuba",
        "CUW":  "Curaçao",
        "CXR":  "Christmas Island",
        "CYM":  "Cayman Islands",
        "CYP":  "Cyprus",
        "CZE":  "Czechia",
        "DEU":  "Germany",
        "DJI":  "Djibouti",
        "DMA":  "Dominica",
        "DNK":  "Denmark",
        "DOM":  "Dominican Republic",
        "DZA":  "Algeria",
        "ECU":  "Ecuador",
        "EGY":  "Egypt",
        "ERI":  "Eritrea",
        "ESH":  "Western Sahara",
        "ESP":  "Spain",
        "EST":  "Estonia",
        "ETH":  "Ethiopia",
        "FIN":  "Finland",
        "FJI":  "Fiji",
        "FLK":  "Falkland Islands (Malvinas)",
        "FRA":  "France",
        "FRO":  "Faroe Islands",
        "FSM":  "Micronesia, Federated States of",
        "GAB":  "Gabon",
        "GBR":  "United Kingdom of Great Britain and Northern Ireland",
        "GEO":  "Georgia",
        "GGY":  "Guernsey",
        "GHA":  "Ghana",
        "GIB":  "Gibraltar",
        "GIN":  "Guinea",
        "GLP":  "Guadeloupe",
        "GMB":  "Gambia",
        "GNB":  "Guinea-Bissau",
        "GNQ":  "Equatorial Guinea",
        "GRC":  "Greece",
        "GRD":  "Grenada",
        "GRL":  "Greenland",
        "GTM":  "Guatemala",
        "GUF":  "French Guiana",
        "GUM":  "Guam",
        "GUY":  "Guyana",
        "HKG":  "Hong Kong",
        "HMD":  "Heard Island and McDonald Islands",
        "HND":  "Honduras",
        "HRV":  "Croatia",
        "HTI":  "Haiti",
        "HUN":  "Hungary",
        "IDN":  "Indonesia",
        "IMN":  "Isle of Man",
        "IND":  "India",
        "IOT":  "British Indian Ocean Territory",
        "IRL":  "Ireland",
        "IRN":  "Iran, Islamic Republic of",
        "IRQ":  "Iraq",
        "ISL":  "Iceland",
        "ISR":  "Israel",
        "ITA":  "Italy",
        "JAM":  "Jamaica",
        "JEY":  "Jersey",
        "JOR":  "Jordan",
        "JPN":  "Japan",
        "KAZ":  "Kazakhstan",
        "KEN":  "Kenya",
        "KGZ":  "Kyrgyzstan",
        "KHM":  "Cambodia",
        "KIR":  "Kiribati",
        "KNA":  "Saint Kitts and Nevis",
        "KOR":  "Korea, Republic of",
        "KWT":  "Kuwait",
        "LAO":  "Lao People's Democratic Republic",
        "LBN":  "Lebanon",
        "LBR":  "Liberia",
        "LBY":  "Libya",
        "LCA":  "Saint Lucia",
        "LIE":  "Liechtenstein",
        "LKA":  "Sri Lanka",
        "LSO":  "Lesotho",
        "LTU":  "Lithuania",
        "LUX":  "Luxembourg",
        "LVA":  "Latvia",
        "MAC":  "Macao",
        "MAF":  "Saint Martin (French part)",
        "MAR":  "Morocco",
        "MCO":  "Monaco",
        "MDA":  "Moldova, Republic of",
        "MDG":  "Madagascar",
        "MDV":  "Maldives",
        "MEX":  "Mexico",
        "MHL":  "Marshall Islands",
        "MKD":  "North Macedonia",
        "MLI":  "Mali",
        "MLT":  "Malta",
        "MMR":  "Myanmar",
        "MNE":  "Montenegro",
        "MNG":  "Mongolia",
        "MNP":  "Northern Mariana Islands",
        "MOZ":  "Mozambique",
        "MRT":  "Mauritania",
        "MSR":  "Montserrat",
        "MTQ":  "Martinique",
        "MUS":  "Mauritius",
        "MWI":  "Malawi",
        "MYS":  "Malaysia",
        "MYT":  "Mayotte",
        "NAM":  "Namibia",
        "NCL":  "New Caledonia",
        "NER":  "Niger",
        "NFK":  "Norfolk Island",
        "NGA":  "Nigeria",
        "NIC":  "Nicaragua",
        "NIU":  "Niue",
        "NLD":  "Netherlands, Kingdom of the",
        "NOR":  "Norway",
        "NPL":  "Nepal",
        "NRU":  "Nauru",
        "NZL":  "New Zealand",
        "OMN":  "Oman",
        "PAK":  "Pakistan",
        "PAN":  "Panama",
        "PCN":  "Pitcairn",
        "PER":  "Peru",
        "PHL":  "Philippines",
        "PLW":  "Palau",
        "PNG":  "Papua New Guinea",
        "POL":  "Poland",
        "PRI":  "Puerto Rico",
        "PRK":  "Korea, Democratic People's Republic of",
        "PRT":  "Portugal",
        "PRY":  "Paraguay",
        "PSE":  "Palestine, State of",
        "PYF":  "French Polynesia",
        "QAT":  "Qatar",
        "REU":  "Réunion",
        "ROU":  "Romania",
        "RUS":  "Russian Federation",
        "RWA":  "Rwanda",
        "SAU":  "Saudi Arabia",
        "SDN":  "Sudan",
        "SEN":  "Senegal",
        "SGP":  "Singapore",
        "SGS":  "South Georgia and the South Sandwich Islands",
        "SHN":  "Saint Helena, Ascension and Tristan da Cunha",
        "SJM":  "Svalbard and Jan Mayen",
        "SLB":  "Solomon Islands",
        "SLE":  "Sierra Leone",
        "SLV":  "El Salvador",
        "SMR":  "San Marino",
        "SOM":  "Somalia",
        "SPM":  "Saint Pierre and Miquelon",
        "SRB":  "Serbia",
        "SSD":  "South Sudan",
        "STP":  "Sao Tome and Principe",
        "SUR":  "Suriname",
        "SVK":  "Slovakia",
        "SVN":  "Slovenia",
        "SWE":  "Sweden",
        "SWZ":  "Eswatini",
        "SXM":  "Sint Maarten (Dutch part)",
        "SYC":  "Seychelles",
        "SYR":  "Syrian Arab Republic",
        "TCA":  "Turks and Caicos Islands",
        "TCD":  "Chad",
        "TGO":  "Togo",
        "THA":  "Thailand",
        "TJK":  "Tajikistan",
        "TKL":  "Tokelau",
        "TKM":  "Turkmenistan",
        "TLS":  "Timor-Leste",
        "TON":  "Tonga",
        "TTO":  "Trinidad and Tobago",
        "TUN":  "Tunisia",
        "TUR":  "Türkiye",
        "TUV":  "Tuvalu",
        "TWN":  "Taiwan, Province of China",
        "TZA":  "Tanzania, United Republic of",
        "UGA":  "Uganda",
        "UKR":  "Ukraine",
        "UMI":  "United States Minor Outlying Islands",
        "URY":  "Uruguay",
        "USA":  "United States",
        "UZB":  "Uzbekistan",
        "VAT":  "Holy See",
        "VCT":  "Saint Vincent and the Grenadines",
        "VEN":  "Venezuela, Bolivarian Republic of",
        "VGB":  "Virgin Islands (British)",
        "VIR":  "Virgin Islands (U.S.)",
        "VNM":  "Viet Nam",
        "VUT":  "Vanuatu",
        "WLF":  "Wallis and Futuna",
        "WSM":  "Samoa",
        "YEM":  "Yemen",
        "ZAF":  "South Africa",
        "ZMB":  "Zambia",
        "ZWE":  "Zimbabwe",
        "JP": "Japan",
        "CA": "Canada",
        "US": "United States",
        "GB": "United Kingdom",
        "KR": "South Korea",
        "NL": "Netherlands",
        "IE": "Ireland",
        "FR": "France",
        "BE": "Belgium",
        "SE": "Sweden",
        "DK": "Denmark",
        "LU": "Luxembourg",
        "BR": "Brazil",
        "IT": "Italy",
        "NZ": "New Zealand",
        "HU": "Hungary",
        "HK": "Hong Kong",
        "CN": "China",
        "AC": "Ascension Island",
        "AD": "Andorra",
        "AE": "United Arab Emirates",
        "AF": "Afghanistan",
        "AG": "Antigua & Barbuda",
        "AI": "Anguilla",
        "AL": "Albania",
        "AM": "Armenia",
        "AO": "Angola",
        "AQ": "Antarctica",
        "AR": "Argentina",
        "AS": "American Samoa",
        "AT": "Austria",
        "AU": "Australia",
        "AW": "Aruba",
        "AX": "Åland Islands",
        "AZ": "Azerbaijan",
        "BA": "Bosnia & Herzegovina",
        "BB": "Barbados",
        "BD": "Bangladesh",
        "BF": "Burkina Faso",
        "BG": "Bulgaria",
        "BH": "Bahrain",
        "BI": "Burundi",
        "BJ": "Benin",
        "BL": "St. Barthélemy",
        "BM": "Bermuda",
        "BN": "Brunei",
        "BO": "Bolivia",
        "BQ": "Caribbean Netherlands",
        "BS": "Bahamas",
        "BT": "Bhutan",
        "BV": "Bouvet Island",
        "BW": "Botswana",
        "BY": "Belarus",
        "BZ": "Belize",
        "CC": "Cocos (Keeling) Islands",
        "CD": "Congo - Kinshasa",
        "CF": "Central African Republic",
        "CG": "Congo - Brazzaville",
        "CH": "Switzerland",
        "CI": "Côte d’Ivoire",
        "CK": "Cook Islands",
        "CL": "Chile",
        "CM": "Cameroon",
        "CO": "Colombia",
        "CP": "Clipperton Island",
        "CQ": "Sark",
        "CR": "Costa Rica",
        "CU": "Cuba",
        "CV": "Cape Verde",
        "CW": "Curaçao",
        "CX": "Christmas Island",
        "CY": "Cyprus",
        "CZ": "Czechia",
        "DE": "Germany",
        "DG": "Diego Garcia",
        "DJ": "Djibouti",
        "DM": "Dominica",
        "DO": "Dominican Republic",
        "DZ": "Algeria",
        "EA": "Ceuta & Melilla",
        "EC": "Ecuador",
        "EE": "Estonia",
        "EG": "Egypt",
        "EH": "Western Sahara",
        "ER": "Eritrea",
        "ES": "Spain",
        "ET": "Ethiopia",
        "EU": "European Union",
        "FI": "Finland",
        "FJ": "Fiji",
        "FK": "Falkland Islands",
        "FM": "Micronesia",
        "FO": "Faroe Islands",
        "GA": "Gabon",
        "GD": "Grenada",
        "GE": "Georgia",
        "GF": "French Guiana",
        "GG": "Guernsey",
        "GH": "Ghana",
        "GI": "Gibraltar",
        "GL": "Greenland",
        "GM": "Gambia",
        "GN": "Guinea",
        "GP": "Guadeloupe",
        "GQ": "Equatorial Guinea",
        "GR": "Greece",
        "GS": "South Georgia & South Sandwich Islands",
        "GT": "Guatemala",
        "GU": "Guam",
        "GW": "Guinea-Bissau",
        "GY": "Guyana",
        "HM": "Heard & McDonald Islands",
        "HN": "Honduras",
        "HR": "Croatia",
        "HT": "Haiti",
        "IC": "Canary Islands",
        "ID": "Indonesia",
        "IL": "Israel",
        "IM": "Isle of Man",
        "IN": "India",
        "IO": "British Indian Ocean Territory",
        "IQ": "Iraq",
        "IR": "Iran",
        "IS": "Iceland",
        "JE": "Jersey",
        "JM": "Jamaica",
        "JO": "Jordan",
        "KE": "Kenya",
        "KG": "Kyrgyzstan",
        "KH": "Cambodia",
        "KI": "Kiribati",
        "KM": "Comoros",
        "KN": "St. Kitts & Nevis",
        "KP": "North Korea",
        "KW": "Kuwait",
        "KY": "Cayman Islands",
        "KZ": "Kazakhstan",
        "LA": "Laos",
        "LB": "Lebanon",
        "LC": "St. Lucia",
        "LI": "Liechtenstein",
        "LK": "Sri Lanka",
        "LR": "Liberia",
        "LS": "Lesotho",
        "LT": "Lithuania",
        "LV": "Latvia",
        "LY": "Libya",
        "MA": "Morocco",
        "MC": "Monaco",
        "MD": "Moldova",
        "ME": "Montenegro",
        "MF": "St. Martin",
        "MG": "Madagascar",
        "MH": "Marshall Islands",
        "MK": "North Macedonia",
        "ML": "Mali",
        "MM": "Myanmar (Burma)",
        "MN": "Mongolia",
        "MO": "Macao SAR China",
        "MP": "Northern Mariana Islands",
        "MQ": "Martinique",
        "MR": "Mauritania",
        "MS": "Montserrat",
        "MT": "Malta",
        "MU": "Mauritius",
        "MV": "Maldives",
        "MW": "Malawi",
        "MX": "Mexico",
        "MY": "Malaysia",
        "MZ": "Mozambique",
        "NA": "Namibia",
        "NC": "New Caledonia",
        "NE": "Niger",
        "NF": "Norfolk Island",
        "NG": "Nigeria",
        "NI": "Nicaragua",
        "NO": "Norway",
        "NP": "Nepal",
        "NR": "Nauru",
        "NU": "Niue",
        "OM": "Oman",
        "PA": "Panama",
        "PE": "Peru",
        "PF": "French Polynesia",
        "PG": "Papua New Guinea",
        "PH": "Philippines",
        "PK": "Pakistan",
        "PL": "Poland",
        "PM": "St. Pierre & Miquelon",
        "PN": "Pitcairn Islands",
        "PR": "Puerto Rico",
        "PS": "Palestinian Territories",
        "PT": "Portugal",
        "PW": "Palau",
        "PY": "Paraguay",
        "QA": "Qatar",
        "RE": "Réunion",
        "RO": "Romania",
        "RS": "Serbia",
        "RU": "Russia",
        "RW": "Rwanda",
        "SA": "Saudi Arabia",
        "SB": "Solomon Islands",
        "SC": "Seychelles",
        "SD": "Sudan",
        "SG": "Singapore",
        "SH": "St. Helena",
        "SI": "Slovenia",
        "SJ": "Svalbard & Jan Mayen",
        "SK": "Slovakia",
        "SL": "Sierra Leone",
        "SM": "San Marino",
        "SN": "Senegal",
        "SO": "Somalia",
        "SR": "Suriname",
        "SS": "South Sudan",
        "ST": "São Tomé & Príncipe",
        "SV": "El Salvador",
        "SX": "Sint Maarten",
        "SY": "Syria",
        "SZ": "Eswatini",
        "TA": "Tristan da Cunha",
        "TC": "Turks & Caicos Islands",
        "TD": "Chad",
        "TF": "French Southern Territories",
        "TG": "Togo",
        "TH": "Thailand",
        "TJ": "Tajikistan",
        "TK": "Tokelau",
        "TL": "Timor-Leste",
        "TM": "Turkmenistan",
        "TN": "Tunisia",
        "TO": "Tonga",
        "TR": "Türkiye",
        "TT": "Trinidad & Tobago",
        "TV": "Tuvalu",
        "TW": "Taiwan",
        "TZ": "Tanzania",
        "UA": "Ukraine",
        "UG": "Uganda",
        "UM": "U.S. Outlying Islands",
        "UN": "United Nations",
        "UY": "Uruguay",
        "UZ": "Uzbekistan",
        "VA": "Vatican City",
        "VC": "St. Vincent & Grenadines",
        "VE": "Venezuela",
        "VG": "British Virgin Islands",
        "VI": "U.S. Virgin Islands",
        "VN": "Vietnam",
        "VU": "Vanuatu",
        "WF": "Wallis & Futuna",
        "WS": "Samoa",
        "XK": "Kosovo",
        "YE": "Yemen",
        "YT": "Mayotte",
        "ZA": "South Africa",
        "ZM": "Zambia",
        "ZW": "Zimbabwe",
    }
    return flags[name as keyof typeof flags] || name
}

function arr_shuf<T>(iter: Iterable<T>): T[] {
    const cpy: any = [...iter]
    for (let i = cpy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cpy[i], cpy[j]] = [cpy[j], cpy[i]];
    }
    return cpy
}

/**
 * Creates a datalist from a list of items, and appends it into doc
 * @param {string} name the id to give the datalist, if it is already in document and is NOT a datalist, 1 is returned
 * @param {string[]} from the list of items to put in the datalist
 * @param {Document} [doc] the context document
 * @returns {1 | HTMLDataListElement}
 */
function dom_createdatalist(name: string, from: string[], doc: Document = document): 1 | HTMLDataListElement {
    const preExisting = doc.getElementById(name)
    if(preExisting && preExisting.tagName !== 'DATALIST') {
        return 1
    }

    const dl = preExisting || document.createElement("datalist")
    dl.id = name
    const newOpts = []
    for(let item of from) {
        const opt = document.createElement("option")
        opt.value = item
        opt.innerText = item
        newOpts.push(opt)
    }

    dl.replaceChildren(...newOpts)

    doc.body.append(dl)

    return dl as HTMLDataListElement
}

/**
 * Resets a form completely (including type="hidden" inputs)
 * @param {HTMLFormElement} form
 */
function dom_resetform(form: HTMLFormElement) {
    for(let el of form.querySelectorAll('input[type="hidden"]') as NodeListOf<HTMLInputElement>) {
        el.value = ''
    }
    form.reset()
}

/**
 * Gets an element by a query selector that's an instanceof {requiredType}
 * If such an element is not found, null is returned
 *
 * @param selector passed to root.querySelector
 * @param [requiredType=null] The type the found element must be
 * @param [root=null] The root document, (default is currentDocument())
 * @reutrns {Element | null}
 */
function dom_getel<T extends typeof Element>(
    selector: string,
    requiredType: T | null = null,
    root: { querySelector(selector: string): Element | null } | null = null
): InstanceType<T> | null {
    let el = (root || currentDocument()).querySelector(selector)
    if (!el || (requiredType && !(el instanceof (requiredType as T)))) return null
    return el as InstanceType<T>
}
const getElementUI = dom_getel

/**
 * attempts to find an element of a certain type with a query selector within a container
 * if the element is not found, throw an error
 * @template T - an HTMLElement constructor (must be HTMLElement iself or a subclass)
 * @param {string} selector
 * @param {T | null} [requiredType=null] - the type the found element must be
 * @param [root=null] - the root (defaults to currentDocument()) (may also just be anything with a querySelector implementation)
 * @returns {T}
 */
function dom_getelorthrow<T extends typeof HTMLElement>(
    selector: string,
    requiredType: T | null = null,
    root: { querySelector(selector: string): HTMLElement | null } | null = null
): InstanceType<T> {
    let el = dom_getel(selector, requiredType, root)
    if (!(el)) {
        throw new Error(`Element: ${selector} was not found`)
    }
    return el
}
const getElementOrThrowUI = dom_getel

/**
 * Loads an html template by name and returns the template element
 * @param {string} name name of the template to load, will look in `/ui/html-templates/${name}.html`
 * @returns {HTMLTemplateElement}
 */
async function dom_loadtemplate(name: string): HTMLTemplateElement {
    const res = await fetch(`${location.protocol}//${location.host}/ui/html-templates/${name}.html`)
    const text = await res.text()
    const div = document.createElement("div")
    div.innerHTML = text
    return div.firstElementChild
}

/**
 * sets a css property on document and if catalogWin is open, also that document
 * @param {string} property the css property to set
 * @param {string} value the value to set property to
 */
function ui_setcss(property: string, value: string): void {
    document.documentElement.style.setProperty(property, value)
}

/**
 * Shows a prompt dialog to the user
 * @param {string} prompt - The prompt message to display
 * @param {string} [_default] - Optional default value for the prompt
 * @param {function(string|null): any} [cb] - Optional callback function that receives the user's input
 */
function ui_prompt(prompt: string, _default?: string, cb?: (result: string | null) => any) {
    promptUI(prompt, _default).then(cb)
}

/**
 * Creates a new statistic in the UI
 * Side effects:
 * - puts a statistic in the statistics area
 * @param {string} name - Name of the statistic
 * @param {boolean} additive - Whether the stat is additive
 * @param {StatCalculator} calculation - The calculation function for the stat
 * @returns 0 on success
 */
function ui_createstat(name: string, additive: boolean, calculation: StatCalculator): number {
    createStatUI(name, additive, calculation)
    return 0
}

/**
 * Sets the value of a statistic
 * @param {string} name - Name of the statistic
 * @param {number} val - Value to set
 * @returns The value that was set
 */
function ui_setstat(name: string, val: number): number {
    setResultStatUI(name, val)
    return val
}

/**
 * Deletes a statistic
 * Side effects:
 * - removes the statistic from the statistics area
 * @param {string} name - Name of the statistic to delete
 * @returns true if successful, false otherwise
 */
function ui_delstat(name: string): boolean {
    return deleteStatUI(name)
}

/**
 * Sorts entries in the UI by a specified criteria
 * Side effects:
 * - clears all selected items
 * - reorders the sidebar
 * - selects the first item in the sidebar
 * @param {string} by - The sorting criteria
 * @returns 0 on success
 */
function ui_sort(by: string): number {
    const sortBySelector = document.querySelector('[name="sort"]') as HTMLSelectElement
    sortBySelector.value = by
    sortEntriesUI()
    return 0
}

/**
 * Performs a search in the UI using search-v3
 * Side effects:
 * - fills the search bar with query
 * - clears selected items
 * - refills the sidebar with the new results
 * - uses the sort-by select element for sorting
 * @param {string} query - The search query
 * @param {function(items_Entry[]): any} [cb] - Optional callback that receives the search results
 * @returns 0 on success
 */
function ui_search(query: string, cb?: (results: items_Entry[]) => any): number {
    if(components.searchBox) {
        components.searchBox.value = `3 ${query}`
    }

    loadSearchUI().then(() => {
        cb?.(items_getResults())
    }).catch(console.error)

    return 0
}

/**
 * Sets the current UI mode
 * @param {string} modeName - Name of the mode to set
 * @returns 0 on success, 1 if mode is invalid
 */
function ui_setmode(modeName: string): number {
    // if (!modeOutputIds.includes(modeName)) {
    //     return 1
    //     // return new Str("Invalid mode")
    // }
    mode_setMode(modeName)
    return 0
}

/**
 * Clears the sidebar
 * @returns 0 on success
 */
function ui_sidebarclear(): number {
    components['sidebarUI']?.clearSelected()
    return 0
}

/**
 * Renders an item in the sidebar (duplicates allowed)
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to select (can be bigint or entry object)
 * @returns 0 on success, 1 if item not found
 */
function ui_sidebarselect(id: bigint | InfoEntry | MetadataEntry | UserEntry): number {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    renderSidebarItem.call(components['sidebarUI'] as SidebarMode, entry)
    return 0
}

/**
 * Renders a sidebar-entry, and returns the resulting element
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to render (can be bigint or entry object)
 * @returns HTMLElement on success, 1 if item not found
 */
function ui_sidebarrender(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }
    let frag = document.createDocumentFragment()
    return renderSidebarItem.call(components['sidebarUI'] as SidebarMode, entry, frag, { renderImg: true })
}

/**
 * Toggles the selection state of an item
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to toggle (can be bigint or entry object)
 * @returns 0 if deselected, 1 if selected, 2 if item not found
 */
function ui_toggle(id: bigint | InfoEntry | MetadataEntry | UserEntry): number {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 2
    }

    if (items_isSelected(jsId)) {
        deselectUI(entry)
        return 0
    } else {
        selectUI(entry)
        return 1
    }
}

/**
 * Selects an item
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to select (can be bigint or entry object)
 * @returns HTMLElement on success, 1 if item not found, 2 if already selected
 */
function ui_select(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | 2 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    if (items_isSelected(jsId)) {
        return 2
    }
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    return selectUI(entry)[0]
}

/**
 * Deselects an item
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to deselect (can be bigint or entry object)
 * @returns Empty string on success, 1 if item not found, 2 if not selected
 */
function ui_deselect(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | 2 | "" {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    if (!items_isSelected(jsId)) {
        return 2
    }
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    deselectUI(entry)
    return ""
}

/**
 * Renders a display-entry, and returns the resulting element
 * @param {bigint|InfoEntry|MetadataEntry|UserEntry} id - The ID of the item to render (can be bigint or entry object)
 * @returns HTMLElement on success, 1 if item not found
 */
function ui_render(id: bigint | InfoEntry | MetadataEntry | UserEntry): 1 | HTMLElement {
    let jsId = typeof id === 'bigint' ? id : id.ItemId
    const entry = findInfoEntryById(jsId)

    if (!entry) {
        return 1
    }

    let frag = document.createDocumentFragment()

    const m = new DisplayMode(frag)

    let res = mode_selectItem(entry, m)[0]
    m.close()
    return res
}

/**
    * Renders an item in a specific mode
    * @param {bigint} id The item to render
    * @param {string} mode The mode to render in, can be
    * entry-output | graph-output | calc-output | gallery-output | script-output | event-output | calendar-output | tierlist-output
    * @returns {1 | 2 | HTMLElement} 1 if entry does not exist, 2 if mode does not exist, otherwise the rendered element
*/
function ui_render_from(id: bigint, mode: "entry-output" |
    "graph-output" |
    "calc-output" |
    "gallery-output" |
    "script-output" |
    "event-output" |
    "calendar-output" |
    "tierlist-output"
): 1 | 2 | HTMLElement {
    const entry = findInfoEntryById(id)

    if (!entry) {
        return 1
    }
    let frag = document.createDocumentFragment()
    const modes = {
        "entry-output": DisplayMode,
        "graph-output": GraphMode,
        "calc-output": CalcMode,
        "gallery-output": GalleryMode,
        "script-output": ScriptMode,
        "event-output": EventMode,
        "calendar-output": CalendarMode,
        "tierlist-output": TierListMode,
    }
    if(!(mode in modes)) {
        return 2
    }

    const m = new modes[mode](frag)
    let res = mode_selectItem(entry, m)[0]
    m.close()
    return res
}

/**
 * Clears all items
 * @returns 0 on success
 */
function ui_clear(): number {
    clearUI()
    return 0
}

/**
 * Clears the current mode (including anything added with ui_put())
 * @returns 0 on success, 1 if mode doesn't support clearing
 */
function ui_modeclear(): number {
    let valid = 1
    for (let mode of mode_listOpen()) {
        if (mode.clear) {
            mode.clear()
            valid = 0
        }
    }
    return valid
}

/**
 * runs ui_clear() and ui_modeclear() to clear all items, and nodes put by ui_put()
 * @returns an array of the results from ui_clear(), and ui_modeclear()
 */
function ui_clearall(): [number, number] {
    return [ui_clear(), ui_modeclear()]
}

/**
 * Sets the user ID in the UI
 * Side effects:
 * - sets the uid select element to the new uid
 * @param {string} newId - The new user ID
 * @returns The new user ID
 */
function ui_setuid(newId: string): string {
    setUIDUI(newId)
    return newId
}

/**
 * Gets the current user ID from the UI
 * @returns The current user ID as a number
 */
function ui_getuid(): number {
    const uidSelector = document.querySelector("[name=\"uid\"]") as HTMLSelectElement
    return Number(uidSelector.value)
}

/**
 * Sets the search results in the UI
 * Side effects:
 * - re-renders the sidebar
 * - clears selected items
 * - selects the first item from the sidebar
 * @param {InfoEntry[]} results - Array of InfoEntry objects
 * @returns 0 on success
 */
function ui_setresults(results: InfoEntry[]): number {
    items_setResults(results.map(v => v.ItemId))
    components['sidebarUI']?.render(results)
    return 0
}

/**
 * Gets the current search results
 * @returns Array of InfoEntry objects
 */
function ui_getresults(): InfoEntry[] {
    return items_getResults().map(v => v.info)
}

/**
 * Gets the currently selected entries
 * @returns Array of InfoEntry objects
 */
function ui_selected(): InfoEntry[] {
    return items_getSelected()
}

/**
 * Adds HTML content to the current mode
 * Side effects:
 * - ONLY clearable with ui_modeclear()
 * @param {...(string|HTMLElement)} html - HTML content to add (string or HTMLElement)
 * @returns Empty string on success, 1 if mode doesn't support putting content
 */
function ui_put(...html: (string | HTMLElement)[]): "" | 1 {
    for (let mode of mode_listOpen()) {
        if (!mode.put) {
            continue
        }
        for (let h of html) {
            mode.put(h)
        }
    }
    return ""
}

/**
 * Reorders items in the sidebar
 * Side effects:
 * - clears selected entries
 * - selects the new first item in the sidebar
 * @param {...(bigint|InfoEntry|MetadataEntry|UserEntry)} ids - Array of item IDs to reorder
 * @returns 0 on success
 */
function ui_sidebarreorder(...ids: (bigint | InfoEntry | MetadataEntry | UserEntry)[]): number {
    ids = ids.map(v => typeof v === 'bigint' ? v : v.ItemId)
    components['sidebarUI']?.reorder(ids as bigint[])
    return 0
}

/**
 * Adds a new sorting option
 * Side effects:
 * - adds the new option to the sort-by element
 * @param {string} name - Name of the sorting option
 * @param {function(InfoEntry,InfoEntry): number} sortFN - Sorting function
 * @returns 0 on success, 1 on fail
 */
function ui_addsort(name: string, sortFN: ((a: InfoEntry, b: InfoEntry) => number)): number {
    const sortBySelector = components['sortBySelector']
    if(!sortBySelector) return 1

    let opt = sortBySelector.querySelector(`option[value="${name}"]`) as HTMLOptionElement | null
    if (!(opt instanceof HTMLOptionElement)) {
        opt = document.createElement("option") as HTMLOptionElement
    }
    items_addSort(name, sortFN)
    opt.value = name
    opt.innerText = name
    sortBySelector.append(opt)
    return 0
}

/**
 * Removes a sorting option
 * Side effects:
 * - removes the option from the sort-by element
 * @param {string} name - Name of the sorting option to remove
 * @returns 1 if option not found
 */
function ui_delsort(name: string) {
    let opt = components.sortBySelector?.querySelector(`option[value="${name}"]`)
    if (!opt) return 1
    opt.remove()
    items_delSort(name)
}

/**
 * Prompts the user to select an item
 * @returns Promise that resolves to the selected item
 */
async function ui_askitem() {
    return await selectItemUI()
}

/**
 * Sets the error text
 * <i>hint: to clear the error, pass ""</i>
 * @param {string} err - The error text
 */
function ui_seterr(err: string): void {
    setError(err)
}


/**
 * An alias for addUserScriptUI
 */
function ui_newscript(...args: Parameters<typeof addUserScriptUI>) {
    addUserScriptUI(...args)
}

/**
 * <del>Performs a search query</del>
 * <ins>Use api_queryV3 instead</ins>
 * @param {string} query - The search query
 * @returns Promise that resolves to an array of InfoEntry objects
 * @deprecated
 */
async function aio_search(query: string): Promise<InfoEntry[]> {
    return await api_queryV3(query, getUidUI())
}

/**
 * Sets an entry in the system
 * @param {InfoEntry} entry - The InfoEntry to set
 * @returns Promise that resolves to true if successful, false otherwise
 */
async function aio_setentry(entry: InfoEntry): Promise<boolean> {
    let res = await api_setItem("", entry)
    if (res?.status !== 200) {
        return false
    }
    updateInfo2({
        [String(entry.ItemId)]: { info: entry }
    })
    return true
}

/**
 * Sets metadata for an entry
 * @param {MetadataEntry} meta - The MetadataEntry to set
 * @returns Promise that resolves to true if successful, false otherwise
 */
async function aio_setmeta(meta: MetadataEntry): Promise<boolean> {
    let res = await api_setItem("metadata/", meta)
    if (res?.status !== 200) {
        return false
    }
    updateInfo2({
        [String(meta.ItemId)]: {
            meta: meta
        }
    })
    return true
}

/**
 * Sets a user entry
 * @param {UserEntry} user - The UserEntry to set
 * @returns Promise that resolves to true if successful, false otherwise
 */
async function aio_setuser(user: UserEntry): Promise<boolean> {
    const res = await api_setItem("engagement/", user)
    if (res?.status !== 200) {
        return false
    }
    updateInfo2({
        [String(user.ItemId)]: {
            user: user
        }
    })
    return true
}

/**
 * Deletes an entry
 * Side effects:
 * - removes item from sidebar
 * - removes item from global entries map
 * - clears selected items
 * - selects the new first item in the sidebar
 * @param {bigint} item - the item id to delete
 * @returns 1 on failure to delete else 0
 */
async function aio_delete(item: bigint) {
    const res = await api_deleteEntry(item)
    if (!res || res.status !== 200) {
        return 1
    }
    components['sidebarUI']?.sub(findInfoEntryById(item))
    items_delEntry(item)
    clearUI()
    components['sidebarUI']?.selectNth(1)
    return 0
}

/**
 * Given a Date, convert it to a UTC timestamp
 * @param {Date} date
 * @returns {number}
 */
function time_utcDate(date: Date): number {
    return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
    )
}

/**
 * Converts an Temporal.ZonedDateTime parsable date, and timezone and converts
 * it to a utc timestamp
 * @param {string} date
 * @param {string} timezone
 * @returns {number}
 */
function time_zoneddate2utc(date: string, timezone: string): number {
    let offset: string

    //calculate an offset for each time
    //because, depending on daylight savings
    //the offset can be different depending on time of year!
    if ("Temporal" in window) {
        let t = Temporal.ZonedDateTime.from(date + `[${timezone}]`)
        offset = t.offset
    } else {
        //NOTE:
        //even within the same location eg America/Los_Angeles
        //the date may need to convert timezones (eg: PST -> PDT)
        //this may lead to 1 hours differences if the user inputs an old date
        //which is correct because we're converting from the current timezone
        //to the one used on that old date
        //
        //Users should migrate to a browser that uses real dates
        offset = Intl.DateTimeFormat("en", {
            timeZone: timezone,
            timeZoneName: "longOffset"
        }).formatToParts().find(k => k.type === "timeZoneName")?.value.slice(3) || "-00:00"
    }

    return date
        ? time_utcDate(new Date(date + offset))
        : 0
}

/**
 * compares 2 timestamps from 2 timezones
 * DOES t2 - t1 NOT t1 - t2
 * @param {bigint} t1 - time in nanoseconds
 * @param {string} t1zone - t1's timezone
 * @param {bigint} t2 - time in nanoseconds
 * @param {string} t2zone - t2's timezone
 */
function time_compare(t1: bigint, t1zone: string, t2: bigint, t2zone: string) {
    if ("Temporal" in window) {
        t1zone = t1zone === "Etc/Unknown" ? "Atlantic/Reykjavik" : t1zone
        t2zone = t2zone === "Etc/Unknown" ? "Atlantic/Reykjavik" : t2zone
        let leftTime = new Temporal.ZonedDateTime(
            t1,
            t1zone 
        )
        let rightTime = new Temporal.ZonedDateTime(
            t2,
            t2zone
        )
        return Temporal.ZonedDateTime.compare(rightTime, leftTime)
    }
    if (t1 == t2) {
        return 0
    }
    return t2 - t1
}
