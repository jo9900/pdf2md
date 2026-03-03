import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";

// DOM elements
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadSection = document.getElementById("upload-section");
const uploadStatus = document.getElementById("upload-status");
const statusText = document.getElementById("status-text");
const uploadError = document.getElementById("upload-error");
const errorText = document.getElementById("error-text");
const retryBtn = document.getElementById("retry-btn");
const editorSection = document.getElementById("editor-section");
const editorContainer = document.getElementById("editor");
const previewContainer = document.getElementById("preview");
const filenameEl = document.getElementById("filename");
const downloadBtn = document.getElementById("download-btn");
const newBtn = document.getElementById("new-btn");

let editorView = null;
let currentFilename = "";

// Initialize CodeMirror editor
function initEditor(content) {
  if (editorView) {
    editorView.destroy();
  }

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      renderPreview(update.state.doc.toString());
    }
  });

  editorView = new EditorView({
    state: EditorState.create({
      doc: content,
      extensions: [basicSetup, markdown(), oneDark, updateListener],
    }),
    parent: editorContainer,
  });

  renderPreview(content);
}

// Render markdown preview using marked
function renderPreview(md) {
  previewContainer.innerHTML = window.marked.parse(md);
}

// Show upload screen, hide editor
function showUpload() {
  editorSection.classList.add("hidden");
  uploadSection.classList.remove("hidden");
  uploadStatus.classList.add("hidden");
  uploadError.classList.add("hidden");
  dropZone.classList.remove("hidden");
}

// Show editor screen with markdown content
function showEditor(md, filename) {
  currentFilename = filename.replace(/\.pdf$/i, ".md");
  filenameEl.textContent = currentFilename;
  uploadSection.classList.add("hidden");
  editorSection.classList.remove("hidden");
  initEditor(md);
}

// Upload and convert PDF
async function uploadPdf(file) {
  dropZone.classList.add("hidden");
  uploadError.classList.add("hidden");
  uploadStatus.classList.remove("hidden");
  statusText.textContent = `Converting ${file.name}...`;

  const formData = new FormData();
  formData.append("pdf", file);

  try {
    const res = await fetch("/api/convert", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Conversion failed");
    }

    showEditor(data.markdown, data.filename);
  } catch (err) {
    uploadStatus.classList.add("hidden");
    uploadError.classList.remove("hidden");
    errorText.textContent = err.message;
  }
}

// Download current markdown content
function downloadMarkdown() {
  if (!editorView) return;

  const content = editorView.state.doc.toString();
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = currentFilename;
  a.click();
  URL.revokeObjectURL(url);
}

// Drag & drop handlers
dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) uploadPdf(file);
  fileInput.value = "";
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.type === "application/pdf") {
    uploadPdf(file);
  } else {
    uploadError.classList.remove("hidden");
    errorText.textContent = "Please drop a PDF file.";
    dropZone.classList.add("hidden");
  }
});

// Button handlers
downloadBtn.addEventListener("click", downloadMarkdown);
newBtn.addEventListener("click", showUpload);
retryBtn.addEventListener("click", showUpload);
