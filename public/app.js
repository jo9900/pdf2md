// === STATE ===
const fileStore = new Map();
let activeFileId = null;
let pendingSwitch = null;
let templateInfo = null; // { filename, styles } or null

// === DOM REFS ===
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const exportZipBtn = document.getElementById('export-zip-btn');
const exportPdfZipBtn = document.getElementById('export-pdf-zip-btn');
const emptyState = document.getElementById('empty-state');
const dropZone = document.getElementById('drop-zone');
const editorSection = document.getElementById('editor-section');
const filenameEl = document.getElementById('filename');
const downloadBtn = document.getElementById('download-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const deleteBtn = document.getElementById('delete-btn');
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmSaveBtn = document.getElementById('confirm-save');
const confirmDiscardBtn = document.getElementById('confirm-discard');
const confirmCancelBtn = document.getElementById('confirm-cancel');

// Template DOM refs
const templateEmpty = document.getElementById('template-empty');
const templateInfoEl = document.getElementById('template-info');
const templateNameEl = document.getElementById('template-name');
const templateUploadBtn = document.getElementById('template-upload-btn');
const templateInput = document.getElementById('template-input');
const templateReplaceBtn = document.getElementById('template-replace-btn');
const templateDeleteBtn = document.getElementById('template-delete-btn');
const templateDropArea = document.getElementById('template-drop-area');

// PDF Preview DOM refs
const pdfPreviewModal = document.getElementById('pdf-preview-modal');
const pdfPreviewTitle = document.getElementById('pdf-preview-title');
const pdfPreviewFrame = document.getElementById('pdf-preview-frame');
const pdfPreviewClose = document.getElementById('pdf-preview-close');
const pdfDownloadBtn = document.getElementById('pdf-download-btn');
const pdfCloseBtn = document.getElementById('pdf-close-btn');

// Loading overlay refs
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

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
  updateExportButtons();
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
  updateExportButtons();
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
      statusEl.textContent = '\u25CB';
    } else if (entry.status === 'converting') {
      statusEl.classList.add('status-converting');
      statusEl.innerHTML = '<span class="spinner-icon"></span>';
    } else if (entry.status === 'done') {
      statusEl.classList.add('status-done');
      statusEl.textContent = '\u25CF';
      if (entry.dirty) statusEl.classList.add('status-dirty');
    } else if (entry.status === 'error') {
      statusEl.classList.add('status-error');
      statusEl.textContent = '\u2715';
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
    delBtn.textContent = '\u00D7';
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

function updateExportButtons() {
  const hasDone = [...fileStore.values()].some(f => f.status === 'done');
  exportZipBtn.disabled = !hasDone;
  exportPdfZipBtn.disabled = !hasDone;
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

// === ZIP EXPORT (Markdown) ===
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

// ============================================================
// === TEMPLATE MANAGEMENT ===
// ============================================================

function renderTemplateSection() {
  if (templateInfo) {
    templateEmpty.classList.add('hidden');
    templateInfoEl.classList.remove('hidden');
    templateNameEl.textContent = templateInfo.filename;
  } else {
    templateEmpty.classList.remove('hidden');
    templateInfoEl.classList.add('hidden');
  }
}

async function uploadTemplate(file) {
  const formData = new FormData();
  formData.append('template', file);

  showLoading('Processing template...');
  try {
    const res = await fetch('/api/template', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Template upload failed');
    templateInfo = { filename: data.filename, styles: data.styles };
    renderTemplateSection();
  } catch (err) {
    alert('Template upload failed: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function deleteTemplate() {
  try {
    await fetch('/api/template', { method: 'DELETE' });
  } catch {}
  templateInfo = null;
  renderTemplateSection();
}

// Template upload button
templateUploadBtn.addEventListener('click', () => templateInput.click());
templateReplaceBtn.addEventListener('click', () => templateInput.click());
templateInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) uploadTemplate(file);
  templateInput.value = '';
});

// Template delete
templateDeleteBtn.addEventListener('click', deleteTemplate);

// Template drag & drop
templateDropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  templateDropArea.classList.add('dragover');
});

templateDropArea.addEventListener('dragleave', (e) => {
  e.stopPropagation();
  templateDropArea.classList.remove('dragover');
});

templateDropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  templateDropArea.classList.remove('dragover');
  const files = [...e.dataTransfer.files].filter(
    f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  );
  if (files.length > 0) uploadTemplate(files[0]);
});

templateDropArea.addEventListener('click', () => templateInput.click());

// Load template state on page load
async function loadTemplateState() {
  try {
    const res = await fetch('/api/template');
    const data = await res.json();
    if (data.template) {
      templateInfo = { filename: data.template.filename, styles: data.template.styles };
    }
  } catch {}
  renderTemplateSection();
}
loadTemplateState();

