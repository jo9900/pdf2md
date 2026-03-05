const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { marked } = require("marked");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "output");

for (const dir of [uploadDir, outputDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "50mb" }));

// === Template State (session-level, in-memory) ===
let currentTemplate = null; // { filename, path, styles }

// === Puppeteer Browser Singleton ===
let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    const puppeteer = require("puppeteer");
    browserPromise = puppeteer
      .launch({ headless: "new", args: ["--no-sandbox"] })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

// === Style Extraction ===
const DEFAULT_STYLES = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
  bodyFontSize: 12,
  bodyFontFamily: "'Times New Roman', Times, serif",
  headingSizes: { h1: 24, h2: 20, h3: 16, h4: 14 },
  lineHeight: 1.5,
  bodyColor: "#333333",
  headingColor: "#111111",
};

function mapPdfFont(pdfFontName) {
  if (!pdfFontName) return DEFAULT_STYLES.bodyFontFamily;
  const name = pdfFontName.replace(/^[A-Z]{6}\+/, "").toLowerCase();
  if (name.includes("arial") || name.includes("helvetica"))
    return "'Helvetica Neue', Helvetica, Arial, sans-serif";
  if (name.includes("times"))
    return "'Times New Roman', Times, serif";
  if (name.includes("courier") || name.includes("consol"))
    return "'Courier New', Courier, monospace";
  if (name.includes("georgia"))
    return "Georgia, 'Times New Roman', serif";
  if (name.includes("garamond"))
    return "Garamond, Georgia, serif";
  if (name.includes("calibri") || name.includes("segoe"))
    return "Calibri, 'Segoe UI', sans-serif";
  if (name.includes("cambria"))
    return "Cambria, Georgia, serif";
  if (name.includes("verdana"))
    return "Verdana, Geneva, sans-serif";
  if (name.includes("sans"))
    return "'Helvetica Neue', Helvetica, Arial, sans-serif";
  return DEFAULT_STYLES.bodyFontFamily;
}

async function extractTemplateStyles(buffer) {
  const styles = {
    ...DEFAULT_STYLES,
    margins: { ...DEFAULT_STYLES.margins },
    headingSizes: { ...DEFAULT_STYLES.headingSizes },
  };
  const fontData = [];

  try {
    const { getDocument } = require("pdfjs-dist/legacy/build/pdf.mjs");
    const cmapUrl = path.join(__dirname, "node_modules/pdfjs-dist/cmaps/");
    const standardFontDataUrl = path.join(
      __dirname,
      "node_modules/pdfjs-dist/standard_fonts/"
    );
    const doc = await getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: cmapUrl,
      cMapPacked: true,
      standardFontDataUrl,
      useSystemFonts: true,
    }).promise;

    const maxPages = Math.min(doc.numPages, 5);
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      if (i === 1) {
        const viewport = page.getViewport({ scale: 1 });
        styles.pageWidth = viewport.width;
        styles.pageHeight = viewport.height;
      }
      const textContent = await page.getTextContent();
      for (const item of textContent.items) {
        if (item.str && item.str.trim()) {
          fontData.push({
            size: Math.round(Math.abs(item.transform[3]) * 10) / 10,
            fontName: item.fontName,
            x: item.transform[4],
            y: item.transform[5],
            len: item.str.length,
          });
        }
      }
    }
    doc.destroy();
  } catch (err) {
    console.error("Style extraction warning:", err.message);
    return styles;
  }

  if (fontData.length === 0) return styles;

  // Body font size = most common by character count
  const sizeFreq = {};
  for (const d of fontData) {
    sizeFreq[d.size] = (sizeFreq[d.size] || 0) + d.len;
  }
  const sorted = Object.entries(sizeFreq)
    .map(([s, c]) => ({ size: parseFloat(s), count: c }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length > 0) {
    styles.bodyFontSize = sorted[0].size;
    const headingSizes = sorted
      .filter((s) => s.size > styles.bodyFontSize)
      .sort((a, b) => b.size - a.size);
    if (headingSizes.length >= 1) styles.headingSizes.h1 = headingSizes[0].size;
    if (headingSizes.length >= 2) styles.headingSizes.h2 = headingSizes[1].size;
    if (headingSizes.length >= 3) styles.headingSizes.h3 = headingSizes[2].size;
    if (headingSizes.length >= 4) styles.headingSizes.h4 = headingSizes[3].size;
  }

  // Estimate margins from text positions
  const xPositions = fontData.map((d) => d.x).filter((x) => x > 0);
  if (xPositions.length > 0) {
    styles.margins.left = Math.max(36, Math.round(Math.min(...xPositions)));
    styles.margins.right = styles.margins.left;
  }
  const yPositions = fontData.map((d) => d.y).filter((y) => y > 0);
  if (yPositions.length > 0) {
    const maxY = Math.max(...yPositions);
    const minY = Math.min(...yPositions);
    styles.margins.top = Math.max(
      36,
      Math.round(styles.pageHeight - maxY - styles.bodyFontSize)
    );
    styles.margins.bottom = Math.max(36, Math.round(minY - styles.bodyFontSize));
  }

  // Detect font family from most-used font name
  const fontNameFreq = {};
  for (const d of fontData) {
    fontNameFreq[d.fontName] = (fontNameFreq[d.fontName] || 0) + d.len;
  }
  const topFont = Object.entries(fontNameFreq).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];
  if (topFont) {
    styles.bodyFontFamily = mapPdfFont(topFont);
  }

  return styles;
}

