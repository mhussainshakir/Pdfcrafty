// ===== Word to PDF Tool Logic =====
// Strategy: use mammoth.js to convert .docx -> HTML, render that HTML into
// the hidden render area, then paginate it into a PDF using html2canvas + jsPDF.

(function () {
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
  const renderArea = document.getElementById("renderArea");

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
    const isDocx = file.name.toLowerCase().endsWith(".docx");
    if (!isDocx) {
      showError(`"${file.name}" is not a .docx file. Older .doc files are not supported — please save as .docx first.`);
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
    renderArea.innerHTML = "";
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
    infoAlert.classList.add("hidden");
    progressWrap.classList.remove("hidden");
    progressFill.style.width = "10%";
    convertBtn.disabled = true;

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      if (!html || html.trim().length === 0) {
        throw new Error("No content could be extracted from this document.");
      }

      progressFill.style.width = "30%";

      // Render into hidden area
      renderArea.innerHTML = `<div style="max-width:714px;">${html}</div>`;
      // Basic styling for common elements
      const styleTags = renderArea.querySelectorAll("h1,h2,h3,p,ul,ol,li,table,td,th,strong,em");
      styleTags.forEach(el => {
        if (el.tagName === "H1") { el.style.fontSize = "22px"; el.style.fontWeight = "bold"; el.style.margin = "16px 0 8px"; }
        if (el.tagName === "H2") { el.style.fontSize = "18px"; el.style.fontWeight = "bold"; el.style.margin = "14px 0 6px"; }
        if (el.tagName === "H3") { el.style.fontSize = "16px"; el.style.fontWeight = "bold"; el.style.margin = "12px 0 6px"; }
        if (el.tagName === "P") { el.style.margin = "0 0 10px"; }
        if (el.tagName === "TABLE") { el.style.borderCollapse = "collapse"; el.style.width = "100%"; el.style.marginBottom = "10px"; }
        if (el.tagName === "TD" || el.tagName === "TH") { el.style.border = "1px solid #999"; el.style.padding = "6px"; }
      });

      // Wait for any images to load
      const imgs = renderArea.querySelectorAll("img");
      await Promise.all(Array.from(imgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => { img.onload = res; img.onerror = res; });
      }));

      progressFill.style.width = "45%";

      // Render to canvas
      const canvas = await html2canvas(renderArea, { scale: 2, useCORS: true });
      progressFill.style.width = "70%";

      // Paginate canvas into A4 PDF pages
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      progressFill.style.width = "95%";

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      progressFill.style.width = "100%";

      setTimeout(() => {
        progressWrap.classList.add("hidden");
        resultCard.classList.remove("hidden");
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.docx$/i, "") + ".pdf";
        resultMeta.textContent = `Your document was converted to a ${pdf.internal.getNumberOfPages()}-page PDF (${formatSize(blob.size)}).`;

        if (result.messages && result.messages.length > 0) {
          infoAlert.textContent = "Some elements (complex formatting or unsupported styles) may have been simplified during conversion.";
          infoAlert.classList.remove("hidden");
        }
      }, 300);

    } catch (err) {
      progressWrap.classList.add("hidden");
      showError(err.message || "Something went wrong while converting your document. Please try a different file.");
    } finally {
      convertBtn.disabled = false;
    }
  });

  resetBtn.addEventListener("click", reset);
})();