// ============================================================
// === PDF GENERATION & PREVIEW ===
// ============================================================

async function generatePdf(markdown) {
  const res = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  });
  if (!res.ok) {
    let msg = 'PDF generation failed';
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return await res.blob();
}

// PDF Preview state
let currentPdfBlob = null;
let currentPdfFilename = null;

function showPdfPreview(blob, filename) {
  currentPdfBlob = blob;
  currentPdfFilename = filename;
  const url = URL.createObjectURL(blob);
  pdfPreviewFrame.src = url;
  pdfPreviewTitle.textContent = 'PDF Preview - ' + filename;
  pdfPreviewModal.classList.remove('hidden');
}

function closePdfPreview() {
  if (pdfPreviewFrame.src) {
    URL.revokeObjectURL(pdfPreviewFrame.src);
  }
  pdfPreviewFrame.src = '';
  pdfPreviewModal.classList.add('hidden');
  currentPdfBlob = null;
  currentPdfFilename = null;
}

function downloadCurrentPdf() {
  if (!currentPdfBlob || !currentPdfFilename) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(currentPdfBlob);
  a.download = currentPdfFilename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// PDF Preview modal events
pdfPreviewClose.addEventListener('click', closePdfPreview);
pdfCloseBtn.addEventListener('click', closePdfPreview);
pdfDownloadBtn.addEventListener('click', downloadCurrentPdf);

pdfPreviewModal.addEventListener('click', (e) => {
  if (e.target === pdfPreviewModal) closePdfPreview();
});

// Single PDF export
exportPdfBtn.addEventListener('click', async () => {
  const entry = fileStore.get(activeFileId);
  if (!entry || entry.status !== 'done') return;
  syncEditorToStore();

  showLoading('Generating PDF...');
  try {
    const blob = await generatePdf(entry.editedMarkdown);
    hideLoading();
    const filename = entry.name.replace(/\.pdf$/i, '') + '-styled.pdf';
    showPdfPreview(blob, filename);
  } catch (err) {
    hideLoading();
    alert('PDF generation failed: ' + err.message);
  }
});

// Batch PDF ZIP export
exportPdfZipBtn.addEventListener('click', async () => {
  syncEditorToStore();
  const entries = [...fileStore.values()].filter(f => f.status === 'done');
  if (entries.length === 0) return;

  const zip = new JSZip();
  const usedNames = new Set();
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    showLoading(`Generating PDF ${i + 1} of ${entries.length}...`);
    try {
      const blob = await generatePdf(entries[i].editedMarkdown);
      let pdfName = entries[i].name.replace(/\.pdf$/i, '') + '.pdf';
      let counter = 1;
      const baseName = pdfName;
      while (usedNames.has(pdfName)) {
        pdfName = baseName.replace(/\.pdf$/, ` (${counter++}).pdf`);
      }
      usedNames.add(pdfName);
      zip.file(pdfName, blob);
    } catch (err) {
      console.error(`Failed to generate PDF for ${entries[i].name}:`, err);
      failed++;
    }
  }

  hideLoading();

  if (failed > 0 && failed < entries.length) {
    alert(`${failed} of ${entries.length} PDFs failed to generate. Downloading the rest.`);
  } else if (failed === entries.length) {
    alert('All PDF generations failed.');
    return;
  }

  showLoading('Creating ZIP...');
  try {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    hideLoading();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = 'pdf-export.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    hideLoading();
    alert('ZIP creation failed: ' + err.message);
  }
});

// ============================================================
// === LOADING OVERLAY ===
// ============================================================

function showLoading(text) {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// ============================================================
// === KEYBOARD SHORTCUTS ===
// ============================================================

document.addEventListener('keydown', (e) => {
  // Cmd/Ctrl+S: Save current edits
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const current = fileStore.get(activeFileId);
    if (current) {
      current.editedMarkdown = editor.value;
      current.dirty = false;
      renderFileList();
    }
  }
  // Cmd/Ctrl+E: Export MD ZIP
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'e') {
    e.preventDefault();
    if (!exportZipBtn.disabled) exportZipBtn.click();
  }
  // Cmd/Ctrl+Shift+E: Export PDF (single or batch)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    if (activeFileId) {
      exportPdfBtn.click();
    } else if (!exportPdfZipBtn.disabled) {
      exportPdfZipBtn.click();
    }
  }
  // Escape: Close modals
  if (e.key === 'Escape') {
    if (!pdfPreviewModal.classList.contains('hidden')) {
      closePdfPreview();
    }
  }
});
