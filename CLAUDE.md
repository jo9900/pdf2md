# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pdfloader is a web app that batch-converts PDFs to editable Markdown. It has a sidebar file manager, split-pane Markdown editor with live preview, and template-based PDF export. PDF conversion is powered by `opendataloader-pdf` (Python/Java).

## Commands

```bash
npm install                    # Install Node dependencies
pip3 install opendataloader-pdf  # Install PDF conversion engine (requires Java Runtime)
npm start                      # Start server at http://localhost:3000
npm run dev                    # Start with --watch (auto-restart on file changes)
```

No test suite, no linter, no build step. The frontend is vanilla HTML/CSS/JS served as static files.

## Architecture

**Single-server monolith** — one Express server handles both the API and serves the SPA.

### Backend (`server.js`)
- Express server on port 3000 (configurable via `PORT` env var)
- `POST /api/convert` — accepts PDF upload via Multer, shells out to Python (`opendataloader_pdf.convert()` via `child_process.execSync`), returns Markdown
- Template endpoints (`/api/template`) — upload/get/delete a PDF style template; styles extracted via `pdfjs-dist`
- `POST /api/generate-pdf` — converts Markdown to styled PDF using Puppeteer (headless Chrome singleton)
- Template state is in-memory (session-level, lost on restart)
- Temp files in `uploads/` and `output/` are cleaned up after each request

### Frontend (`public/`)
- **No framework, no build step** — vanilla JS with CDN-loaded `marked.js` and `JSZip`
- `app.js` — all client state in a `Map` called `fileStore`, keyed by generated IDs
- Sequential conversion queue — files convert one at a time via `processQueue()`
- Dirty state tracking with Save/Discard/Cancel confirm dialog on file switch
- ZIP export handles duplicate filenames with counter suffix

### Data Flow
1. User drops PDFs → `addFile()` enqueues → `processQueue()` sends to `/api/convert` sequentially
2. Server runs Python `opendataloader_pdf` → returns Markdown → cached in `fileStore`
3. For PDF export: client sends Markdown to `/api/generate-pdf` → server renders HTML via Puppeteer → returns PDF binary

## Key Constraints

- **Python 3 + Java Runtime required** — `opendataloader-pdf` depends on both
- **Scanned/image-only PDFs not supported** — only text-layer PDFs work
- Conversion timeout: 120s, max upload: 50MB
- Puppeteer browser instance is a lazy singleton (first PDF export triggers Chrome launch)
- CDN dependencies: `marked@15.0.7`, `jszip@3.10.1` — app requires internet on first load

## File Conventions

- All source is in the root and `public/` — no nested src directory
- `docs/plans/` — design documents for features
- `docs/changelog-1.0.0.md` — changelog (update when making changes)
- `test-resumes/` — sample PDFs for manual testing
