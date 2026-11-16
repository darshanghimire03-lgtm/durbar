(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var photosParam = params.get("photos") || "";
  var title = params.get("title") || "Photos";

  var photos = [];
  if (photosParam) {
    photos = photosParam.split("||").map(function (u) {
      try { return decodeURIComponent(u); } catch (e) { return u; }
    }).filter(Boolean);
  }

  var grid = document.getElementById("photoGrid");
  var emptyState = document.getElementById("emptyState");
  var overlay = document.getElementById("lightboxOverlay");
  var lbImage = document.getElementById("lightboxImage");
  var lbCounter = document.getElementById("lightboxCounter");
  var gridBtn = document.getElementById("gridBtn");

  document.getElementById("noteTitle").textContent = title;
  document.title = "Durbar \u00B7 " + title;
  document.getElementById("photoCounter").textContent = photos.length + (photos.length === 1 ? " photo" : " photos");

  var currentIndex = 0;
  var isOpen = false;

  function goBack() {
    if (document.referrer && document.referrer.indexOf(window.location.hostname) !== -1 && history.length > 1) {
      history.back();
    } else {
      window.location.href = "/";
    }
  }

  function show(index) {
    currentIndex = (index + photos.length) % photos.length;
    lbImage.src = photos[currentIndex];
    lbCounter.textContent = (currentIndex + 1) + " / " + photos.length;
  }

  function openLightbox(index) {
    isOpen = true;
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
    show(index);
  }

  function closeLightbox() {
    isOpen = false;
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  document.getElementById("backBtn").addEventListener("click", goBack);

  if (photos.length === 0) {
    grid.hidden = true;
    gridBtn.hidden = true;
    emptyState.style.display = "flex";
    return;
  }

  photos.forEach(function (url, index) {
    var item = document.createElement("button");
    item.type = "button";
    item.className = "photo-item";
    item.setAttribute("aria-label", "Open photo " + (index + 1));

    var img = document.createElement("img");
    img.src = url;
    img.alt = "Photo " + (index + 1);
    img.loading = "lazy";

    var number = document.createElement("div");
    number.className = "photo-number";
    number.innerHTML = '<i class="fas fa-camera"></i> ' + (index + 1);

    item.appendChild(img);
    item.appendChild(number);
    item.addEventListener("click", function () { openLightbox(index); });
    grid.appendChild(item);
  });

  gridBtn.addEventListener("click", function () {
    var compact = grid.classList.toggle("compact");
    gridBtn.setAttribute("aria-pressed", compact ? "true" : "false");
  });

  document.getElementById("lbClose").addEventListener("click", closeLightbox);
  document.getElementById("lbPrev").addEventListener("click", function (e) { e.stopPropagation(); show(currentIndex - 1); });
  document.getElementById("lbNext").addEventListener("click", function (e) { e.stopPropagation(); show(currentIndex + 1); });

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeLightbox();
  });

  var startX = 0;
  var startY = 0;
  overlay.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  overlay.addEventListener("touchend", function (e) {
    if (!e.changedTouches.length || photos.length < 2) return;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      show(currentIndex + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") show(currentIndex - 1);
    else if (e.key === "ArrowRight") show(currentIndex + 1);
  });
})();