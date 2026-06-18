// ===== Add Page Numbers Tool Logic =====
(function () {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const controlsCard = document.getElementById("controlsCard");
  const positionSelect = document.getElementById("positionSelect");
  const formatSelect = document.getElementById("formatSelect");
  const startInput = document.getElementById("startInput");
  const fontSizeInput = document.getElementById("fontSizeInput");
  const addBtn = document.getElementById("addBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let currentFile = null;

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
    addBtn.classList.remove("hidden");
    document.getElementById("removeFileBtn").addEventListener("click", reset);
  }

  function reset() {
    currentFile = null;
    fileList.innerHTML = "";
    fileList.classList.add("hidden");
    controlsCard.classList.add("hidden");
    addBtn.classList.add("hidden");
    resultCard.classList.add("hidden");
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

  function getPosition(posKey, pageWidth, pageHeight, textWidth, fontSize, margin) {
    const positions = {
      "bottom-center": { x: (pageWidth - textWidth) / 2, y: margin },
      "bottom-right": { x: pageWidth - textWidth - margin, y: margin },
      "bottom-left": { x: margin, y: margin },
      "top-center": { x: (pageWidth - textWidth) / 2, y: pageHeight - margin - fontSize },
      "top-right": { x: pageWidth - textWidth - margin, y: pageHeight - margin - fontSize },
      "top-left": { x: margin, y: pageHeight - margin - fontSize }
    };
    return positions[posKey] || positions["bottom-center"];
  }

  addBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "10%";
    addBtn.disabled = true;

    try {
      const { PDFDocument, StandardFonts, rgb } = PDFLib;
      const arrayBuffer = await currentFile.arrayBuffer();
      const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);

      const startNum = parseInt(startInput.value, 10) || 1;
      const fontSize = parseFloat(fontSizeInput.value) || 10;
      const format = formatSelect.value;
      const posKey = positionSelect.value;
      const margin = 28;

      const pages = doc.getPages();
      const totalPages = pages.length;

      pages.forEach((page, idx) => {
        const pageNum = startNum + idx;
        const text = format === "pageof" ? `Page ${pageNum} of ${totalPages}` : `${pageNum}`;
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const pos = getPosition(posKey, width, height, textWidth, fontSize, margin);

        page.drawText(text, {
          x: pos.x,
          y: pos.y,
          size: fontSize,
          font: font,
          color: rgb(0.2, 0.2, 0.2)
        });

        progressFill.style.width = `${10 + Math.round(((idx + 1) / totalPages) * 80)}%`;
      });

      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + "_numbered.pdf";
        resultMeta.textContent = `Page numbers added to all ${totalPages} pages (${formatSize(blob.size)}).`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while adding page numbers. Please try again.");
    } finally {
      addBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
