// ===== Merge PDF Tool Logic =====
(function () {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const controlsCard = document.getElementById("controlsCard");
  const mergeBtn = document.getElementById("mergeBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let files = []; // { id, file, name, size }
  let idCounter = 0;

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

  function renderFileList() {
    if (files.length === 0) {
      fileList.classList.add("hidden");
      controlsCard.classList.add("hidden");
      mergeBtn.classList.add("hidden");
      return;
    }
    fileList.classList.remove("hidden");
    controlsCard.classList.toggle("hidden", files.length < 2);
    mergeBtn.classList.remove("hidden");
    mergeBtn.disabled = files.length < 2;
    mergeBtn.textContent = files.length < 2
      ? "Add at least 2 PDF files to merge"
      : `Merge ${files.length} PDF Files`;

    fileList.innerHTML = files.map(f => `
      <div class="file-item" data-id="${f.id}">
        <div class="file-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
          <div class="file-meta">${formatSize(f.size)}</div>
        </div>
        <button class="file-remove" data-id="${f.id}" title="Remove">&times;</button>
      </div>
    `).join("");

    // Sortable drag reorder
    if (window.Sortable && !fileList._sortableInit) {
      Sortable.create(fileList, {
        animation: 150,
        onEnd: function () {
          const newOrder = Array.from(fileList.children).map(el => el.dataset.id);
          files.sort((a, b) => newOrder.indexOf(String(a.id)) - newOrder.indexOf(String(b.id)));
        }
      });
      fileList._sortableInit = true;
    }

    fileList.querySelectorAll(".file-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = Number(e.currentTarget.dataset.id);
        files = files.filter(f => f.id !== id);
        renderFileList();
      });
    });
  }

  function addFiles(fileArr) {
    for (const file of fileArr) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        showError(`"${file.name}" is not a PDF file and was skipped.`);
        continue;
      }
      files.push({ id: idCounter++, file, name: file.name, size: file.size });
    }
    renderFileList();
  }

  // Drag & drop
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    addFiles(Array.from(e.dataTransfer.files));
  });
  fileInput.addEventListener("change", (e) => {
    addFiles(Array.from(e.target.files));
    fileInput.value = "";
  });

  // Merge logic
  mergeBtn.addEventListener("click", async () => {
    if (files.length < 2) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "10%";
    mergeBtn.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const arrayBuffer = await files[i].file.arrayBuffer();
        let srcDoc;
        try {
          srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        } catch (e) {
          throw new Error(`Could not read "${files[i].name}". It may be corrupted or password-protected.`);
        }
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        progressFill.style.width = `${10 + Math.round(((i + 1) / files.length) * 80)}%`;
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        const totalPages = mergedPdf.getPageCount();
        resultMeta.textContent = `${files.length} files combined into 1 PDF with ${totalPages} pages (${formatSize(blob.size)}).`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while merging your PDFs. Please try again.");
      mergeBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", () => {
    files = [];
    renderFileList();
    resultCard.classList.add("hidden");
  });
})();
