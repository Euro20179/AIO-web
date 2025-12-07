<!doctype html>
<?php include $_SERVER["DOCUMENT_ROOT"] . '/lib/util.php'; ?>
<html lang="en">

<head>
    <script src="/config.js"></script>
    <script src="/ui/globals.js"></script>
    <script src="/ui/ui.js"></script>
    <script src="/js/api.js"></script>
    <script src="/ui/components.js"></script>

    <meta charset="UTF-8" />
    <title>Home</title>
    <link rel="stylesheet" href="/css/colors.css" />
    <link rel="stylesheet" href="/css/general.css" />
    <link rel="manifest" href="/manifest.json" />
    <style>
        body {
            font-family: sans-serif;
        }

        #users-output {
            display: flex;
            flex-direction: column;

            padding: 0;
            list-style: none;
            gap: var(--small-gap);

            text-transform: capitalize;

            a {
                font-size: 1.2em;
                width: 100%;
                cursor: pointer;
                text-transform: capitalize;
            }

            a::after {
                content: "'s media";
            }
        }

        nav {
            float: right;

            button, a {
                height: 2em;
            }

            a {
                text-decoration: none;
            }

            img {
                vertical-align: middle;
            }

            @media (prefers-color-scheme: dark) {
                [src="/assets/github.ico"] {
                    /*basically invisible otherwise*/
                    background: var(--text-color);
                }
            }
        }
    </style>
</head>

<body>
<?php
    tmpl("login-dialog");
    tmpl("alert-box");
    tmpl("color-scheme-selector");
?>

    <color-scheme-selector hidden></color-scheme-selector>
    <nav>
        <a href="https://github.com/euro20179/aio-web">
            <img src="/assets/github.ico">
        </a>
        <button onclick="signinUI()">Login</button>
        <button onclick="setUserAuth(''); alert('Logged out')">Logout</button>
        <a href="/create-account.html"><button>Create account</button></a>
    </nav>

    <header>
            <h1>AIO Web</h1>
    </header>

    <p>
        Welcome to AIO Web, a frontend for <a href="https://github.com/euro20179/aio-limas">aio limas</a>.
    </p>
    <div class="flex" style="gap: 2ch;">
        <a href="/usage/">aio web usage</a>
            <a href="<?=get_aio_host()?>/docs">aio server usage</a>
    </div>

    <h2 class="">Users</h2>

    <input placeholder="search users" oninput="userFilter(this)">

    <ul id="users-output"></ul>

    <login-dialog></login-dialog>

    <footer>
        <alert-box></alert-box>
    </footer>

    <script>

        function userFilter(inp) {
            const search = inp.value.toLowerCase()

            for(let userLink of document.querySelectorAll("#users-output a")) {
                userLink.parentElement.hidden = false

                if(!userLink.innerText.toLowerCase().includes(search)) {
                    userLink.parentElement.hidden = true
                }
            }
        }

        const params = new URLSearchParams(document.location.search);
        const uid = params.get("uid");
        if (uid) {
            window.location = `/ui/?uid=${uid}`;
        }

        fetch(`${AIO}/account/list`)
            .then((res) => res.text())
            .then((users) => {
                const usersOutput = document.getElementById("users-output");
                users.split("\n").forEach((user) => {
                    if (!user) return;

                    const [id, name] = user.split(":");
                    const html = `
<li>
    <a href="/ui?uid=${id}">${name}</a>
</li>`;
                    usersOutput.innerHTML += html;
                });
            });
    </script>
</body>

</html>
