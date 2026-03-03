# Multi-PDF Batch Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform single-PDF converter into multi-file batch app with sidebar file management, dirty state tracking, confirm-on-switch, and ZIP export.

**Architecture:** Vanilla JS single-page app. Frontend manages a `Map<id, FileEntry>` store with status/cache/dirty tracking. Sidebar shows file list with status icons. Sequential conversion queue calls existing `/api/convert` endpoint one at a time. JSZip (CDN) for client-side ZIP export.

**Tech Stack:** Express + multer + opendataloader_pdf (backend, mostly unchanged), vanilla JS + marked.js + JSZip (frontend), CSS (no framework)

---

### Task 1: Rewrite HTML layout (sidebar + main area)

**Files:**
- Modify: `public/index.html:1-158` (full rewrite of body structure, keep inline script for now)

**Step 1: Replace the HTML body with new 3-column layout**

Replace the entire `<body>` content of `public/index.html` with:

```html
<body>
  <div id="app">
    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div class="sidebar-header">
        <h1>PDF → MD</h1>
        <button id="upload-btn" class="btn btn-primary btn-sm">+ Upload</button>
        <input type="file" id="file-input" accept=".pdf" multiple hidden />
      </div>
      <ul id="file-list"></ul>
      <div class="sidebar-footer">
        <button id="export-zip-btn" class="btn btn-accent btn-block" disabled>Export ZIP</button>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main id="main-content">
      <!-- Empty state (shown when no file selected) -->
      <div id="empty-state">
        <div id="drop-zone">
          <div class="drop-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 12 15 15"/>
            </svg>
          </div>
          <p class="drop-text">Drag & drop PDFs here</p>
          <p class="drop-hint">or click "Upload" in the sidebar</p>
        </div>
      </div>

      <!-- Editor state (shown when a file is selected) -->
      <div id="editor-section" class="hidden">
        <div class="toolbar">
          <span id="filename" class="filename"></span>
          <div class="toolbar-actions">
            <button id="download-btn" class="btn btn-primary btn-sm">Download .md</button>
            <button id="delete-btn" class="btn btn-danger btn-sm">Delete</button>
          </div>
        </div>
        <div id="split-pane">
          <div id="editor-pane">
            <div class="pane-header">Markdown</div>
            <textarea id="editor" spellcheck="false"></textarea>
          </div>
          <div class="divider"></div>
          <div id="preview-pane">
            <div class="pane-header">Preview</div>
            <div id="preview"></div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Confirm dialog (hidden by default) -->
  <div id="confirm-dialog" class="modal hidden">
    <div class="modal-content">
      <p id="confirm-message">You have unsaved changes. What would you like to do?</p>
      <div class="modal-actions">
        <button id="confirm-save" class="btn btn-primary">Save</button>
        <button id="confirm-discard" class="btn btn-secondary">Discard</button>
        <button id="confirm-cancel" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <script src="/app.js"></script>
</body>
```

Key changes:
- Layout: `#app` is a flex row with `#sidebar` (fixed 240px) + `#main-content` (flex 1)
- Sidebar: header with upload button, file list `<ul>`, footer with ZIP export button
- `<input multiple>` for batch file selection
- Main: empty state (drop zone) or editor section
- Modal dialog for dirty state confirmation
- Scripts moved to end of body: marked.js, JSZip (new CDN), app.js (external file)
- Remove the existing inline `<script>` block (lines 63-156) entirely

**Step 2: Verify HTML is well-formed**

Open in browser, confirm no console errors, page loads with sidebar + empty state visible.

**Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: rewrite HTML layout with sidebar and modal dialog"
```

---

### Task 2: Rewrite CSS for sidebar layout

**Files:**
- Modify: `public/style.css:1-105` (full rewrite)

**Step 1: Replace all CSS with new layout styles**

Replace the entire `public/style.css` with styles for:

```css
/* === Reset & Base === */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
  height: 100vh;
  overflow: hidden;
}

.hidden { display: none !important; }

/* === App Layout === */
#app {
  display: flex;
  height: 100vh;
}

/* === Sidebar === */
#sidebar {
  width: 260px;
  min-width: 260px;
  background: #16213e;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
}

.sidebar-header {
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #333;
}

.sidebar-header h1 {
  font-size: 1rem;
  color: #fff;
  white-space: nowrap;
}

#file-list {
  list-style: none;
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

#file-list li {
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

#file-list li:hover {
  background: rgba(108, 99, 255, 0.1);
}

#file-list li.active {
  background: rgba(108, 99, 255, 0.15);
  border-left-color: #6c63ff;
}

#file-list li .file-status {
  flex-shrink: 0;
  width: 18px;
  text-align: center;
  font-size: 0.75rem;
}

#file-list li .file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#file-list li .file-size {
  color: #666;
  font-size: 0.75rem;
  flex-shrink: 0;
}

