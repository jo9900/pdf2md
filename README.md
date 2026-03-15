# pdf2md

A web application that batch-converts documents (PDF, DOCX, PPTX, XLSX, EPUB) to editable Markdown.

## Features

- **Batch upload** — drag & drop or pick multiple files at once
- **Dual conversion engines** — opendataloader-pdf (PDF only) and kreuzberg (all formats)
- **Sidebar file list** — shows conversion status per file (pending, converting, done, error)
- **Split-pane editor** — live Markdown editor + HTML preview side by side
- **Dirty state tracking** — unsaved edit indicator, confirm dialog when switching files
- **ZIP export** — one-click download of all converted `.md` files
- **Keyboard shortcuts** — `Cmd/Ctrl+S` save, `Cmd/Ctrl+E` export ZIP
- **Click-to-retry** — click failed files in sidebar to re-queue conversion

## Getting Started

```bash
git clone https://github.com/jo9900/pdf2md.git
cd pdf2md
npm install
pip3 install opendataloader-pdf   # optional, for opendataloader engine
npm start                         # http://localhost:3000
```

### Requirements

- **Node.js >= 18** (required)
- **Python 3 + Java Runtime** (required for opendataloader engine only)
- kreuzberg engine works with Node.js alone

## Tech Stack

### Backend
- **Node.js** + **Express** — API server (port 3000)
- **Multer** — file upload handling (max 50MB)
- **opendataloader-pdf** (Python) — PDF to Markdown conversion
- **@kreuzberg/node** — multi-format document to Markdown conversion

### Frontend
- **Vanilla HTML/CSS/JS** — no framework, no build step
- **marked.js** (CDN) — Markdown to HTML preview rendering
- **JSZip** (CDN) — client-side ZIP generation for batch export

## API

```
POST /api/convert?engine=opendataloader|kreuzberg
  Content-Type: multipart/form-data
  Body: pdf=<file>
  Response: { "markdown": "...", "filename": "original.pdf", "engine": "..." }
```

## Project Structure

```
pdf2md/
├── server.js          # Express server + conversion API
├── package.json
├── public/
│   ├── index.html     # SPA layout (sidebar + editor)
│   ├── app.js         # Client-side state management & UI logic
│   └── style.css      # Dark theme styles
├── uploads/           # Temporary upload storage (cleaned after conversion)
├── output/            # Temporary conversion output (cleaned after response)
├── test-resumes/      # Sample PDF files for testing
└── docs/              # Design docs, plans, changelog
```

## Limitations

- **Scanned / image-only PDFs not supported** — requires text-layer PDFs
- Conversion timeout: 120 seconds
- Max upload size: 50MB
