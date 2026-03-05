# pdfloader

A web application that batch-converts PDF documents to editable Markdown with a sidebar file manager.

PDF conversion powered by [opendataloader-pdf](https://github.com/opendataloader-project/opendataloader-pdf) (Fast mode).

## Features

- **Batch upload** — drag & drop or pick multiple PDFs at once
- **Sidebar file list** — shows conversion status per file (pending, converting, done, error)
- **Sequential conversion queue** — files convert one at a time to avoid server overload
- **Split-pane editor** — live Markdown editor (textarea) + HTML preview side by side
- **Dirty state tracking** — unsaved edit indicator, confirm dialog when switching files
- **Conversion caching** — switch between files instantly, no re-conversion
- **ZIP export** — one-click download of all converted `.md` files
- **Template PDF export** — upload a PDF template, extract styles (fonts, sizes, margins, page layout), and export Markdown as styled PDFs
- **PDF preview** — in-page preview modal before downloading generated PDFs
- **Batch PDF ZIP** — export all files as styled PDFs in a single ZIP
- **Keyboard shortcuts** — `Cmd/Ctrl+S` save edits, `Cmd/Ctrl+E` export MD ZIP, `Cmd/Ctrl+Shift+E` export PDF
- **Click-to-retry** — click failed files in sidebar to re-queue conversion

## Tech Stack

### Backend
- **Node.js** + **Express** — API server (port 3000)
- **Multer** — PDF upload handling (max 50MB)
- **Puppeteer** — headless Chrome for Markdown-to-styled-PDF rendering
- **pdfjs-dist** — template PDF style extraction (fonts, sizes, margins)
- **marked** (server-side) — Markdown to HTML conversion for PDF generation
- **opendataloader-pdf** (Python) — PDF parsing & Markdown conversion engine
  - Called via `child_process.execSync`
  - Images embedded as Base64 data URIs in Markdown output

### Frontend
- **Vanilla HTML/CSS/JS** — no framework, no build step
- **marked.js** (CDN) — Markdown to HTML preview rendering
- **JSZip** (CDN) — client-side ZIP generation for batch export

## Project Structure

```
pdfloader/
├── server.js          # Express server + conversion API
├── package.json
├── public/
│   ├── index.html     # SPA layout (sidebar + editor + modal)
│   ├── app.js         # Client-side state management & UI logic
│   └── style.css      # Dark theme styles
├── uploads/           # Temporary upload storage (cleaned after conversion)
├── output/            # Temporary conversion output (cleaned after response)
├── test-resumes/      # Sample PDF/DOCX files for testing
└── docs/              # Design docs, plans, changelog
```

## API

```
POST /api/convert
  Content-Type: multipart/form-data
  Body: pdf=<file>
  Response: { "markdown": "...", "filename": "original.pdf" }

POST /api/template
  Content-Type: multipart/form-data
  Body: template=<pdf-file>
  Response: { "filename": "...", "styles": { ... } }

GET /api/template
  Response: { "template": { "filename": "...", "styles": { ... } } | null }

DELETE /api/template
  Response: { "success": true }

POST /api/generate-pdf
  Content-Type: application/json
  Body: { "markdown": "..." }
  Response: application/pdf (binary)
```

## Getting Started

```bash
# Install dependencies
npm install
pip3 install opendataloader-pdf

# Start the server
npm start        # http://localhost:3000
npm run dev      # watch mode (auto-restart on changes)
```

### Requirements
- Node.js >= 18
- Python 3
- Java Runtime (required by opendataloader-pdf)

## Limitations

- **Scanned / image-only PDFs are not supported** — opendataloader-pdf extracts text from PDFs with an embedded text layer. Image-based PDFs (e.g. scans) require OCR, which is not included.
- **Images in downloaded `.md` files** — images are embedded as Base64 data URIs which render in the HTML preview but may not display in all markdown editors (VS Code, Typora, etc.). This is a limitation of the conversion library and most markdown renderers.
- Conversion timeout: 120 seconds
- Max upload size: 50MB
