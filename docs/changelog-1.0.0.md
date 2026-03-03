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

### Image Handling Note

Images embedded as base64 data URIs by the PDF converter render correctly in the HTML preview but may not display in all markdown editors. This is a limitation of the `opendataloader_pdf` library and most markdown renderers, not a bug in this application.