#file-list li .file-delete {
  opacity: 0;
  background: none;
  border: none;
  color: #ff6b6b;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0 0.25rem;
  transition: opacity 0.15s;
}

#file-list li:hover .file-delete {
  opacity: 1;
}

/* Status colors */
.status-pending { color: #666; }
.status-converting { color: #f0c040; }
.status-done { color: #4caf50; }
.status-error { color: #ff6b6b; }
.status-dirty::after {
  content: '•';
  color: #f0c040;
  margin-left: 2px;
}

/* Spinner for converting status */
.status-converting .spinner-icon {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #333;
  border-top-color: #f0c040;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.sidebar-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid #333;
}

/* === Buttons === */
.btn {
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: opacity 0.2s;
}
.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm { padding: 0.3rem 0.75rem; font-size: 0.8rem; }
.btn-primary { background: #6c63ff; color: #fff; }
.btn-secondary { background: #333; color: #ccc; }
.btn-accent { background: #4caf50; color: #fff; }
.btn-danger { background: #ff6b6b; color: #fff; }
.btn-block { width: 100%; }

/* === Main Content === */
#main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Empty State */
#empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

#drop-zone {
  border: 2px dashed #444;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  max-width: 500px;
}
#drop-zone:hover, #drop-zone.dragover {
  border-color: #6c63ff;
  background: rgba(108, 99, 255, 0.05);
}
.drop-icon { color: #6c63ff; margin-bottom: 1rem; }
.drop-text { font-size: 1.1rem; margin-bottom: 0.3rem; }
.drop-hint { color: #666; font-size: 0.9rem; }

/* === Editor Section === */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #16213e;
  border-bottom: 1px solid #333;
}
.filename { color: #aaa; font-size: 0.9rem; }
.toolbar-actions { display: flex; gap: 0.5rem; }

#split-pane {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#editor-pane, #preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pane-header {
  padding: 0.4rem 0.8rem;
  background: #0f3460;
  font-size: 0.8rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.divider { width: 1px; background: #333; }

#editor {
  flex: 1;
  width: 100%;
  background: #1a1a2e;
  color: #e0e0e0;
  border: none;
  outline: none;
  padding: 1rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  tab-size: 2;
}

#preview {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  background: #1a1a2e;
  font-size: 14px;
  line-height: 1.7;
}

/* Preview typography */
#preview h1 { font-size: 1.5rem; margin: 1rem 0 0.5rem; color: #fff; }
#preview h2 { font-size: 1.3rem; margin: 0.8rem 0 0.4rem; color: #ddd; }
#preview h3 { font-size: 1.1rem; margin: 0.6rem 0 0.3rem; color: #ccc; }
#preview p { margin: 0.5rem 0; }
#preview ul, #preview ol { margin: 0.5rem 0; padding-left: 1.5rem; }
#preview code { background: #0d1b2a; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
#preview pre { background: #0d1b2a; padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 0.5rem 0; }
#preview pre code { padding: 0; background: none; }
#preview blockquote { border-left: 3px solid #6c63ff; padding-left: 1rem; color: #aaa; margin: 0.5rem 0; }
#preview a { color: #6c63ff; }
#preview img { max-width: 100%; border-radius: 4px; margin: 0.5rem 0; }
#preview table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
#preview th, #preview td { border: 1px solid #444; padding: 0.4rem 0.8rem; text-align: left; }
#preview th { background: #0f3460; color: #fff; font-weight: 600; }
#preview tr:nth-child(even) { background: rgba(255,255,255,0.03); }

/* === Modal === */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: #16213e;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
}

.modal-content p {
  margin-bottom: 1rem;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
```

**Step 2: Verify layout renders correctly in browser**

**Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat: rewrite CSS for sidebar layout with modal and status styles"
```

---

### Task 3: Write the app.js file store and core logic

**Files:**
- Create: `public/app.js` (new external JS file replacing inline script)

**Step 1: Write the complete app.js**

Write `public/app.js` with all application logic. This is the main file. Structure:

```javascript
// === STATE ===
const fileStore = new Map();
let activeFileId = null;
let pendingSwitch = null; // { targetId } for confirm dialog

// === DOM REFS ===
// (all getElementById calls for sidebar, editor, modal, etc.)

// === HELPERS ===
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// === FILE STORE OPERATIONS ===
function addFile(pdfFile) {
  const id = generateId();
  fileStore.set(id, {
    id,
    name: pdfFile.name,
    size: pdfFile.size,
    file: pdfFile,
    status: 'pending',
    error: null,
    originalMarkdown: '',
    editedMarkdown: '',
    dirty: false,
  });
  renderFileList();
  processQueue();
  return id;
}

function removeFile(id) {
  if (activeFileId === id) {
    activeFileId = null;
    showEmptyState();
  }
  fileStore.delete(id);
  renderFileList();
  updateExportButton();
}

// === CONVERSION QUEUE ===
let isConverting = false;

async function processQueue() {
  if (isConverting) return;

  const pending = [...fileStore.values()].find(f => f.status === 'pending');
  if (!pending) return;

  isConverting = true;
  pending.status = 'converting';
  renderFileList();

  const formData = new FormData();
  formData.append('pdf', pending.file);

  try {
    const res = await fetch('/api/convert', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversion failed');

    pending.status = 'done';
    pending.originalMarkdown = data.markdown;
    pending.editedMarkdown = data.markdown;
    pending.dirty = false;

    // Auto-select first completed file if nothing is active
    if (!activeFileId) {
      selectFile(pending.id);
    }
  } catch (err) {
    pending.status = 'error';
    pending.error = err.message;
  }

  isConverting = false;
  renderFileList();
  updateExportButton();
  processQueue(); // process next in queue
}

// === FILE SELECTION ===
function selectFile(id) {
  const current = fileStore.get(activeFileId);

  // Check dirty state before switching
  if (current && current.dirty && activeFileId !== id) {
    pendingSwitch = { targetId: id };
    showConfirmDialog();
    return;
  }

  activateFile(id);
}

function activateFile(id) {
  const entry = fileStore.get(id);
  if (!entry || entry.status !== 'done') return;

  // Save current editor content before switching
  if (activeFileId && fileStore.has(activeFileId)) {
    syncEditorToStore();
  }

  activeFileId = id;
  showEditor(entry);
  renderFileList();
}

function syncEditorToStore() {
  const current = fileStore.get(activeFileId);
  if (current && current.status === 'done') {
    current.editedMarkdown = editor.value;
  }
}

// === DIRTY STATE ===
function checkDirty() {
  const current = fileStore.get(activeFileId);
  if (!current) return;
  const wasDirty = current.dirty;
  current.dirty = current.editedMarkdown !== editor.value;
  if (wasDirty !== current.dirty) {
    renderFileList();
  }
}

// === CONFIRM DIALOG ===
function showConfirmDialog() {
  confirmDialog.classList.remove('hidden');
}

function hideConfirmDialog() {
  confirmDialog.classList.add('hidden');
  pendingSwitch = null;
}

// confirm-save: save current edits, then switch
confirmSaveBtn.addEventListener('click', () => {
  const current = fileStore.get(activeFileId);
  if (current) {
    current.editedMarkdown = editor.value;
    current.dirty = false;
  }
  hideConfirmDialog();
  if (pendingSwitch) activateFile(pendingSwitch.targetId);
});

// confirm-discard: revert current edits, then switch
confirmDiscardBtn.addEventListener('click', () => {
  const current = fileStore.get(activeFileId);
  if (current) {
    current.editedMarkdown = current.editedMarkdown; // keep last saved
    current.dirty = false;
  }
  hideConfirmDialog();
  if (pendingSwitch) activateFile(pendingSwitch.targetId);
});

// confirm-cancel: stay on current file
confirmCancelBtn.addEventListener('click', () => {
  hideConfirmDialog();
});

// === RENDERING ===
function renderFileList() {
  fileList.innerHTML = '';
  for (const [id, entry] of fileStore) {
    const li = document.createElement('li');
    if (id === activeFileId) li.classList.add('active');

    // Status icon
    const statusEl = document.createElement('span');
    statusEl.className = 'file-status';
    if (entry.status === 'pending') {
      statusEl.classList.add('status-pending');
      statusEl.textContent = '○';
    } else if (entry.status === 'converting') {
      statusEl.classList.add('status-converting');
      statusEl.innerHTML = '<span class="spinner-icon"></span>';
    } else if (entry.status === 'done') {
      statusEl.classList.add('status-done');
      statusEl.textContent = '●';
      if (entry.dirty) statusEl.classList.add('status-dirty');
    } else if (entry.status === 'error') {
      statusEl.classList.add('status-error');
      statusEl.textContent = '✕';
    }

    // File name
    const nameEl = document.createElement('span');
    nameEl.className = 'file-name';
    nameEl.textContent = entry.name;
    if (entry.status === 'error') {
      nameEl.title = entry.error;
    }

    // File size
    const sizeEl = document.createElement('span');
    sizeEl.className = 'file-size';
    sizeEl.textContent = formatFileSize(entry.size);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'file-delete';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFile(id);
    });

    li.appendChild(statusEl);
    li.appendChild(nameEl);
    li.appendChild(sizeEl);
    li.appendChild(delBtn);

    // Click to select (or retry on error)
    li.addEventListener('click', () => {
      if (entry.status === 'error') {
        entry.status = 'pending';
        entry.error = null;
        renderFileList();
        processQueue();
      } else if (entry.status === 'done') {
        selectFile(id);
      }
    });

    fileList.appendChild(li);
  }
}

function showEmptyState() {
  editorSection.classList.add('hidden');
  emptyState.classList.remove('hidden');
}

function showEditor(entry) {
  emptyState.classList.add('hidden');
  editorSection.classList.remove('hidden');
  filenameEl.textContent = entry.name.replace(/\.pdf$/i, '.md');
  editor.value = entry.editedMarkdown;
  renderPreview();
}

function renderPreview() {
  preview.innerHTML = marked.parse(editor.value);
}

function updateExportButton() {
  const hasDone = [...fileStore.values()].some(f => f.status === 'done');
  exportZipBtn.disabled = !hasDone;
}

// === FILE UPLOAD ===
function handleFiles(files) {
  const pdfFiles = [...files].filter(f => f.type === 'application/pdf');
  if (pdfFiles.length === 0) return;
  pdfFiles.forEach(f => addFile(f));

  // Hide empty state once files are added
  if (fileStore.size > 0) {
    emptyState.classList.add('hidden');
  }
}

// Upload button
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

// Drag & drop on drop zone AND on the whole app
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone?.classList.add('dragover');
});
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
    dropZone?.classList.remove('dragover');
  }
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone?.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

// === DOWNLOAD SINGLE .md ===
downloadBtn.addEventListener('click', () => {
  const entry = fileStore.get(activeFileId);
  if (!entry) return;
  syncEditorToStore();
  const filename = entry.name.replace(/\.pdf$/i, '.md');
  const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
});

// === DELETE FILE ===
deleteBtn.addEventListener('click', () => {
  if (activeFileId) removeFile(activeFileId);
});

// === ZIP EXPORT ===
exportZipBtn.addEventListener('click', async () => {
  syncEditorToStore();
  const zip = new JSZip();
  for (const entry of fileStore.values()) {
    if (entry.status === 'done') {
      const mdName = entry.name.replace(/\.pdf$/i, '.md');
      zip.file(mdName, entry.editedMarkdown);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'markdown-export.zip';
  a.click();
  URL.revokeObjectURL(a.href);
});

// === EDITOR EVENTS ===
editor.addEventListener('input', () => {
  renderPreview();
  checkDirty();
});

// === KEYBOARD SHORTCUTS ===
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S: save current edits to store
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const current = fileStore.get(activeFileId);
    if (current) {
      current.editedMarkdown = editor.value;
      current.dirty = false;
      renderFileList();
    }
  }
  // Ctrl/Cmd + E: export ZIP
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    exportZipBtn.click();
  }
});
```

Note: The DOM ref variables (`editor`, `preview`, `fileList`, `confirmDialog`, etc.) should all be declared at the top of the file using `document.getElementById(...)`.

**Step 2: Verify in browser**

- Upload multiple PDFs → they appear in sidebar
- Files convert one by one with spinner
- Click file → editor shows markdown
- Edit → dirty indicator appears
- Switch file → confirm dialog appears
- Download .md works
- Export ZIP works

**Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: implement multi-file state management and batch conversion"
```

---

### Task 4: Integration testing and polish

**Files:**
- Modify: `public/app.js` (bug fixes found during testing)
- Modify: `public/style.css` (visual tweaks)
- Modify: `public/index.html` (any structural fixes)
- Modify: `server.js` (no changes expected, but listed for completeness)

**Step 1: Manual test all flows**

Test matrix:
1. Upload 1 PDF → converts → shows in editor ✓
2. Upload 3 PDFs → all queue and convert sequentially ✓
3. Click between files → content switches ✓
4. Edit file A → switch to B → confirm dialog appears ✓
5. Confirm Save → A's edits are kept, switch to B ✓
6. Confirm Discard → A's edits are reverted, switch to B ✓
7. Confirm Cancel → stay on A ✓
8. Download .md → file has correct content and name ✓
9. Export ZIP → .zip contains all converted files with correct names ✓
10. Delete file from sidebar ✓
11. Error file → click to retry ✓
12. Ctrl+S → saves, dirty indicator clears ✓
13. Ctrl+E → exports ZIP ✓
14. Drag & drop multiple PDFs onto page ✓

**Step 2: Fix any bugs found**

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete multi-PDF batch workflow with sidebar and ZIP export"
```

---

### Task 5: Clean up old files

**Files:**
- Delete: `public/app.js` (the old CodeMirror-based one was already replaced by new app.js)
- Verify: No stale references remain

**Step 1: Verify no other files reference the old app.js CodeMirror imports**

The old `public/app.js` used ES module imports (`import { EditorView } from "codemirror"`). The new one is a plain script. Verify `index.html` references `<script src="/app.js">` (not a module).

**Step 2: Commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: remove stale code and clean up"
```
