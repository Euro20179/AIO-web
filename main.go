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

	if stat, err := os.Stat(fullPath); err == nil && stat.IsDir() {
		if strings.HasSuffix(fullPath, "/") {
			fullPath += "index.html"
		} else {
			fullPath += "/index.html"
		}
	}

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

func userRedirect(w http.ResponseWriter, req *http.Request) {
	name := req.PathValue("username")
	http.Redirect(w, req, fmt.Sprintf("/ui?uname=%s", name), http.StatusPermanentRedirect)
}

func userIDRedirect(w http.ResponseWriter, req *http.Request) {
	name := req.PathValue("uid")
	http.Redirect(w, req, fmt.Sprintf("/ui?uid=%s", name), http.StatusPermanentRedirect)
}

func main() {
	data, err := ini.Load("./server-config.ini")
	if err != nil {
		panic(fmt.Sprintf("Failed to load config\n%s", err.Error()))
	}

	config = data

	port := "8081"
	var portKey *ini.Key

	networkSection, err := config.GetSection("network")
	if err != nil {
		println(err.Error())
		goto start
	}

	portKey, err = networkSection.GetKey("port")
	if err != nil {
		println(err.Error())
		goto start
	}
	port = portKey.String()

	start:

	http.HandleFunc("/user/{username}", userRedirect)
	http.HandleFunc("/uid/{uid}", userIDRedirect)

	http.HandleFunc("/", root)
	http.ListenAndServe(fmt.Sprintf(":%s", port), nil)
}
