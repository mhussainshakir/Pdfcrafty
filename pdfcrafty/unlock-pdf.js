// ===== Unlock PDF Tool Logic =====
(function () {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const controlsCard = document.getElementById("controlsCard");
  const passwordInput = document.getElementById("passwordInput");
  const unlockBtn = document.getElementById("unlockBtn");
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
    unlockBtn.classList.remove("hidden");
    document.getElementById("removeFileBtn").addEventListener("click", reset);
  }

  function reset() {
    currentFile = null;
    fileList.innerHTML = "";
    fileList.classList.add("hidden");
    controlsCard.classList.add("hidden");
    unlockBtn.classList.add("hidden");
    resultCard.classList.add("hidden");
    passwordInput.value = "";
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

  unlockBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    const pw = passwordInput.value;
    if (!pw) { showError("Please enter the PDF's current password."); return; }

    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "20%";
    unlockBtn.disabled = true;

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      progressFill.style.width = "50%";

      const decryptedBytes = PDFEncrypt.decrypt(new Uint8Array(arrayBuffer), pw);
      progressFill.style.width = "90%";

      const blob = new Blob([decryptedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + "_unlocked.pdf";
        resultMeta.textContent = `Password protection removed (${formatSize(blob.size)}). The PDF will now open without a password.`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while unlocking your PDF. Please try again.");
    } finally {
      unlockBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
