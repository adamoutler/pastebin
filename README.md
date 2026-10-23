# Hastebin Plus (`hackedyour.info`)
Hastebin Plus is a lightweight, security-hardened pastebin written in Node.js for sharing plain text, code, logs, and Markdown documents.
It is based on [haste](https://github.com/seejohnrun/haste-server) and [Hastebin Plus](https://github.com/MarvinMenzerath/HastebinPlus), enhanced for speed, simplicity, and zero-execution client-side Markdown rendering.

## Docker
```bash
git clone https://github.com/adamoutler/pastebin.git
cd pastebin
docker build -t pastebin .
docker run --name pastebin \
  -v pastebin-pastes:/opt/pastebin/data \
  -v pastebin-images:/opt/pastebin/static/images \
  -p 7777:7777 \
  -d pastebin
```

## Features
* **Plain Text & Code Pastes:** Fast dark-mode viewer with line numbers, raw paste endpoint (`/raw/:id`), and one-key duplication (`Ctrl + D`).
* **Automatic Client-Side Markdown Detection & Rendering:**
  * Automatically detects Markdown documents (headings, fenced code blocks, GFM tables, bulleted/numbered/task lists, blockquotes) without false positives on source code, scripts, JSON, YAML, or diffs.
  * Normalized pastebin typography in dark mode with gray text (`#839496`) on a black (`#000`) background and subtle charcoal code blocks (`#0c0c0c`).
  * Toggle between rendered Markdown and plain text at any time via the `MD` toolbar button or `Ctrl + Shift + M`.
* **Writing Mode Live Preview:** Switch between `Write` and `Preview` before saving (`Ctrl + S`).
* **Zero Client-Side Execution Architecture:**
  * Pure Token-to-DOM rendering (`document.createElement` + `textContent` only; zero `innerHTML`, `outerHTML`, or `.html()` sinks).
  * Raw HTML and `<script>` tags inside pastes are rendered strictly as inert literal text.
  * Image syntax `![alt](url)` is preserved literally as plain text so zero external or internal image requests fire automatically.
  * Links (`[label](url)`) enforce an explicit protocol allowlist (`https:`, `http:`, `mailto:`, `#anchor`) with `rel="noopener noreferrer nofollow"`.
  * Server-side `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: DENY` headers.
* **OpenGraph Image Previews:** Automatically generates preview images (`/images/:id.png`) for shared links.

## Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| `Ctrl + S` | Save current paste |
| `Ctrl + N` | New paste (Writing Mode) |
| `Ctrl + D` | Duplicate locked paste into editor |
| `Ctrl + Shift + R` | Open raw text view (`/raw/:id`) |
| `Ctrl + Shift + M` | Toggle Markdown view / Writing preview |
| `Ctrl + Shift + T` | Share paste link |

## Installation (Bare Metal)
1. Clone this repository: `git clone https://github.com/adamoutler/pastebin.git`
2. Open `config.js` and adjust settings if needed.
3. Install dependencies: `npm ci`
4. Run security and unit tests: `npm test`
5. Start the application: `npm start`

## Settings (`config.js`)
| Key                    | Description                                  | Default value |
| ---------------------- | -------------------------------------------- | ------------- |
| `host`                 | The host the server runs on                  | `0.0.0.0`     |
| `port`                 | The port the server runs on                  | `7777`        |
| `dataPath`             | The directory where all pastes are stored    | `./data`      |
| `keyLength`            | The length of the pastes' key                | `16`          |
| `maxLength`            | Maximum chars in a paste                     | `5000000`     |
| `staticMaxAge`         | Max age for static assets                    | `86400`       |
| `compressStaticAssets` | Whether or not to compile static js assets   | `true`        |
| `documents`            | Static documents to serve; will never expire | See below     |

### Default Config
```json
{
    "host": "0.0.0.0",
    "port": 7777,
    "dataPath": "./data",
    "keyLength": 16,
    "maxLength": 5000000,
    "staticMaxAge": 86400,
    "compressStaticAssets": true,
    "documents": {
        "about": "./README.md"
    }
}
```

## Testing
```bash
npm test
pytest -v test_server.py
```

## Authors
* [Adam Outler](https://github.com/adamoutler)
* [Hastebin Plus](https://github.com/MarvinMenzerath/HastebinPlus): Marvin Menzerath
* [haste](https://github.com/seejohnrun/haste-server): John Crepezzi - MIT License
* [jQuery](https://github.com/jquery/jquery): MIT License
* [highlight.js](https://github.com/isagalaev/highlight.js): Ivan Sagalaev - [License](https://github.com/isagalaev/highlight.js/blob/master/LICENSE)

## License
Copyright (C) 2014 Marvin Menzerath

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see http://www.gnu.org/licenses/.
