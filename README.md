# pdfloader

A web application that converts PDF documents to editable Markdown.

## Tech Stack

### Backend
- **Node.js** + **Express** — API server (port 3000)
- **Multer** — PDF upload handling (max 50MB)
- **opendataloader-pdf** (Python) — PDF parsing & Markdown conversion engine
  - Called via `child_process.execSync`
  - Images embedded as Base64 data URIs in Markdown output

### Frontend
- **Vanilla HTML/CSS/JS** — no framework
- **marked.js** (CDN) — Markdown → HTML preview rendering
- Drag & drop PDF upload
- Split-pane editor (textarea + live preview)
- Download converted `.md` files

## Project Structure

```
pdfloader/
├── server.js          # Express server + conversion API
├── package.json
├── public/
│   ├── index.html     # SPA frontend
│   └── style.css
├── uploads/           # Temporary upload storage (cleaned after conversion)
└── output/            # Temporary conversion output (cleaned after response)
```

## API

```
POST /api/convert
  Content-Type: multipart/form-data
  Body: pdf=<file>

  Response: { "markdown": "...", "filename": "original.pdf" }
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
- Node.js ≥ 18
- Python 3
- Java Runtime (required by opendataloader-pdf)

## Limitations

- **Scanned / image-only PDFs are not supported** — opendataloader-pdf extracts text from PDFs with an embedded text layer. Image-based PDFs (e.g. scans) require OCR, which is not included.
- Conversion timeout: 120 seconds
- Max upload size: 50MB
