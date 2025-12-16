type shortcuts_run_t = (e: Event) => any

class Trie {
    value: string
    children: Record<string, Trie>
    ctrl: boolean
    alt: boolean
    shift: boolean
    run: shortcuts_run_t
    constructor(value: string, children: Record<string, Trie>,
               ctrl: boolean, alt: boolean, shift: boolean, run?: shortcuts_run_t) {
        this.value = value
        this.children = children
        this.ctrl = ctrl
        this.alt = alt
        this.shift = shift
        this.run = run ?? (() =>  {})
    }

    press(event: Event, key: string, ctrl: boolean, alt: boolean, shift: boolean) {
        if(!(key in this.children)) return false

        let next = this.children[key]

        if(next.ctrl !== ctrl || next.alt !== alt || next.shift !== shift) {
            return false
        }

        if(Object.keys(next.children).length === 0) {
            next.run(event)
            return true
        } else {
            return next
        }
    }

    nnoremap(seq: string,
             ctrl: boolean, alt: boolean, shift: boolean,
             run: shortcuts_run_t) {

        const char = seq[0]
        if(!char) return
        if(!(char in this.children)) {
            this.children[char] = new Trie(char, {}, ctrl, alt, shift, run)
        }

        this.children[char].nnoremap(seq.slice(1), ctrl, alt, shift, run)
    }
}

const shortcuts = new Trie("", {}, false, false, false)
