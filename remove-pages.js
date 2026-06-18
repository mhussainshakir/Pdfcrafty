// ===== Remove PDF Pages Tool Logic =====
(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const controlsCard = document.getElementById("controlsCard");
  const instructionsLabel = document.getElementById("instructionsLabel");
  const pagesGrid = document.getElementById("pagesGrid");
  const removeBtn = document.getElementById("removeBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let currentFile = null;
  let selected = new Set();
  let numPages = 0;

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

  function reset() {
    currentFile = null;
    selected = new Set();
    numPages = 0;
    pagesGrid.innerHTML = "";
    pagesGrid.classList.add("hidden");
    controlsCard.classList.add("hidden");
    removeBtn.classList.add("hidden");
    resultCard.classList.add("hidden");
  }

  function updateInstructions() {
    if (selected.size === 0) {
      instructionsLabel.textContent = "Click on a page thumbnail to mark it for removal.";
    } else {
      instructionsLabel.textContent = `${selected.size} page${selected.size === 1 ? "" : "s"} selected for removal (out of ${numPages}).`;
    }
  }

  async function loadFile(file) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showError(`"${file.name}" is not a PDF file.`);
      return;
    }
    reset();
    currentFile = file;
    controlsCard.classList.remove("hidden");
    pagesGrid.classList.remove("hidden");
    removeBtn.classList.remove("hidden");
    progressWrap.classList.remove("hidden");
    progressLabel.textContent = "Loading page previews...";
    progressFill.style.width = "10%";

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      numPages = pdf.numPages;

      pagesGrid.innerHTML = "";
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const card = document.createElement("div");
        card.className = "page-card";
        card.dataset.index = i - 1;
        card.innerHTML = `<canvas></canvas><div class="page-label">Page ${i}</div>`;
        const targetCanvas = card.querySelector("canvas");
        targetCanvas.width = canvas.width;
        targetCanvas.height = canvas.height;
        targetCanvas.getContext("2d").drawImage(canvas, 0, 0);

        card.addEventListener("click", () => {
          const idx = Number(card.dataset.index);
          if (selected.has(idx)) {
            selected.delete(idx);
            card.classList.remove("selected");
          } else {
            selected.add(idx);
            card.classList.add("selected");
          }
          updateInstructions();
        });

        pagesGrid.appendChild(card);
        progressFill.style.width = `${10 + Math.round((i / numPages) * 80)}%`;
      }

      updateInstructions();
      progressFill.style.width = "100%";
      setTimeout(() => { progressWrap.classList.add("hidden"); }, 200);

    } catch (e) {
      progressWrap.classList.add("hidden");
      showError(`Could not read "${file.name}". It may be corrupted or password-protected.`);
    }
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

  removeBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    if (selected.size === 0) {
      showError("Please select at least one page to remove.");
      return;
    }
    if (selected.size === numPages) {
      showError("You can't remove all pages. At least one page must remain in the PDF.");
      return;
    }

    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressLabel.textContent = "Removing pages...";
    progressFill.style.width = "10%";
    removeBtn.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const arrayBuffer = await currentFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      const keepIndices = [];
      for (let i = 0; i < numPages; i++) {
        if (!selected.has(i)) keepIndices.push(i);
      }

      const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
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
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + "_edited.pdf";
        resultMeta.textContent = `Removed ${selected.size} page${selected.size === 1 ? "" : "s"}. New PDF has ${keepIndices.length} pages (${formatSize(blob.size)}).`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while editing your PDF. Please try again.");
    } finally {
      removeBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
