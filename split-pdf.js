// ===== Split PDF Tool Logic =====
(function () {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const controlsCard = document.getElementById("controlsCard");
  const rangeRow = document.getElementById("rangeRow");
  const rangeInput = document.getElementById("rangeInput");
  const pageCountInfo = document.getElementById("pageCountInfo");
  const splitBtn = document.getElementById("splitBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let currentFile = null;
  let pageCount = 0;

  function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.classList.remove("hidden");
    setTimeout(() => errorAlert.classList.add("hidden"), 5000);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  async function loadFile(file) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showError(`"${file.name}" is not a PDF file.`);
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      pageCount = doc.getPageCount();
      currentFile = file;

      fileList.innerHTML = `
        <div class="file-item">
          <div class="file-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-meta">${formatSize(file.size)} • ${pageCount} pages</div>
          </div>
          <button class="file-remove" id="removeFileBtn" title="Remove">&times;</button>
        </div>`;
      fileList.classList.remove("hidden");
      controlsCard.classList.remove("hidden");
      splitBtn.classList.remove("hidden");
      pageCountInfo.textContent = `This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}.`;

      document.getElementById("removeFileBtn").addEventListener("click", reset);
    } catch (e) {
      showError(`Could not read "${file.name}". It may be corrupted or password-protected.`);
    }
  }

  function reset() {
    currentFile = null;
    pageCount = 0;
    fileList.innerHTML = "";
    fileList.classList.add("hidden");
    controlsCard.classList.add("hidden");
    splitBtn.classList.add("hidden");
    resultCard.classList.add("hidden");
    rangeInput.value = "";
  }

  // Drag & drop
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) loadFile(e.target.files[0]);
    fileInput.value = "";
  });

  // Toggle range row
  document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
    radio.addEventListener("change", () => {
      rangeRow.classList.toggle("hidden", document.querySelector('input[name="splitMode"]:checked').value !== "range");
    });
  });

  // Parse "1-3, 5, 8-10" into a sorted array of 0-based page indices
  function parseRange(str, max) {
    const indices = new Set();
    const parts = str.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new Error("Please enter a page range, e.g. 1-3, 5, 8-10.");
    for (const part of parts) {
      if (part.includes("-")) {
        const [a, b] = part.split("-").map(n => parseInt(n.trim(), 10));
        if (isNaN(a) || isNaN(b) || a < 1 || b > max || a > b) {
          throw new Error(`Invalid range "${part}". This PDF has ${max} pages.`);
        }
        for (let i = a; i <= b; i++) indices.add(i - 1);
      } else {
        const n = parseInt(part, 10);
        if (isNaN(n) || n < 1 || n > max) {
          throw new Error(`Invalid page number "${part}". This PDF has ${max} pages.`);
        }
        indices.add(n - 1);
      }
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  splitBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "10%";
    splitBtn.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const arrayBuffer = await currentFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const mode = document.querySelector('input[name="splitMode"]:checked').value;

      if (mode === "range") {
        const indices = parseRange(rangeInput.value, pageCount);
        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(srcDoc, indices);
        copiedPages.forEach(p => newDoc.addPage(p));
        progressFill.style.width = "80%";
        const bytes = await newDoc.save();
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        progressFill.style.width = "100%";
        setTimeout(() => {
          progressWrap.classList.add("hidden");
          resultCard.classList.remove("hidden");
          downloadBtn.href = url;
          downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + "_extracted.pdf";
          downloadBtn.textContent = "Download Extracted PDF";
          resultMeta.textContent = `Extracted ${indices.length} page${indices.length === 1 ? "" : "s"} into a new PDF (${formatSize(blob.size)}).`;
        }, 300);

      } else {
        // Split into individual pages -> ZIP
        const zip = new JSZip();
        const baseName = currentFile.name.replace(/\.pdf$/i, "");

        for (let i = 0; i < pageCount; i++) {
          const newDoc = await PDFDocument.create();
          const [copied] = await newDoc.copyPages(srcDoc, [i]);
          newDoc.addPage(copied);
          const bytes = await newDoc.save();
          const pageNum = String(i + 1).padStart(String(pageCount).length, "0");
          zip.file(`${baseName}_page_${pageNum}.pdf`, bytes);
          progressFill.style.width = `${10 + Math.round(((i + 1) / pageCount) * 80)}%`;
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);

        progressFill.style.width = "100%";
        setTimeout(() => {
          progressWrap.classList.add("hidden");
          resultCard.classList.remove("hidden");
          downloadBtn.href = url;
          downloadBtn.download = baseName + "_split_pages.zip";
          downloadBtn.textContent = "Download ZIP (All Pages)";
          resultMeta.textContent = `Split into ${pageCount} individual PDF files, packaged as a ZIP (${formatSize(zipBlob.size)}).`;
        }, 300);
      }

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while splitting your PDF. Please try again.");
    } finally {
      splitBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
