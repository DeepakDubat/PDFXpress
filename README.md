<div align="center">

<h1>⚡ PDFXpress</h1>
<p><strong>Your Complete PDF Toolkit — 100% Client-Side, Serverless & Private</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

---

## 📖 Overview

**PDFXpress** is a high-performance, lightweight, and modern PDF toolkit that operates **completely client-side** in your web browser. There is no backend server, no upload overhead, and no telemetry. All file operations are processed directly within your browser's sandbox using Javascript array buffers, guaranteeing maximum speed, absolute privacy, and offline capability.

Live Demo : https://pdfxpress.dubat.workers.dev
---

## ✨ Features

| Tool | Description |
|------|-------------|
| 📎 **PDF Merger** | Combine multiple PDFs into one document in your preferred order |
| ✂️ **PDF Splitter** | Extract individual pages or specify a custom page range as new files |
| 🖼️ **PDF → Image** | Render and convert PDF pages to high-quality PNG images at custom DPI scales |
| 📝 **Form Filler** | Annotate pages, fill form elements, draw signatures, and place highlighters |

---

## 🛠️ Tech Stack

- **HTML5 & Vanilla CSS3** — Fully customized layout with dark mode glassmorphism effects.
- **[PDF-lib](https://pdf-lib.js.org/)** — Performs in-browser PDF copying, drawing, page management, and final serialization.
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — Renders pages with pixel-perfect resolution on HTML5 `<canvas>` objects.
- **[JSZip](https://stuk.github.io/jszip/)** — Gathers and packages multiple split pages or converted images into clean `.zip` archives.
- **[Inter Font](https://fonts.google.com/specimen/Inter)** — Elegant and clean typeface for premium user interfaces.

---

## 🚀 Getting Started

No installation or environment setup is required. You can run the application directly by opening the `index.html` file.

```bash
# Clone the repository
git clone https://github.com/DeepakDubat/PDFXpress.git
cd PDFXpress

# Open in your browser
start index.html       # Windows
open index.html        # macOS
xdg-open index.html    # Linux
```

---

## 🗂️ Project Structure

```
PDFXpress/
├── index.html       # Main HTML — SPA panels, grids, and toolbar interfaces
├── style.css        # Vanilla CSS — core styling system, transitions, animations
├── app.js           # Client-side JS — handles all state management and PDF actions
└── README.md        # Project documentation
```

---

## 🔒 Security & Privacy

All file processing occurs locally inside your browser tab:
*   **No File Uploads**: Your documents are never sent over the internet or uploaded to external servers.
*   **Fully Offline**: The application can run entirely disconnected from the network.
*   **Encrypted Signature Pads**: Custom signature draws are rendered to temporary client-side data URLs and are not stored anywhere after saving the PDF.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/DeepakDubat">DeepakDubat</a></p>
  <p><em>⚡ No Upload · No Server · 100% Private</em></p>
</div>
