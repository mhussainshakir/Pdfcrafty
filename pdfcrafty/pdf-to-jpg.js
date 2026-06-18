// ===== PDF to JPG Tool Logic =====
(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const controlsCard = document.getElementById("controlsCard");
  const convertBtn = document.getElementById("convertBtn");
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
    convertBtn.classList.remove("hidden");
    document.getElementById("removeFileBtn").addEventListener("click", reset);
  }

  function reset() {
    currentFile = null;
    fileList.innerHTML = "";
    fileList.classList.add("hidden");
    controlsCard.classList.add("hidden");
    convertBtn.classList.add("hidden");
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

  convertBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "5%";
    convertBtn.disabled = true;

    try {
      const scale = parseFloat(document.querySelector('input[name="quality"]:checked').value) + 0.5; // 1.5, 2.5, 3.5
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const numPages = pdf.numPages;
      const baseName = currentFile.name.replace(/\.pdf$/i, "");

      const images = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const bytes = await fetch(dataUrl).then(r => r.arrayBuffer());
        images.push(bytes);

        progressFill.style.width = `${5 + Math.round((i / numPages) * 85)}%`;
      }

      progressFill.style.width = "95%";

      let url, downloadName, sizeInfo;

      if (numPages === 1) {
        const blob = new Blob([images[0]], { type: "image/jpeg" });
        url = URL.createObjectURL(blob);
        downloadName = `${baseName}.jpg`;
        sizeInfo = formatSize(blob.size);
      } else {
        const zip = new JSZip();
        const padLen = String(numPages).length;
        images.forEach((bytes, idx) => {
          const pageNum = String(idx + 1).padStart(padLen, "0");
          zip.file(`${baseName}_page_${pageNum}.jpg`, bytes);
        });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        url = URL.createObjectURL(zipBlob);
        downloadName = `${baseName}_images.zip`;
        sizeInfo = formatSize(zipBlob.size);
      }

      progressFill.style.width = "100%";

      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        downloadBtn.download = downloadName;
        downloadBtn.textContent = numPages === 1 ? "Download JPG" : "Download ZIP (All Pages)";
        resultMeta.textContent = numPages === 1
          ? `Converted 1 page to a JPG image (${sizeInfo}).`
          : `Converted ${numPages} pages to JPG images, packaged as a ZIP (${sizeInfo}).`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while converting your PDF. Please try a different file.");
    } finally {
      convertBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
