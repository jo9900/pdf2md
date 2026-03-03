# Multi-PDF Batch Workflow Design

## Overview

Transform the single-PDF upload app into a multi-file batch converter with sidebar file management, dirty state tracking, and ZIP export.

## Data Model

```
fileStore = Map<id, {
  id, name, status ('pending'|'converting'|'done'|'error'),
  error, originalMarkdown, editedMarkdown, dirty
}>
activeFileId: string | null
```

## Layout

Persistent sidebar on left with file list + upload button. Editor/preview split-pane on right. Toolbar between header and editor.

## Features

1. **Batch Upload**: `<input multiple>` + multi-file drag-drop. Sequential conversion queue.
2. **Sidebar**: File list with status indicators (pending, converting, done, error, dirty). Click to switch.
3. **File Switching + Dirty State**: Confirm dialog on switch if dirty (Save/Discard/Cancel).
4. **Conversion Cache**: Results stored in memory Map. No re-conversion.
5. **ZIP Export**: Client-side JSZip. All .md files bundled, filenames match PDFs.
6. **Extras**: Keyboard shortcuts (Ctrl+S save, Ctrl+E export), delete from sidebar, progress indication, file sizes.

## Backend

- Keep single `/api/convert` endpoint unchanged.
- Frontend manages batch queue by calling endpoint sequentially.

## Image Handling

Library limitation: `opendataloader_pdf` embeds images as base64 data URIs which render in HTML but not all markdown editors. Not fixable without upstream library changes. ZIP export will include raw markdown with embedded base64 as-is.