// === PDF Generation ===
async function generateStyledPdf(markdown, styles) {
  const html = marked.parse(markdown);
  const ptToMm = (pt) => (pt * 25.4) / 72;

  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @page { size: ${ptToMm(styles.pageWidth)}mm ${ptToMm(styles.pageHeight)}mm; }
  body {
    font-family: ${styles.bodyFontFamily};
    font-size: ${styles.bodyFontSize}pt;
    color: ${styles.bodyColor};
    line-height: ${styles.lineHeight};
    margin: 0; padding: 0;
  }
  h1 { font-size: ${styles.headingSizes.h1}pt; color: ${styles.headingColor}; margin: 0.8em 0 0.4em; font-weight: 700; }
  h2 { font-size: ${styles.headingSizes.h2}pt; color: ${styles.headingColor}; margin: 0.7em 0 0.35em; font-weight: 600; }
  h3 { font-size: ${styles.headingSizes.h3}pt; color: ${styles.headingColor}; margin: 0.6em 0 0.3em; font-weight: 600; }
  h4 { font-size: ${styles.headingSizes.h4}pt; color: ${styles.headingColor}; margin: 0.5em 0 0.25em; font-weight: 600; }
  p { margin: 0.4em 0; }
  ul, ol { margin: 0.4em 0; padding-left: 2em; }
  li { margin: 0.2em 0; }
  code { font-family: 'Courier New', Courier, monospace; font-size: 0.9em; background: #f5f5f5; padding: 0.1em 0.3em; border-radius: 3px; }
  pre { background: #f5f5f5; padding: 0.8em; border-radius: 4px; overflow-x: auto; margin: 0.6em 0; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #ccc; padding-left: 1em; color: #555; margin: 0.6em 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.6em 0; }
  th, td { border: 1px solid #ddd; padding: 0.4em 0.6em; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; }
  img { max-width: 100%; }
  a { color: #2563eb; text-decoration: none; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1em 0; }
</style></head><body>${html}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 30000 });
    const pdfBuffer = await page.pdf({
      width: `${ptToMm(styles.pageWidth)}mm`,
      height: `${ptToMm(styles.pageHeight)}mm`,
      margin: {
        top: `${ptToMm(styles.margins.top)}mm`,
        right: `${ptToMm(styles.margins.right)}mm`,
        bottom: `${ptToMm(styles.margins.bottom)}mm`,
        left: `${ptToMm(styles.margins.left)}mm`,
      },
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

// === Existing: PDF-to-Markdown conversion ===
app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  const origPath = req.file.path;
  const pdfPath = origPath + ".pdf";
  fs.renameSync(origPath, pdfPath);

  const jobId = path.basename(origPath);
  const jobOutputDir = path.join(outputDir, jobId);

  try {
    fs.mkdirSync(jobOutputDir, { recursive: true });

    execSync(
      `python3 -c "import opendataloader_pdf; opendataloader_pdf.convert(input_path='${pdfPath}', output_dir='${jobOutputDir}', format='markdown', image_output='embedded')"`,
      { timeout: 120000, stdio: "pipe" }
    );

    const mdFiles = fs
      .readdirSync(jobOutputDir)
      .filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      return res.status(500).json({ error: "Conversion produced no output" });
    }

    const markdown = fs.readFileSync(
      path.join(jobOutputDir, mdFiles[0]),
      "utf-8"
    );

    res.json({ markdown, filename: req.file.originalname });
  } catch (err) {
    console.error("Conversion error:", err.message);
    res.status(500).json({ error: "PDF conversion failed: " + err.message });
  } finally {
    fs.rm(pdfPath, { force: true }, () => {});
    fs.rm(jobOutputDir, { recursive: true, force: true }, () => {});
  }
});

// === Template endpoints ===
app.post("/api/template", upload.single("template"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  const origPath = req.file.path;
  const pdfPath = origPath + ".pdf";
  fs.renameSync(origPath, pdfPath);

  try {
    const buffer = fs.readFileSync(pdfPath);
    const styles = await extractTemplateStyles(buffer);

    if (currentTemplate?.path) {
      fs.rm(currentTemplate.path, { force: true }, () => {});
    }

    currentTemplate = { filename: req.file.originalname, path: pdfPath, styles };
    res.json({ filename: currentTemplate.filename, styles });
  } catch (err) {
    fs.rm(pdfPath, { force: true }, () => {});
    console.error("Template processing error:", err.message);
    res.status(500).json({ error: "Failed to process template: " + err.message });
  }
});

app.get("/api/template", (_req, res) => {
  if (!currentTemplate) return res.json({ template: null });
  res.json({
    template: {
      filename: currentTemplate.filename,
      styles: currentTemplate.styles,
    },
  });
});

app.delete("/api/template", (_req, res) => {
  if (currentTemplate?.path) {
    fs.rm(currentTemplate.path, { force: true }, () => {});
  }
  currentTemplate = null;
  res.json({ success: true });
});

// === PDF generation endpoint ===
app.post("/api/generate-pdf", async (req, res) => {
  const { markdown } = req.body;
  if (!markdown) {
    return res.status(400).json({ error: "No markdown provided" });
  }

  try {
    const styles = currentTemplate?.styles || {
      ...DEFAULT_STYLES,
      margins: { ...DEFAULT_STYLES.margins },
      headingSizes: { ...DEFAULT_STYLES.headingSizes },
    };
    const pdfBuffer = await generateStyledPdf(markdown, styles);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err.message);
    res.status(500).json({ error: "PDF generation failed: " + err.message });
  }
});

// === Error handler ===
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large (max 50MB)" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal server error" });
});

// === Cleanup on exit ===
async function cleanup() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {}
  }
  if (currentTemplate?.path) {
    fs.rmSync(currentTemplate.path, { force: true });
  }
  process.exit(0);
}
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
