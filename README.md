<div align="center">

<h1>⚡ PDFXpress</h1>
<p><strong>Your Complete PDF Toolkit — 100% Browser-Based & Private</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)

</div>

---

## 📖 Overview

**PDFXpress** is a feature-rich, browser-based PDF toolkit that lets you Merge, Split, Convert, Protect, Annotate, and Crack PDFs — all **locally in your browser** with no server uploads, no sign-up, and no watermarks.

The Password Cracker tool uses a companion Python/Flask backend (`Pdf password tool.py`) that runs locally on your machine and performs multi-threaded dictionary attacks using [pikepdf](https://pikepdf.readthedocs.io/).

---

## ✨ Features

| Tool | Description |
|------|-------------|
| 📎 **PDF Merger** | Combine multiple PDFs into one document, in any order |
| ✂️ **PDF Splitter** | Extract individual pages or a custom page range as separate PDFs |
| 🖼️ **PDF → Image** | Convert each PDF page to high-quality PNG (72, 144, or 216 DPI) |
| 🔐 **PDF Protector** | Add AES-128 password encryption with granular permissions (print, copy, edit) |
| 📝 **Form Filler** | Annotate PDFs with text, highlights, and freehand signatures |
| 🔓 **Password Cracker** | Recover lost passwords via wordlist, pattern, rules, and optional GPU (Hashcat) attacks |

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 / Vanilla CSS / JavaScript** — Zero framework dependencies
- **[PDF-lib](https://pdf-lib.js.org/)** — Client-side PDF creation, merging, splitting, and encryption
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — PDF rendering in the browser (page preview, convert to image)
- **[JSZip](https://stuk.github.io/jszip/)** — ZIP packaging for bulk page downloads
- **[Inter Font](https://fonts.google.com/specimen/Inter)** — Modern, clean UI typography

### Backend (Password Cracker only)
- **Python 3** with **Flask** — Local REST API server (`http://127.0.0.1:5000`)
- **[pikepdf](https://pikepdf.readthedocs.io/)** — PDF password verification and decryption
- **threading / ThreadPoolExecutor** — Multi-threaded parallel cracking (8 workers by default)
- **[Hashcat](https://hashcat.net/) + pdf2john** — Optional GPU-accelerated cracking

---

## 🚀 Getting Started

### 1. Frontend (No Installation Required)
Just open `index.html` directly in your browser. All tools except the Password Cracker work entirely offline.

```bash
# Clone the repository
git clone https://github.com/DeepakDubat/PDFXpress.git
cd PDFXpress

# Open in browser
start index.html       # Windows
open index.html        # macOS
xdg-open index.html    # Linux
```

### 2. Backend — Password Cracker (Python required)

#### Prerequisites
```bash
pip install flask pikepdf
```

#### Run the local server
```bash
python "Pdf password tool.py"
```
This starts a server at `http://127.0.0.1:5000`. Keep this terminal open while using the Password Cracker tool in the browser.

#### Wordlist Setup
By default, the cracker looks for a file named `rockyou.txt` in the project folder.  
Download it from [SecLists](https://github.com/danielmiessler/SecLists/tree/master/Passwords) or any password list repository and place it in the project directory.

```
PDFXpress/
├── Pdf password tool.py
├── rockyou.txt          ← Place your wordlist here
├── index.html
├── app.js
└── style.css
```

---

## 🗂️ Project Structure

```
PDFXpress/
│
├── index.html               # Main HTML — UI layout, tool panels, hero & sections
├── style.css                # Vanilla CSS — dark theme, glassmorphism, animations
├── app.js                   # Core JavaScript — all client-side PDF operations
│
└── Pdf password tool.py     # Python/Flask backend for the Password Cracker tool
```

---

## 🔓 Password Cracker — How It Works

The cracker offers three layered attack modes that can be combined:

```
┌──────────────────────────────────────────────────────┐
│  Attack Modes                                        │
│                                                      │
│  📚 Wordlist     → Dictionary attack (rockyou.txt)  │
│  🎯 Patterns     → Numeric sequences, common words  │
│  🔀 Rules        → Mutations: leet, caps, suffixes  │
│  ⚡ GPU (opt.)   → Hashcat + pdf2john integration   │
└──────────────────────────────────────────────────────┘
```

The backend spawns **8 parallel threads**, splits the candidate list equally, and streams live progress back to the frontend every 400ms via a JSON polling API (`/status-json`).

---

## 🖥️ Screenshots

> The interface features a dark-mode premium UI with glassmorphism cards, animated floating tool previews, and a live cracking console.

---

## ⚙️ Configuration

Edit the top of `Pdf password tool.py` to customize:

```python
WORDLIST_PATH = "rockyou.txt"   # Path to your wordlist
MAX_WORKERS   = 8               # Number of cracking threads
```

---

## ⚠️ Disclaimer

> **For Educational & Personal Use Only.**  
> The Password Cracker is designed to help you recover passwords from your own PDFs. Do **not** use this tool on files you do not own or have explicit permission to access.  
> The backend runs locally only (`127.0.0.1`) and must never be exposed to a public network.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/DeepakDubat">DeepakDubat</a></p>
  <p><em>⚡ No Upload · No Signup · 100% Private</em></p>
</div>
