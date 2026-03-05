# Changelog v1.0.0

## 2026-03-03

### Multi-PDF Batch Workflow

- Added batch upload support for multiple PDF files at once (drag-drop or file picker)
- Added persistent sidebar with file list showing conversion status (pending, converting, done, error)
- Added sequential conversion queue — files convert one at a time to avoid server overload
- Added conversion result caching — switching between files reuses cached results
- Added dirty state tracking with visual indicator in sidebar
- Added confirm dialog when switching away from a file with unsaved edits (Save/Discard/Cancel)
- Added "Save" preserves current edits, "Discard" reverts to original conversion output
- Added one-click ZIP export of all converted markdown files (using JSZip)
- Added duplicate filename deduplication in ZIP export
- Added keyboard shortcuts: Cmd/Ctrl+S to save edits, Cmd/Ctrl+E to export ZIP
- Added file size display in sidebar
- Added per-file delete button (hover to reveal in sidebar, or toolbar button)
- Added click-to-retry for failed conversions
- Added global drag-and-drop — drop PDFs anywhere on the page
- Added PDF file detection fallback by extension when MIME type is unreliable

## 2026-03-05

### Template PDF Export

- Added style template upload in sidebar — upload a PDF to extract font sizes, families, margins, and page dimensions
- Added template style extraction using pdfjs-dist — analyzes font metrics, text positions, and page layout
- Added MD-to-styled-PDF generation using Puppeteer — converts markdown to HTML styled with template properties, then renders to PDF
- Added in-page PDF preview modal with iframe viewer — review generated PDFs before downloading
- Added single-file PDF export button in toolbar ("Export PDF")
- Added batch PDF ZIP export button in sidebar footer ("Export PDF ZIP") — generates all PDFs sequentially and bundles into ZIP
- Added loading overlay with progress indication for PDF generation (shows file count during batch export)
- Added keyboard shortcut Cmd/Ctrl+Shift+E for PDF export (single file or batch)
- Added Escape key to close PDF preview modal
- Added template management: upload, replace, and remove template via sidebar controls
- Added template drag-and-drop on the template drop area
- Template is session-level (server in-memory) — persists across page reloads but resets on server restart
- New dependencies: puppeteer, pdfjs-dist, pdf-lib, marked (server-side)

### Image Handling Note

Images embedded as base64 data URIs by the PDF converter render correctly in the HTML preview but may not display in all markdown editors. This is a limitation of the `opendataloader_pdf` library and most markdown renderers, not a bug in this application.
