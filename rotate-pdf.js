// ===== Rotate PDF Tool Logic =====
(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const controlsCard = document.getElementById("controlsCard");
  const fileNameLabel = document.getElementById("fileNameLabel");
  const pagesGrid = document.getElementById("pagesGrid");
  const saveBtn = document.getElementById("saveBtn");
  const rotateAllLeftBtn = document.getElementById("rotateAllLeftBtn");
  const rotateAllRightBtn = document.getElementById("rotateAllRightBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let currentFile = null;
  let rotations = []; // additional rotation per page, in degrees (0/90/180/270)
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
    rotations = [];
    numPages = 0;
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
    fileNameLabel.textContent = file.name;
    controlsCard.classList.remove("hidden");
    pagesGrid.classList.remove("hidden");
    progressWrap.classList.remove("hidden");
    progressLabel.textContent = "Loading page previews...";
    progressFill.style.width = "10%";

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      numPages = pdf.numPages;
      rotations = new Array(numPages).fill(0);

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
        card.innerHTML = `
          <canvas data-index="${i - 1}"></canvas>
          <div class="page-label">Page ${i}</div>
          <button class="page-rotate-btn" data-index="${i - 1}">⟳ Rotate</button>
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

      pagesGrid.querySelectorAll(".page-rotate-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.index);
          rotations[idx] = (rotations[idx] + 90) % 360;
          applyRotationVisual(idx);
        });
      });

    } catch (e) {
      progressWrap.classList.add("hidden");
      showError(`Could not read "${file.name}". It may be corrupted or password-protected.`);
    }
  }

  function applyRotationVisual(idx) {
    const canvas = pagesGrid.querySelector(`canvas[data-index="${idx}"]`);
    if (canvas) canvas.style.transform = `rotate(${rotations[idx]}deg)`;
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

  rotateAllLeftBtn.addEventListener("click", () => {
    for (let i = 0; i < numPages; i++) {
      rotations[i] = (rotations[i] + 270) % 360;
      applyRotationVisual(i);
    }
  });
  rotateAllRightBtn.addEventListener("click", () => {
    for (let i = 0; i < numPages; i++) {
      rotations[i] = (rotations[i] + 90) % 360;
      applyRotationVisual(i);
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressLabel.textContent = "Saving rotated PDF...";
    progressFill.style.width = "10%";
    saveBtn.disabled = true;

    try {
      const { PDFDocument, degrees } = PDFLib;
      const arrayBuffer = await currentFile.arrayBuffer();
      const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = doc.getPages();

      pages.forEach((page, idx) => {
        if (rotations[idx]) {
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + rotations[idx]) % 360));
        }
        progressFill.style.width = `${10 + Math.round(((idx + 1) / pages.length) * 80)}%`;
      });

      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + "_rotated.pdf";
        const rotatedCount = rotations.filter(r => r !== 0).length;
        resultMeta.textContent = `${rotatedCount} page${rotatedCount === 1 ? "" : "s"} rotated (${formatSize(blob.size)}).`;
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
