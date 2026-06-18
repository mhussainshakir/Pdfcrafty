// ===== PDFCrafty - Shared Layout Component =====
// Injects header & footer into every page, handles nav toggle & FAQ accordions.

(function () {
  const ICON_LOGO = `<div class="logo-icon">PC</div>`;

  const HEADER_HTML = `
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="logo">${ICON_LOGO}<span>PDF</span>Crafty</a>
      <nav class="main-nav" id="mainNav">
        <a href="/merge-pdf.html">Merge PDF</a>
        <a href="/split-pdf.html">Split PDF</a>
        <a href="/compress-pdf.html">Compress PDF</a>
        <a href="/pdf-to-word.html">PDF to Word</a>
        <a href="/all-tools.html">All Tools</a>
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
      </nav>
      <button class="nav-toggle" id="navToggle" aria-label="Menu">&#9776;</button>
    </div>
  </header>`;

  const FOOTER_HTML = `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-col">
        <h4>PDFCrafty</h4>
        <p>Free, fast, and private PDF tools that work entirely in your browser. No uploads, no signups, no limits.</p>
      </div>
      <div class="footer-col">
        <h4>Popular Tools</h4>
        <a href="/merge-pdf.html">Merge PDF</a>
        <a href="/split-pdf.html">Split PDF</a>
        <a href="/compress-pdf.html">Compress PDF</a>
        <a href="/pdf-to-word.html">PDF to Word</a>
        <a href="/word-to-pdf.html">Word to PDF</a>
      </div>
      <div class="footer-col">
        <h4>More Tools</h4>
        <a href="/pdf-to-jpg.html">PDF to JPG</a>
        <a href="/jpg-to-pdf.html">JPG to PDF</a>
        <a href="/rotate-pdf.html">Rotate PDF</a>
        <a href="/protect-pdf.html">Protect PDF</a>
        <a href="/unlock-pdf.html">Unlock PDF</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="/about.html">About Us</a>
        <a href="/contact.html">Contact</a>
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/terms.html">Terms of Service</a>
        <a href="/all-tools.html">All Tools</a>
      </div>
    </div>
    <div class="footer-bottom">
      &copy; ${new Date().getFullYear()} PDFCrafty. All files are processed locally in your browser — nothing is ever uploaded to a server.
    </div>
  </footer>`;

  document.addEventListener("DOMContentLoaded", function () {
    const headerMount = document.getElementById("site-header");
    const footerMount = document.getElementById("site-footer");
    if (headerMount) headerMount.innerHTML = HEADER_HTML;
    if (footerMount) footerMount.innerHTML = FOOTER_HTML;

    // Highlight active nav link
    const path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".main-nav a").forEach((a) => {
      if (a.getAttribute("href") === "/" + path) {
        a.style.color = "var(--primary)";
      }
    });

    // Mobile nav toggle
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("mainNav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => nav.classList.toggle("open"));
    }

    // FAQ accordion
    document.querySelectorAll(".faq-item").forEach((item) => {
      const q = item.querySelector(".faq-question");
      if (q) {
        q.addEventListener("click", () => {
          const isOpen = item.classList.contains("open");
          document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
          if (!isOpen) item.classList.add("open");
        });
      }
    });
  });
})();
