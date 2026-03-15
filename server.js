const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { extractFileSync } = require("@kreuzberg/node");

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "output");

for (const dir of [uploadDir, outputDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".pptx", ".xlsx", ".epub"];
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/epub+zip",
];

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMETYPES.includes(file.mimetype) || ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format"));
    }
  },
});

app.use(express.static(path.join(__dirname, "public")));
// === PDF-to-Markdown conversion ===
app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const origPath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
  const filePath = origPath + ext;
  fs.renameSync(origPath, filePath);

  const jobId = path.basename(origPath);
  const jobOutputDir = path.join(outputDir, jobId);

  const engine = req.body?.engine || req.query?.engine || "opendataloader";
  const isPdf = ext === ".pdf";

  if (engine === "opendataloader" && !isPdf) {
    fs.rm(filePath, { force: true }, () => {});
    return res.status(400).json({
      error: "opendataloader-pdf only supports PDF files. Switch to kreuzberg for other formats.",
    });
  }

  try {
    let markdown;

    if (engine === "kreuzberg") {
      const result = extractFileSync(filePath, null, {
        outputFormat: "markdown",
      });
      if (!result.content) {
        return res
          .status(500)
          .json({ error: "Kreuzberg conversion produced no output" });
      }
      markdown = result.content;
    } else {
      fs.mkdirSync(jobOutputDir, { recursive: true });

      execSync(
        `python3 -c "import opendataloader_pdf; opendataloader_pdf.convert(input_path='${filePath}', output_dir='${jobOutputDir}', format='markdown', image_output='embedded')"`,
        { timeout: 120000, stdio: "pipe" }
      );

      const mdFiles = fs
        .readdirSync(jobOutputDir)
        .filter((f) => f.endsWith(".md"));

      if (mdFiles.length === 0) {
        return res
          .status(500)
          .json({ error: "Conversion produced no output" });
      }

      markdown = fs.readFileSync(
        path.join(jobOutputDir, mdFiles[0]),
        "utf-8"
      );
    }

    res.json({ markdown, filename: req.file.originalname, engine });
  } catch (err) {
    console.error("Conversion error:", err.message);
    res.status(500).json({ error: "PDF conversion failed: " + err.message });
  } finally {
    fs.rm(filePath, { force: true }, () => {});
    fs.rm(jobOutputDir, { recursive: true, force: true }, () => {});
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
  if (err.message === "Unsupported file format") {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal server error" });
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
