// ===== JPG to PDF Tool Logic =====
(function () {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const controlsCard = document.getElementById("controlsCard");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const orientationSelect = document.getElementById("orientationSelect");
  const convertBtn = document.getElementById("convertBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let images = []; // { id, file, name, size }
  let idCounter = 0;

  const PAGE_SIZES = {
    a4: [595.28, 841.89],
    letter: [612, 792]
  };

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
    if (images.length === 0) {
      fileList.classList.add("hidden");
      controlsCard.classList.add("hidden");
      convertBtn.classList.add("hidden");
      return;
    }
    fileList.classList.remove("hidden");
    controlsCard.classList.remove("hidden");
    convertBtn.classList.remove("hidden");
    convertBtn.textContent = `Convert ${images.length} Image${images.length === 1 ? "" : "s"} to PDF`;

    fileList.innerHTML = images.map(f => `
      <div class="file-item" data-id="${f.id}">
        <div class="file-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        </div>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
          <div class="file-meta">${formatSize(f.size)}</div>
        </div>
        <button class="file-remove" data-id="${f.id}" title="Remove">&times;</button>
      </div>
    `).join("");

    if (window.Sortable && !fileList._sortableInit) {
      Sortable.create(fileList, {
        animation: 150,
        onEnd: function () {
          const newOrder = Array.from(fileList.children).map(el => el.dataset.id);
          images.sort((a, b) => newOrder.indexOf(String(a.id)) - newOrder.indexOf(String(b.id)));
        }
      });
      fileList._sortableInit = true;
    }

    fileList.querySelectorAll(".file-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = Number(e.currentTarget.dataset.id);
        images = images.filter(f => f.id !== id);
        renderFileList();
      });
    });
  }

  function addFiles(fileArr) {
    for (const file of fileArr) {
      if (!file.type.startsWith("image/")) {
        showError(`"${file.name}" is not a supported image file and was skipped.`);
        continue;
      }
      images.push({ id: idCounter++, file, name: file.name, size: file.size });
    }
    renderFileList();
  }

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

  function loadImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { resolve({ width: img.width, height: img.height, url }); };
      img.onerror = () => { reject(new Error(`Could not load "${file.name}".`)); };
      img.src = url;
    });
  }

  convertBtn.addEventListener("click", async () => {
    if (images.length === 0) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "5%";
    convertBtn.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();
      const pageSizeMode = pageSizeSelect.value;
      const orientationMode = orientationSelect.value;

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        const arrayBuffer = await item.file.arrayBuffer();
        const dims = await loadImageDimensions(item.file);

        let embedded;
        const isPng = item.file.type === "image/png";
        if (isPng) {
          embedded = await pdfDoc.embedPng(arrayBuffer);
        } else {
          // Convert webp / others to JPEG via canvas for pdf-lib compatibility
          if (item.file.type === "image/jpeg" || item.file.type === "image/jpg") {
            embedded = await pdfDoc.embedJpg(arrayBuffer);
          } else {
            const canvas = document.createElement("canvas");
            canvas.width = dims.width;
            canvas.height = dims.height;
            const ctx = canvas.getContext("2d");
            const img = new Image();
            await new Promise((res, rej) => {
              img.onload = res; img.onerror = rej; img.src = dims.url;
            });
            ctx.drawImage(img, 0, 0);
            const jpegUrl = canvas.toDataURL("image/jpeg", 0.92);
            const jpegBytes = await fetch(jpegUrl).then(r => r.arrayBuffer());
            embedded = await pdfDoc.embedJpg(jpegBytes);
          }
        }

        let pageW, pageH, drawW, drawH, x, y;

        if (pageSizeMode === "fit") {
          pageW = dims.width;
          pageH = dims.height;
          if (orientationMode === "landscape" && pageH > pageW) { [pageW, pageH] = [pageH, pageW]; }
          if (orientationMode === "portrait" && pageW > pageH) { [pageW, pageH] = [pageH, pageW]; }
          drawW = dims.width; drawH = dims.height;
          if (orientationMode !== "auto" && (pageW !== dims.width || pageH !== dims.height)) {
            // rotated to fit orientation; fit image within
            const scale = Math.min(pageW / dims.width, pageH / dims.height);
            drawW = dims.width * scale; drawH = dims.height * scale;
          }
          x = (pageW - drawW) / 2; y = (pageH - drawH) / 2;
        } else {
          [pageW, pageH] = PAGE_SIZES[pageSizeMode];
          let useLandscape = orientationMode === "landscape" || (orientationMode === "auto" && dims.width > dims.height);
          if (useLandscape) [pageW, pageH] = [pageH, pageW];
          const scale = Math.min(pageW / dims.width, pageH / dims.height);
          drawW = dims.width * scale; drawH = dims.height * scale;
          x = (pageW - drawW) / 2; y = (pageH - drawH) / 2;
        }

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embedded, { x, y, width: drawW, height: drawH });

        URL.revokeObjectURL(dims.url);
        progressFill.style.width = `${5 + Math.round(((i + 1) / images.length) * 85)}%`;
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        resultMeta.textContent = `${images.length} image${images.length === 1 ? "" : "s"} combined into a ${pdfDoc.getPageCount()}-page PDF (${formatSize(blob.size)}).`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while creating your PDF. Please try again.");
    } finally {
      convertBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", () => {
    images = [];
    renderFileList();
    resultCard.classList.add("hidden");
  });
})();
