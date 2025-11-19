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

var templates *template.Template

func setupAIOWebStorage() {
	os.MkdirAll(SETTINGS_ROOT+"/aio-web", 0o700)
}

func createUserSettings(uid int64) {
	os.MkdirAll(SETTINGS_ROOT+fmt.Sprintf("/aio-web/%d", uid), 0o700)
	os.WriteFile(SETTINGS_ROOT+fmt.Sprintf("/aio-web/%d/settings.json", uid), []byte("{}"), 0o644)
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
	err = os.WriteFile(SETTINGS_ROOT+fmt.Sprintf("/aio-web/%d/settings.json", uid), text, os.FileMode(os.O_WRONLY))
	return err
}

// func include(file string, data any) (template.HTML, error) {
// 	var buf bytes.Buffer
// 	println(file)
// 	if err := parseTemplate(&buf, file, data); err != nil {
// 		return template.HTML(""), err
// 	}
// 	return template.HTML(buf.String()), nil
// }

func parseTemplate(into io.Writer, file string, data any) error {
	templates.Lookup(file).Execute(into, data)
	return nil
}

func root(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path == "/login" {
		auth := req.Header.Get("Authorization")
		println(auth)

		b64 := ""

		if strings.HasPrefix(auth, "Basic ") {
			b64 = auth[len("Basic "):]
		}

		path := "/ui"
		if req.URL.Query().Has("location") {
			path = req.URL.Query().Get("location")
		} else if req.URL.RawQuery != "" {
			path += fmt.Sprintf("?%s", req.URL.RawQuery)
		}
		w.Header().Set("Location", path)
		if b64 != "" {
			uid, status, err := ckAuth(b64)
			if status == 200 {
				w.Header().Set("Set-Cookie", fmt.Sprintf("login=%s", b64))
				w.Header().Add("Set-Cookie", fmt.Sprintf("uid=%d", uid))
				w.WriteHeader(301)
			} else {
				w.WriteHeader(status)
				w.Write([]byte(err.Error()))
			}
		} else {
			w.Header().Add("WWW-Authenticate", "Basic realm=\"ssd\"")
			w.WriteHeader(401)
			w.Write([]byte("Login"))
		}
		return
	}
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
		aioLimasSection, _ := config.GetSection("aio_limas")
		host, err := aioLimasSection.GetKey("host")
		hostString := "http://localhost:8080"
		if err == nil {
			hostString = host.String()
		} else {
			fmt.Fprintf(os.Stderr, "Failed to get config host: %s", err.Error())
		}

		if err := parseTemplate(w, fullPath, TemplateInfo{AIO: hostString}); err != nil {
			w.WriteHeader(500)
			w.Write([]byte(err.Error()))
			return
		}
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
	uidStr := req.URL.Query().Get("uid")
	uid, err := strconv.ParseInt(uidStr, 10, 64)
	if err != nil {
		println(err.Error())
		w.WriteHeader(400)
		w.Write([]byte(err.Error()))
		return
	}

	settings := readUserSettings(uid)
	settingsMarshaled, _ := json.Marshal(settings)

	w.WriteHeader(200)
	w.Write(settingsMarshaled)
}

func setSetting(w http.ResponseWriter, req *http.Request) {
	auth := req.URL.Query().Get("auth")
	if auth == "" {
		header := req.Header.Get("Authorization")

		if strings.HasPrefix(header, "Basic ") {
			auth = header[len("Basic "):]
		}
	}

	uid, status, err := ckAuth(auth)
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

	filepath.WalkDir("www", func(file string, d os.DirEntry, err error) error {
		if !strings.HasSuffix(file, ".html") {
			return nil
		}

		if templates == nil {
			bytes, _ := os.ReadFile(file)
			templates, _ = template.New(file).Parse(string(bytes))
		} else {
			bytes, _ := os.ReadFile(file)
			templates.New(file).Parse(string(bytes))
		}
		return nil
	})

	http.HandleFunc("/user/{username}", userRedirect)
	http.HandleFunc("/uid/{uid}", userIDRedirect)

	http.HandleFunc("/settings/get", getSetting)
	http.HandleFunc("/settings/set", setSetting)

	http.HandleFunc("/", root)
	http.HandleFunc("/login", root)
	http.ListenAndServe(fmt.Sprintf(":%s", port), nil)
}
