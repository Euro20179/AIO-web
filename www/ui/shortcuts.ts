type shortcuts_run_t = (e: Event) => any

class shortcuts_Trie {
    value: string
    children: Record<string, shortcuts_Trie>
    ctrl: boolean
    alt: boolean
    shift: boolean
    run: shortcuts_run_t

    static execute_to: number | null = null

    constructor(value: string, children: Record<string, shortcuts_Trie>,
               ctrl: boolean, alt: boolean, shift: boolean, run?: shortcuts_run_t) {
        this.value = value
        this.children = children
        this.ctrl = ctrl
        this.alt = alt
        this.shift = shift
        this.run = run ?? (() =>  {})
    }

    press(event: Event, key: string, ctrl: boolean, alt: boolean, shift: boolean) {
        if(shortcuts_Trie.execute_to) {
            clearTimeout(shortcuts_Trie.execute_to)
        }

        if(!(key in this.children)) return false

        let next = this.children[key]

        if(next.ctrl !== ctrl || next.alt !== alt || next.shift !== shift) {
            return false
        }

        if(Object.keys(next.children).length === 0) {
            next.run(event)
            return true
        } else {
            shortcuts_Trie.execute_to = setTimeout(() => next.run(event), 300)
            return next
        }
    }

    nnoremap(seq: string,
             ctrl: boolean, alt: boolean, shift: boolean,
             run: shortcuts_run_t) {

        const char = seq[0]
        if(!(char in this.children)) {
            this.children[char] = new shortcuts_Trie(char, {}, ctrl, alt, shift, run)
        }

        if(seq.length > 1) {
            this.children[char].nnoremap(seq.slice(1), ctrl, alt, shift, run)
        } else {
            this.children[char] = new shortcuts_Trie(char, {},
                                                     ctrl, alt, shift, run)
        }
    }
}

const shortcuts = new shortcuts_Trie("", {}, false, false, false)
