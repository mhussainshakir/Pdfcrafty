// ===== PDF to Word Tool Logic =====
// Strategy: extract text content per page via pdf.js, group into lines/
// paragraphs based on Y position, then build a .docx file using docx.js.

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

  // Group text items into lines based on Y coordinate, then into paragraphs
  function extractPageParagraphs(textContent) {
    const items = textContent.items.filter(it => it.str !== undefined);
    if (items.length === 0) return [];

    // Group by approximate Y (rounded) to form lines
    const lineMap = new Map();
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push(item);
    }

    // Sort lines top-to-bottom (PDF Y increases upward, so descending)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

    const lines = sortedYs.map(y => {
      const lineItems = lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      return lineItems.map(it => it.str).join(" ").replace(/\s+/g, " ").trim();
    }).filter(line => line.length > 0);

    return lines;
  }

  convertBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultCard.classList.add("hidden");
    errorAlert.classList.add("hidden");
    infoAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "5%";
    convertBtn.disabled = true;

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const numPages = pdf.numPages;

      const allParagraphs = [];
      let totalChars = 0;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = extractPageParagraphs(textContent);
        lines.forEach(l => totalChars += l.length);
        allParagraphs.push(...lines);

        if (i < numPages) allParagraphs.push("__PAGE_BREAK__");

        progressFill.style.width = `${5 + Math.round((i / numPages) * 70)}%`;
      }

      if (totalChars === 0) {
        progressWrap.classList.add("hidden");
        showError("No selectable text was found in this PDF. It may be a scanned/image-based document — try our OCR tool first.");
        convertBtn.disabled = false;
        return;
      }

      progressFill.style.width = "80%";

      // Build docx
      const { Document, Packer, Paragraph, TextRun, PageBreak } = docx;

      const docParagraphs = [];
      for (const line of allParagraphs) {
        if (line === "__PAGE_BREAK__") {
          docParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
        } else {
          docParagraphs.push(new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 120 }
          }));
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: docParagraphs
        }]
      });

      progressFill.style.width = "92%";

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";

      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + ".docx";
        resultMeta.textContent = `Converted ${numPages} page${numPages === 1 ? "" : "s"} into an editable Word document (${formatSize(blob.size)}).`;
        infoAlert.textContent = "Tip: Complex layouts (columns, tables, images) may not be perfectly preserved. For best results, use this on text-heavy PDFs.";
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
