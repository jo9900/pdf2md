// === STATE ===
const fileStore = new Map();
let activeFileId = null;
let pendingSwitch = null;

// === DOM REFS ===
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const exportZipBtn = document.getElementById('export-zip-btn');
const emptyState = document.getElementById('empty-state');
const dropZone = document.getElementById('drop-zone');
const editorSection = document.getElementById('editor-section');
const filenameEl = document.getElementById('filename');
const downloadBtn = document.getElementById('download-btn');
const deleteBtn = document.getElementById('delete-btn');
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmSaveBtn = document.getElementById('confirm-save');
const confirmDiscardBtn = document.getElementById('confirm-discard');
const confirmCancelBtn = document.getElementById('confirm-cancel');

// === HELPERS ===
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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
  processQueue();
}

// === FILE SELECTION ===
function selectFile(id) {
  const current = fileStore.get(activeFileId);

  if (current && current.dirty && activeFileId !== id) {
    pendingSwitch = { targetId: id };
    showConfirmDialog();
    return;
  }

  activateFile(id);
}

function activateFile(id, { skipSync = false } = {}) {
  const entry = fileStore.get(id);
  if (!entry || entry.status !== 'done') return;

  if (!skipSync && activeFileId && fileStore.has(activeFileId)) {
    syncEditorToStore();
  }

  activeFileId = id;
  showEditorView(entry);
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

confirmSaveBtn.addEventListener('click', () => {
  const current = fileStore.get(activeFileId);
  if (current) {
    current.editedMarkdown = editor.value;
    current.dirty = false;
  }
  const target = pendingSwitch?.targetId;
  hideConfirmDialog();
  if (target) activateFile(target, { skipSync: true });
});

confirmDiscardBtn.addEventListener('click', () => {
  const current = fileStore.get(activeFileId);
  if (current) {
    current.editedMarkdown = current.originalMarkdown;
    current.dirty = false;
  }
  const target = pendingSwitch?.targetId;
  hideConfirmDialog();
  if (target) activateFile(target, { skipSync: true });
});

confirmCancelBtn.addEventListener('click', () => {
  hideConfirmDialog();
});

// === RENDERING ===
function renderFileList() {
  fileList.innerHTML = '';
  for (const [id, entry] of fileStore) {
    const li = document.createElement('li');
    if (id === activeFileId) li.classList.add('active');

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

    const nameEl = document.createElement('span');
    nameEl.className = 'file-name';
    nameEl.textContent = entry.name;
    if (entry.status === 'error') {
      nameEl.title = entry.error;
    }

    const sizeEl = document.createElement('span');
    sizeEl.className = 'file-size';
    sizeEl.textContent = formatFileSize(entry.size);

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

function showEditorView(entry) {
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
  const pdfFiles = [...files].filter(
    f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  );
  if (pdfFiles.length === 0) return;
  pdfFiles.forEach(f => addFile(f));
}

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

// Drag & drop on entire document
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

// Also allow clicking drop zone
dropZone.addEventListener('click', () => fileInput.click());

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
  const usedNames = new Set();
  for (const entry of fileStore.values()) {
    if (entry.status === 'done') {
      let mdName = entry.name.replace(/\.pdf$/i, '.md');
      let counter = 1;
      const baseName = mdName;
      while (usedNames.has(mdName)) {
        mdName = baseName.replace(/\.md$/, ` (${counter++}).md`);
      }
      usedNames.add(mdName);
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
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const current = fileStore.get(activeFileId);
    if (current) {
      current.editedMarkdown = editor.value;
      current.dirty = false;
      renderFileList();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    if (!exportZipBtn.disabled) exportZipBtn.click();
  }
});
