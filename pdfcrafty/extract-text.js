// ===== Extract Text from PDF Tool Logic =====
(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const extractBtn = document.getElementById("extractBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const resultSection = document.getElementById("resultSection");
  const resultMeta = document.getElementById("resultMeta");
  const textPreview = document.getElementById("textPreview");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetBtn = document.getElementById("resetBtn");
  const errorAlert = document.getElementById("errorAlert");

  let currentFile = null;
  let extractedText = "";

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
    extractBtn.classList.remove("hidden");
    document.getElementById("removeFileBtn").addEventListener("click", reset);
  }

  function reset() {
    currentFile = null;
    extractedText = "";
    fileList.innerHTML = "";
    fileList.classList.add("hidden");
    extractBtn.classList.add("hidden");
    resultSection.classList.add("hidden");
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

  function extractPageLines(textContent) {
    const items = textContent.items.filter(it => it.str !== undefined);
    if (items.length === 0) return [];
    const lineMap = new Map();
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push(item);
    }
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    return sortedYs.map(y => {
      const lineItems = lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      return lineItems.map(it => it.str).join(" ").replace(/\s+/g, " ").trim();
    }).filter(line => line.length > 0);
  }

  extractBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    resultSection.classList.add("hidden");
    errorAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "10%";
    extractBtn.disabled = true;

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const numPages = pdf.numPages;

      let fullText = "";
      let totalChars = 0;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = extractPageLines(textContent);
        lines.forEach(l => totalChars += l.length);
        fullText += lines.join("\n");
        if (i < numPages) fullText += "\n\n--- Page " + (i + 1) + " ---\n\n";
        progressFill.style.width = `${10 + Math.round((i / numPages) * 80)}%`;
      }

      if (totalChars === 0) {
        progressWrap.classList.add("hidden");
        showError("No selectable text was found in this PDF. It may be a scanned/image-based document.");
        extractBtn.disabled = false;
        return;
      }

      extractedText = fullText;
      const blob = new Blob([fullText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";
      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultSection.classList.remove("hidden");
        textPreview.textContent = fullText;
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.pdf$/i, "") + ".txt";
        resultMeta.textContent = `Extracted ${totalChars.toLocaleString()} characters from ${numPages} page${numPages === 1 ? "" : "s"}.`;
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while extracting text. Please try a different file.");
    } finally {
      extractBtn.disabled = false;
    }
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    } catch (e) {
      showError("Could not copy to clipboard. Please select and copy the text manually.");
    }
  });

  resetBtn.addEventListener("click", reset);
})();
