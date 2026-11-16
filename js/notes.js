(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var FILE_PATH = "M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z";

  function extensionOf(name) {
    var dot = name.lastIndexOf(".");
    if (dot === -1 || dot === name.length - 1) return "";
    return name.substring(dot + 1).toLowerCase();
  }

  function getFileType(name) {
    var ext = extensionOf(name);
    if (ext === "pdf") return "pdf";
    if (ext === "doc" || ext === "docx") return "word";
    return "file";
  }

  function cleanTitle(name) {
    var ext = extensionOf(name);
    if (!ext) return name;
    return name.slice(0, -(ext.length + 1));
  }

  function formatFileSize(bytes) {
    if (bytes <= 0) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var size = bytes;
    var unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return unitIndex === 0 ? Math.trunc(size) + " " + units[unitIndex]
                           : size.toFixed(1) + " " + units[unitIndex];
  }

  function getFileLabel(name) {
    var ext = extensionOf(name);
    if (ext === "pdf") return "PDF";
    if (ext === "doc" || ext === "docx") return "DOC";
    return "FILE";
  }

  var YT_ID_PATTERN = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

  function extractVideoId(url) {
    var m = YT_ID_PATTERN.exec(url || "");
    return m ? m[1] : null;
  }

  function youtubeThumbUrl(videoId) {
    return "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function fileIconSvg() {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", FILE_PATH);
    s.appendChild(p);
    return s;
  }

  var listEl = document.getElementById("notesList");
  var comingSoonEl = document.getElementById("comingSoon");
  var unitNameEl = document.getElementById("unitName");
  var backLink = document.getElementById("backLink");

  var unitId = qs("unitId") || "";
  var unitName = qs("unitName") || "Unit";
  var subjectName = qs("subjectName") || "";
  var subjectKey = qs("subjectKey") || sanitizeKey(subjectName.toLowerCase().replaceAll(" ", "_"));

  unitNameEl.textContent = unitName;
  document.title = "Durbar \u00B7 " + unitName;

  backLink.href = "/html/unit.html?subjectName=" + encodeURIComponent(subjectName) +
                  "&subjectKey=" + encodeURIComponent(subjectKey);

  function renderPhotoCollage(container, photos, noteId, noteTitle) {
    if (!photos || photos.length === 0) return;

    var count = photos.length;
    var layoutClass = "layout-1";
    if (count === 2) layoutClass = "layout-2";
    else if (count === 3) layoutClass = "layout-3";
    else if (count === 4) layoutClass = "layout-4";
    else if (count >= 5) layoutClass = "layout-5";

    var collage = el("div", "photo-collage " + layoutClass);
    collage.setAttribute("role", "button");
    collage.setAttribute("tabindex", "0");
    collage.setAttribute("aria-label", "Open " + count + (count === 1 ? " photo" : " photos"));

    var photoUrls = photos.map(function (p) {
      return encodeURIComponent(p.url);
    }).join("||");
    var photoPageUrl = "/html/photo.html?photos=" + photoUrls +
                       "&note=" + encodeURIComponent(noteId || "") +
                       "&title=" + encodeURIComponent(noteTitle || "");

    function open() { window.location.href = photoPageUrl; }
    collage.addEventListener("click", open);
    collage.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    var displayCount = Math.min(count, 5);
    var remaining = count - 5;

    for (var i = 0; i < displayCount; i++) {
      var item = el("div", "collage-item");
      var img = document.createElement("img");
      img.src = photos[i].url;
      img.alt = "Photo " + (i + 1);
      img.loading = "lazy";
      item.appendChild(img);

      if (i === 4 && remaining > 0) {
        item.appendChild(el("div", "view-all-overlay", "+" + remaining + " more"));
      }

      collage.appendChild(item);
    }

    collage.appendChild(el("div", "photo-count-overlay", count + (count === 1 ? " photo" : " photos")));
    container.appendChild(collage);
  }

  function renderPdfs(container, pdfs) {
    if (!pdfs || pdfs.length === 0) return;
    var list = el("div", "file-list");

    pdfs.forEach(function (pdf) {
      var rawName = pdf.name || "document.pdf";
      var type = getFileType(rawName);
      var sizeText = pdf.sizeBytes > 0 ? formatFileSize(pdf.sizeBytes) : null;
      var label = getFileLabel(rawName);

      var row = el("div", "file-row");
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");

      function open(e) {
        if (e) e.stopPropagation();
        window.location.href = "/html/pdf.html?url=" + encodeURIComponent(pdf.url) +
                               "&name=" + encodeURIComponent(rawName) +
                               "&size=" + encodeURIComponent(sizeText || "\u2014") +
                               "&return=" + encodeURIComponent(window.location.pathname + window.location.search);
      }
      row.addEventListener("click", open);
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });

      var icon = el("div", "file-icon " + type);
      icon.appendChild(fileIconSvg());

      var info = el("div", "file-info");
      info.appendChild(el("div", "file-name", cleanTitle(rawName)));

      var meta = el("div", "file-meta");
      if (sizeText) {
        meta.appendChild(el("span", "", sizeText));
        meta.appendChild(el("span", "dot", "\u2022"));
      }
      meta.appendChild(el("span", "", label));
      info.appendChild(meta);

      row.appendChild(icon);
      row.appendChild(info);
      list.appendChild(row);
    });

    container.appendChild(list);
  }

  function renderYoutubeLinks(container, links) {
    if (!links || links.length === 0) return;
    var list = el("div", "yt-list");

    links.forEach(function (yt) {
      var videoId = yt.videoId || extractVideoId(yt.url) || "";
      var badge = yt.videoNumber > 0 ? ("VIDEO " + yt.videoNumber) : "VIDEO";

      var a = el("a", "yt-card");
      a.href = videoId ? ("https://www.youtube.com/watch?v=" + videoId) : yt.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      if (videoId) {
        var img = el("img", "yt-thumb");
        img.src = youtubeThumbUrl(videoId);
        img.alt = "YouTube thumbnail";
        img.loading = "lazy";
        a.appendChild(img);
      }

      var info = el("div", "yt-info");
      info.appendChild(el("span", "yt-badge", badge));
      info.appendChild(el("span", "yt-text", "Watch video"));
      a.appendChild(info);

      list.appendChild(a);
    });

    container.appendChild(list);
  }

  function mediaGroup(labelText) {
    var group = el("div", "media-group");
    if (labelText) group.appendChild(el("span", "media-label", labelText));
    return group;
  }

  function renderNote(note, position) {
    var card = el("div", "note-card");

    card.appendChild(el("div", "note-title", (position + 1) + ". " + (note.title || "Untitled")));
    card.appendChild(el("div", "note-divider"));

    if (note.description && note.description.trim() !== "") {
      card.appendChild(el("div", "note-description", note.description));
    }

    var mediaSection = el("div", "media-section");

    if (note.photos && note.photos.length > 0) {
      var photoGroup = mediaGroup("Photos");
      renderPhotoCollage(photoGroup, note.photos, note.id, note.title);
      mediaSection.appendChild(photoGroup);
    }

    if (note.youtubeLinks && note.youtubeLinks.length > 0) {
      var videoGroup = mediaGroup("Videos");
      renderYoutubeLinks(videoGroup, note.youtubeLinks);
      mediaSection.appendChild(videoGroup);
    }

    if (note.pdfs && note.pdfs.length > 0) {
      var pdfGroup = mediaGroup("");
      renderPdfs(pdfGroup, note.pdfs);
      mediaSection.appendChild(pdfGroup);
    }

    if (mediaSection.children.length > 0) {
      card.appendChild(mediaSection);
    }

    return card;
  }

  function updateEmptyState(hasNotes) {
    listEl.style.display = hasNotes ? "" : "none";
    comingSoonEl.style.display = hasNotes ? "none" : "block";
  }

  notesRef(subjectKey, unitId).once("value")
    .then(function (snapshot) {
      var notes = [];
      snapshot.forEach(function (child) {
        var noteData = child.val();
        noteData.id = child.key;
        notes.push(noteData);
      });
      notes.sort(function (a, b) {
        return (a.createdAt || 0) - (b.createdAt || 0);
      });

      listEl.innerHTML = "";
      if (notes.length === 0) {
        updateEmptyState(false);
        return;
      }

      notes.forEach(function (note, position) {
        listEl.appendChild(renderNote(note, position));
      });
      updateEmptyState(true);
    })
    .catch(function (err) {
      console.error("loadNotes cancelled: " + err.message);
      listEl.innerHTML = "";
      updateEmptyState(false);
    });
})();