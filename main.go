package main

import (
	// "aiolimas/webservice/dynamic"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/ini.v1"
	// "strings"
)

type StartupLang string

const (
	SL_JS   StartupLang = "javascript"
	SL_AIOL StartupLang = "aiol"
)

type UserSettings struct {
	UIStartupScript string
	StartupLang     StartupLang
}

var config *ini.File

type TemplateInfo struct {
	AIO string
	API string
}

var SETTINGS_ROOT = ""

func setupAIOWebStorage() {
	os.MkdirAll(SETTINGS_ROOT+"/aio-web", 0o700)
}

func createUserSettings(uid int64) {
	os.MkdirAll(SETTINGS_ROOT+fmt.Sprintf("/aio-web/%d", uid), 0o700)
	os.WriteFile(SETTINGS_ROOT + fmt.Sprintf("/aio-web/%d/settings.json", uid), []byte("{}"), 0o644)
}

func readUserSettings(uid int64) UserSettings {
	text, err := os.ReadFile(SETTINGS_ROOT + fmt.Sprintf("/aio-web/%d/settings.json", uid))
	if errors.Is(err, os.ErrNotExist) {
		createUserSettings(uid)
		text = []byte("{}")
	}

	settings := UserSettings{}
	err = json.Unmarshal(text, &settings)
	if err != nil {
		println(err.Error())
		return settings
	}
	return settings
}

func setUserSetting(uid int64, name string, value any) error {
	settings := readUserSettings(uid)
	switch name {
	case "UIStartupScript":
		settings.UIStartupScript = value.(string)
	case "StartupLang":
		settings.StartupLang = StartupLang(value.(string))
	}

	text, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	err = os.WriteFile(SETTINGS_ROOT + fmt.Sprintf("/aio-web/%d/settings.json", uid), text, os.FileMode(os.O_WRONLY))
	return err
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
			return
		}

		aioLimasSection, _ := config.GetSection("aio_limas")
		host, err := aioLimasSection.GetKey("host")
		hostString := "http://localhost:8080"
		if err == nil {
			hostString = host.String()
		} else {
			fmt.Fprintf(os.Stderr, "Failed to get config host: %s", err.Error())
		}

		tmpl.Execute(w, TemplateInfo{AIO: hostString})
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

func ckAuth(auth string) (int64, int, error) {
	aioLimasSection, _ := config.GetSection("aio_limas")
	host, _ := aioLimasSection.GetKey("host")

	r, _ := http.NewRequest("GET", fmt.Sprintf("%s/account/authorized", host.String()), nil)
	r.Header.Add("Authorization", fmt.Sprintf("Basic %s", auth))

	res, err := http.DefaultClient.Do(r)
	if err != nil {
		return -1, 500, err
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		return -1, 401, errors.New("not authorized")
	}

	text, err := io.ReadAll(res.Body)
	if err != nil {
		return -1, 500, err
	}

	uidStr := string(text)
	uid, _ := strconv.ParseInt(uidStr, 10, 64)

	return uid, 200, nil
}

func getSetting(w http.ResponseWriter, req *http.Request) {

	uid, status, err := ckAuth(req.URL.Query().Get("auth"))

	if err != nil {
		w.WriteHeader(status)
		println(err.Error())
		w.Write([]byte(err.Error()))
	}

	settings := readUserSettings(uid)
	settingsMarshaled, _ := json.Marshal(settings)

	w.WriteHeader(200)
	w.Write(settingsMarshaled)
}

func setSetting(w http.ResponseWriter, req *http.Request) {
	uid, status, err := ckAuth(req.URL.Query().Get("auth"))

	if err != nil {
		w.WriteHeader(status)
		println(err.Error())
		w.Write([]byte(err.Error()))
	}

	err = setUserSetting(uid, req.URL.Query().Get("setting"), req.URL.Query().Get("value"))
	if err != nil {
		println(err.Error())
		w.WriteHeader(500)
		w.Write([]byte(err.Error()))
		return
	}
	w.WriteHeader(200)
}

func main() {
	data, err := ini.Load("./server-config.ini")
	if err != nil {
		panic(fmt.Sprintf("Failed to load config\n%s", err.Error()))
	}

	SETTINGS_ROOT = os.Getenv("XDG_DATA_HOME")
	if SETTINGS_ROOT == "" {
		panic("XDG_DATA_HOME is unset")
	}

	setupAIOWebStorage()

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
	http.HandleFunc("/settings/get", getSetting)
	http.HandleFunc("/settings/set", setSetting)

	http.HandleFunc("/", root)
	http.ListenAndServe(fmt.Sprintf(":%s", port), nil)
}
