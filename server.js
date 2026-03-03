const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

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
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

app.use(express.static(path.join(__dirname, "public")));

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
