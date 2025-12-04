function! EditTemplate(path)
    exec 'e www/ui/html-templates/' . a:path
    if !findfile("www/ui/html-templates", a:path)
        call setline(1, "<template id=\"" . a:path[:-6] . "\">")
        call setline(2, "</template>")
        norm 1o
        2
    endif
endfun

function! ListTemplates(al, cl, cp)
    return readdir("www/ui/html-templates")->map({ _, n -> n[:-6] })
endfun

command! -nargs=1 -complete=customlist,ListTemplates T call EditTemplate("<args>.html")
