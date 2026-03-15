# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pdf2md is a web app that batch-converts documents (PDF, DOCX, PPTX, XLSX, EPUB) to editable Markdown. It has a sidebar file manager, split-pane Markdown editor with live preview, and ZIP export. Two conversion engines: `opendataloader-pdf` (Python/Java, PDF only) and `kreuzberg` (Node.js native, all formats).

## Commands

```bash
npm install                      # Install Node dependencies
pip3 install opendataloader-pdf  # Install opendataloader engine (requires Java Runtime)
npm start                        # Start server at http://localhost:3000
npm run dev                      # Start with --watch (auto-restart on file changes)
```

No test suite, no linter, no build step. The frontend is vanilla HTML/CSS/JS served as static files.

## Architecture

**Single-server monolith** — one Express server handles both the API and serves the SPA.

### Backend (`server.js`)
- Express server on port 3000 (configurable via `PORT` env var)
- `POST /api/convert` — accepts file upload via Multer, converts to Markdown using selected engine (`opendataloader` or `kreuzberg`), returns Markdown
- opendataloader engine: shells out to Python (`opendataloader_pdf.convert()` via `child_process.execSync`), PDF only
- kreuzberg engine: uses `@kreuzberg/node` (`extractFileSync`), supports PDF/DOCX/PPTX/XLSX/EPUB
- Temp files in `uploads/` and `output/` are cleaned up after each request

### Frontend (`public/`)
- **No framework, no build step** — vanilla JS with CDN-loaded `marked.js` and `JSZip`
- `app.js` — all client state in a `Map` called `fileStore`, keyed by generated IDs
- Sequential conversion queue — files convert one at a time via `processQueue()`
- Dirty state tracking with Save/Discard/Cancel confirm dialog on file switch
- ZIP export handles duplicate filenames with counter suffix

### Data Flow
1. User drops files → `addFile()` enqueues → `processQueue()` sends to `/api/convert` with selected engine
2. Server converts via opendataloader (Python) or kreuzberg (Node.js) → returns Markdown → cached in `fileStore`
3. User edits Markdown, exports individual .md or batch ZIP

## Key Constraints

- **Python 3 + Java Runtime required** for opendataloader engine; kreuzberg engine needs only Node.js
- **Scanned/image-only PDFs not supported** — only text-layer PDFs work
- Conversion timeout: 120s, max upload: 50MB
- CDN dependencies: `marked@15.0.7`, `jszip@3.10.1` — app requires internet on first load

## File Conventions

- All source is in the root and `public/` — no nested src directory
- `docs/plans/` — design documents for features
- `docs/changelog-1.0.0.md` — changelog (update when making changes)
- `test-resumes/` — sample PDFs for manual testing
