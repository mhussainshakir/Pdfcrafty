// ===== Compress PDF Tool Logic =====
// Strategy: render each page to a canvas via pdf.js, then re-encode as a
// JPEG image inside a new PDF via pdf-lib. This significantly reduces size
// for image-heavy / scanned PDFs. Quality level controls JPEG quality + scale.

(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const controlsCard = document.getElementById("controlsCard");
  const compressBtn = document.getElementById("compressBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");
  const infoAlert = document.getElementById("infoAlert");

  let currentFile = null;

  const LEVELS = {
    low:    { scale: 2.0, quality: 0.85 },
    medium: { scale: 1.5, quality: 0.7 },
    high:   { scale: 1.0, quality: 0.5 }
  };

  function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.classList.remove("hidden");
    setTimeout(() => errorAlert.classList.add("hidden"), 6000);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function loadFile(file) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showError(`"${file.name}" is not a PDF file.`);
      return;
    }
    currentFile = file;
    fileList.innerHTML = `
      <div class="file-item">
        <div class="file-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">${formatSize(file.size)}</div>
        </div>
        <button class="file-remove" id="removeFileBtn" title="Remove">&times;</button>
      </div>`;
    fileList.classList.remove("hidden");
    controlsCard.classList.remove("hidden");
    compressBtn.classList.remove("hidden");
    document.getElementById("removeFileBtn").addEventListener("click", reset);
  }

  function reset() {
    currentFile = null;
    fileList.innerHTML = "";
    fileList.classList.add("hidden");
    controlsCard.classList.add("hidden");
    compressBtn.classList.add("hidden");
    resultCard.classList.add("hidden");
    infoAlert.classList.add("hidden");
  }

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

  compressBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    infoAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "5%";
    compressBtn.disabled = true;

    try {
      const level = document.querySelector('input[name="compressLevel"]:checked').value;
      const { scale, quality } = LEVELS[level];

      const originalArrayBuffer = await currentFile.arrayBuffer();
      const originalSize = currentFile.size;

      const pdf = await pdfjsLib.getDocument({ data: originalArrayBuffer.slice(0) }).promise;
      const numPages = pdf.numPages;

      const { PDFDocument } = PDFLib;
      const newDoc = await PDFDocument.create();

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        await page.render({ canvasContext: ctx, viewport }).promise;

        const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
        const jpegBytes = await fetch(jpegDataUrl).then(r => r.arrayBuffer());
        const jpegImage = await newDoc.embedJpg(jpegBytes);

        const pdfPage = newDoc.addPage([viewport.width, viewport.height]);
        pdfPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });

        progressFill.style.width = `${5 + Math.round((i / numPages) * 85)}%`;
      }

      const newBytes = await newDoc.save();
      const newBlob = new Blob([newBytes], { type: "application/pdf" });

      progressFill.style.width = "100%";

      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");

        if (newBlob.size >= originalSize) {
          infoAlert.textContent = "This PDF was already optimized — the compressed version wasn't smaller, so consider using a lower compression level for image-heavy files or keeping the original.";
          infoAlert.classList.remove("hidden");
        }

        const url = URL.createObjectURL(newBlob);
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + "_compressed.pdf";

        const reduction = Math.max(0, Math.round((1 - newBlob.size / originalSize) * 100));
        resultMeta.textContent = `${formatSize(originalSize)} → ${formatSize(newBlob.size)} (${reduction}% smaller).`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while compressing your PDF. Please try a different compression level or file.");
    } finally {
      compressBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
