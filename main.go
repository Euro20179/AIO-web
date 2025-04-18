package main

import (
	// "aiolimas/webservice/dynamic"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/ini.v1"
	// "strings"
)

var config *ini.File;

type TemplateInfo struct {
	AIO string
	API string
}

func root(w http.ResponseWriter, req *http.Request) {
	rootPath := "./www"
	path := req.URL.Path
	// if strings.HasPrefix(path, "/html") {
	// 	dynamic.HtmlEndpoint(w, req)
	// 	return
	// }
	fullPath := filepath.Join(rootPath, path)

	if strings.HasSuffix(fullPath, ".html") {
		tmpl, err := template.ParseFiles(fullPath)
		if err != nil {
			w.WriteHeader(500)
			w.Write([]byte("Failed to parse file as template"))
			return;
		}

		aioLimasSection, _ := config.GetSection("aio_limas")
		host, err := aioLimasSection.GetKey("host")
		hostString := "http://localhost:8080"
		if err == nil {
			hostString = host.String()
		} else {
			fmt.Fprintf(os.Stderr, "Failed to get config host: %s", err.Error())
		}


		tmpl.Execute(w, TemplateInfo { AIO: hostString})
	} else {
		http.ServeFile(w, req, fullPath)
	}
}

func main() {
	data, err := ini.Load("./server-config.ini")
	if err != nil {
		panic(fmt.Sprintf("Failed to load config\n%s", err.Error()))
	}

	config = data

	http.HandleFunc("/", root)
	http.ListenAndServe(":8081", nil)
}
