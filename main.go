package main

import (
	// "aiolimas/webservice/dynamic"
	"net/http"
	"path/filepath"
	// "strings"
)

func root(w http.ResponseWriter, req *http.Request) {
	rootPath := "./www"
	path := req.URL.Path
	// if strings.HasPrefix(path, "/html") {
	// 	dynamic.HtmlEndpoint(w, req)
	// 	return
	// }
	fullPath := filepath.Join(rootPath, path)
	http.ServeFile(w, req, fullPath)
}

func main() {
	http.HandleFunc("/", root)
	http.ListenAndServe(":8081", nil)
}
