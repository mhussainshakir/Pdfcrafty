// ===== Organize PDF Pages Tool Logic =====
(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const controlsCard = document.getElementById("controlsCard");
  const pagesGrid = document.getElementById("pagesGrid");
  const saveBtn = document.getElementById("saveBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let currentFile = null;
  let pageOrder = []; // array of original 0-based indices, reordered/filtered by user

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
    pageOrder = [];
    pagesGrid.innerHTML = "";
    pagesGrid.classList.add("hidden");
    controlsCard.classList.add("hidden");
    saveBtn.classList.add("hidden");
    resultCard.classList.add("hidden");
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
    progressWrap.classList.remove("hidden");
    progressLabel.textContent = "Loading page previews...";
    progressFill.style.width = "10%";

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const numPages = pdf.numPages;
      pageOrder = Array.from({ length: numPages }, (_, i) => i);

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
        card.dataset.origIndex = i - 1;
        card.innerHTML = `
          <button class="page-delete-btn" title="Remove page">&times;</button>
          <canvas></canvas>
          <div class="page-label">Page ${i}</div>
        `;
        const targetCanvas = card.querySelector("canvas");
        targetCanvas.width = canvas.width;
        targetCanvas.height = canvas.height;
        targetCanvas.getContext("2d").drawImage(canvas, 0, 0);
        pagesGrid.appendChild(card);

        progressFill.style.width = `${10 + Math.round((i / numPages) * 80)}%`;
      }

      progressFill.style.width = "100%";
      setTimeout(() => { progressWrap.classList.add("hidden"); }, 200);
      saveBtn.classList.remove("hidden");

      if (window.Sortable) {
        Sortable.create(pagesGrid, {
          animation: 150,
          onEnd: updatePageOrder
        });
      }

      pagesGrid.querySelectorAll(".page-delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const card = e.target.closest(".page-card");
          if (pagesGrid.children.length <= 1) {
            showError("You can't remove all pages. At least one page must remain.");
            return;
          }
          card.remove();
          updatePageOrder();
        });
      });

      updatePageOrder();

    } catch (e) {
      progressWrap.classList.add("hidden");
      showError(`Could not read "${file.name}". It may be corrupted or password-protected.`);
    }
  }

  function updatePageOrder() {
    pageOrder = Array.from(pagesGrid.children).map(card => Number(card.dataset.origIndex));
    pagesGrid.querySelectorAll(".page-label").forEach((label, idx) => {
      const origIndex = Number(pagesGrid.children[idx].dataset.origIndex);
      label.textContent = `Page ${idx + 1} (was ${origIndex + 1})`;
    });
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

  saveBtn.addEventListener("click", async () => {
    if (!currentFile || pageOrder.length === 0) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressLabel.textContent = "Saving organized PDF...";
    progressFill.style.width = "10%";
    saveBtn.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const arrayBuffer = await currentFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      const copiedPages = await newDoc.copyPages(srcDoc, pageOrder);
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
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + "_organized.pdf";
        resultMeta.textContent = `Your PDF now has ${pageOrder.length} pages in the new order (${formatSize(blob.size)}).`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while saving your PDF. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
