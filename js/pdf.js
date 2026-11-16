(function () {
  "use strict";

  var urlParams = new URLSearchParams(window.location.search);
  var pdfUrl = urlParams.get("url");
  var fileName = urlParams.get("name") || "document.pdf";
  var fileSize = urlParams.get("size") || "\u2014";
  var returnUrl = urlParams.get("return") || "/";

  var pdfFrame = document.getElementById("pdfFrame");
  var wrapper = document.getElementById("pdfWrapper");
  var loadingOverlay = document.getElementById("loadingOverlay");
  var errorState = document.getElementById("errorState");
  var errorText = document.getElementById("errorText");
  var zoomBtn = document.getElementById("zoomBtn");
  var zoomIcon = document.getElementById("zoomIcon");

  var loadTimer = null;
  var isZoomed = false;

  document.getElementById("pdfFileName").textContent = fileName;
  document.getElementById("pdfFileSize").textContent = fileSize;
  document.title = "Durbar \u00B7 " + fileName;

  if (!/^\/[A-Za-z0-9_\-\/.]*([?#][^\s]*)?$/.test(returnUrl) || returnUrl.indexOf("//") !== -1) {
    returnUrl = "/";
  }

  function showError(message) {
    clearTimeout(loadTimer);
    loadingOverlay.classList.add("hidden");
    errorState.classList.add("visible");
    if (message) errorText.textContent = message;
  }

  function loadPDF() {
    if (!pdfUrl) {
      showError("No PDF URL provided.");
      return;
    }

    errorState.classList.remove("visible");
    loadingOverlay.classList.remove("hidden");
    clearTimeout(loadTimer);

    pdfFrame.onload = function () {
      clearTimeout(loadTimer);
      setTimeout(function () { loadingOverlay.classList.add("hidden"); }, 600);
    };
    pdfFrame.src = "https://docs.google.com/gview?embedded=true&url=" + encodeURIComponent(pdfUrl);

    loadTimer = setTimeout(function () {
      showError("The PDF is taking too long to load. It may be unavailable.");
    }, 20000);
  }

  function goBack() {
    if (document.referrer && document.referrer.indexOf(window.location.hostname) !== -1 && history.length > 1) {
      history.back();
    } else {
      window.location.href = returnUrl;
    }
  }

  function openInNewTab() {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener");
  }

  function toggleZoom() {
    isZoomed = !isZoomed;
    wrapper.classList.toggle("zoomed", isZoomed);
    zoomBtn.setAttribute("aria-pressed", isZoomed ? "true" : "false");
    zoomIcon.className = isZoomed ? "fas fa-search-minus" : "fas fa-search-plus";
  }

  document.getElementById("backBtn").addEventListener("click", goBack);
  document.getElementById("downloadBtn").addEventListener("click", function () {
    if (!pdfUrl) { showError("No PDF URL available to download."); return; }
    openInNewTab();
  });
  document.getElementById("retryBtn").addEventListener("click", loadPDF);
  document.getElementById("openBtn").addEventListener("click", openInNewTab);
  zoomBtn.addEventListener("click", toggleZoom);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") goBack();
  });

  loadPDF();
})();