// ===== PDF to Excel Tool Logic =====
// Strategy: extract text items with x/y coordinates per page via pdf.js,
// cluster into rows by Y position, then cluster into columns by X position
// gaps, producing a 2D grid that gets written to a worksheet via SheetJS.

(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const convertBtn = document.getElementById("convertBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const resultCard = document.getElementById("resultCard");
  const resultMeta = document.getElementById("resultMeta");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");
  const infoAlert = document.getElementById("infoAlert");

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
    convertBtn.classList.remove("hidden");
    document.getElementById("removeFileBtn").addEventListener("click", reset);
  }

  function reset() {
    currentFile = null;
    fileList.innerHTML = "";
    fileList.classList.add("hidden");
    convertBtn.classList.add("hidden");
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

  // Build a 2D grid of cells for one page, given text items with x/y/text.
  function buildGridFromItems(items) {
    if (items.length === 0) return [];

    // Group into rows by Y (rounding tolerance handles small jitter)
    const rowTolerance = 3;
    const rows = [];
    const sortedByY = [...items].sort((a, b) => b.y - a.y);

    for (const item of sortedByY) {
      let row = rows.find(r => Math.abs(r.y - item.y) <= rowTolerance);
      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    }

    // Determine column boundaries by collecting all distinct X start positions
    // across all rows, then clustering close ones together.
    const allX = items.map(it => it.x).sort((a, b) => a - b);
    const colTolerance = 12;
    const columnCenters = [];
    for (const x of allX) {
      let existing = columnCenters.find(c => Math.abs(c - x) <= colTolerance);
      if (!existing) columnCenters.push(x);
    }
    columnCenters.sort((a, b) => a - b);

    function colIndexFor(x) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < columnCenters.length; i++) {
        const dist = Math.abs(columnCenters[i] - x);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      return bestIdx;
    }

    const grid = rows.map(row => {
      const rowArr = new Array(columnCenters.length).fill("");
      row.items.sort((a, b) => a.x - b.x).forEach(item => {
        const idx = colIndexFor(item.x);
        rowArr[idx] = rowArr[idx] ? rowArr[idx] + " " + item.text : item.text;
      });
      return rowArr;
    });

    // Trim fully-empty trailing columns
    let maxUsedCol = 0;
    grid.forEach(row => {
      for (let i = row.length - 1; i >= 0; i--) {
        if (row[i] !== "") { maxUsedCol = Math.max(maxUsedCol, i); break; }
      }
    });
    return grid.map(row => row.slice(0, maxUsedCol + 1));
  }

  convertBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    infoAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "10%";
    convertBtn.disabled = true;

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const numPages = pdf.numPages;

      const wb = XLSX.utils.book_new();
      let totalRows = 0;
      let anyContent = false;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const items = textContent.items
          .filter(it => it.str !== undefined && it.str.trim().length > 0)
          .map(it => ({
            text: it.str.trim(),
            x: it.transform[4],
            y: it.transform[5]
          }));

        const grid = buildGridFromItems(items);
        if (grid.length > 0) anyContent = true;
        totalRows += grid.length;

        const ws = XLSX.utils.aoa_to_sheet(grid);
        const sheetName = numPages === 1 ? "Sheet1" : `Page ${i}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

        progressFill.style.width = `${10 + Math.round((i / numPages) * 75)}%`;
      }

      if (!anyContent) {
        progressWrap.classList.add("hidden");
        showError("No selectable text was found in this PDF. It may be a scanned/image-based document.");
        convertBtn.disabled = false;
        return;
      }

      progressFill.style.width = "90%";

      const wbBytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + ".xlsx";
        resultMeta.textContent = `Converted ${numPages} page${numPages === 1 ? "" : "s"} (${totalRows} total rows detected) into a spreadsheet (${formatSize(blob.size)}).`;
        infoAlert.textContent = "Tip: Table detection works best on PDFs with clear, grid-aligned data. Free-flowing text will appear as one row per line.";
        infoAlert.classList.remove("hidden");
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
