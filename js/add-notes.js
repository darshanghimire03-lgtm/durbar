(function () {
  var MAX_PHOTOS = 6;
  var MAX_PDFS = 5;
  var MAX_LINKS = 5;
  var MAX_SIDE = 1600;
  var MAX_IMAGE_BYTES = 2900000;
  var MAX_PDF_BYTES = 10 * 1024 * 1024;
  var PHOTO_CONCURRENCY = 3;
  var PDF_CONCURRENCY = 2;
  var ROLES = ["professor", "moderator"];
  var YT_ID_PATTERN = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

  var PLUS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var FILE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>';

  var gate = document.getElementById("anGate");
  var form = document.getElementById("anForm");
  var backLink = document.getElementById("anBack");
  var ctxEl = document.getElementById("anCtx");
  var titleEl = document.getElementById("anTitle");
  var descEl = document.getElementById("anDesc");
  var charsEl = document.getElementById("anChars");
  var photoGrid = document.getElementById("anPhotoGrid");
  var photoCount = document.getElementById("anPhotoCount");
  var photoFile = document.getElementById("anPhotoFile");
  var pdfList = document.getElementById("anPdfList");
  var pdfCount = document.getElementById("anPdfCount");
  var pdfFile = document.getElementById("anPdfFile");
  var linkInput = document.getElementById("anLinkInput");
  var linkAdd = document.getElementById("anLinkAdd");
  var linksEl = document.getElementById("anLinks");
  var linkCount = document.getElementById("anLinkCount");
  var publishBtn = document.getElementById("anPublish");
  var toastEl = document.getElementById("anToast");

  var unitId = qs("unitId") || "";
  var subjectKey = qs("subjectKey") || "";
  var subjectName = qs("subjectName") || "";
  var unitNameParam = qs("unitName") || "";

  var currentUser = null;
  var photos = [];
  var pdfs = [];
  var links = [];
  var nextId = 1;
  var busy = false;
  var started = false;
  var toastTimer = null;

  function backUrl() {
    return "/html/notes.html?unitId=" + encodeURIComponent(unitId) +
           "&unitName=" + encodeURIComponent(unitNameParam) +
           "&subjectName=" + encodeURIComponent(subjectName) +
           "&subjectKey=" + encodeURIComponent(subjectKey);
  }

  backLink.href = unitId && subjectKey ? backUrl() : "/#subject";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
    }, 3400);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function denied(message) {
    gate.hidden = false;
    form.hidden = true;
    gate.textContent = "";
    gate.appendChild(document.createTextNode(message + " "));
    var a = el("a", "", "Go back");
    a.href = unitId && subjectKey ? backUrl() : "/#subject";
    gate.appendChild(a);
  }

  function updatePublishState() {
    publishBtn.disabled = busy || titleEl.value.trim().length < 2;
  }

  function setBusy(isBusy, label) {
    busy = isBusy;
    titleEl.disabled = isBusy;
    descEl.disabled = isBusy;
    linkInput.disabled = isBusy;
    linkAdd.disabled = isBusy;
    publishBtn.textContent = isBusy ? label : "Publish note";
    renderPhotos();
    renderPdfs();
    renderLinks();
    updatePublishState();
  }

  function removeButton(label, onClick) {
    var btn = el("button", "an-remove");
    btn.type = "button";
    btn.setAttribute("aria-label", label);
    btn.innerHTML = CLOSE_SVG;
    btn.disabled = busy;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderPhotos() {
    photoGrid.textContent = "";
    photos.forEach(function (it) {
      var tile = el("div", "an-tile");
      tile.classList.toggle("done", !!it.url);
      var img = document.createElement("img");
      img.alt = "";
      img.src = it.preview;
      tile.appendChild(img);
      tile.appendChild(removeButton("Remove photo", function () {
        if (busy) return;
        URL.revokeObjectURL(it.preview);
        photos = photos.filter(function (p) { return p.id !== it.id; });
        renderPhotos();
      }));
      photoGrid.appendChild(tile);
    });
    if (photos.length < MAX_PHOTOS) {
      var add = el("button", "an-add");
      add.type = "button";
      add.disabled = busy;
      add.innerHTML = PLUS_SVG;
      add.appendChild(el("span", "", "Add"));
      add.addEventListener("click", function () {
        if (!busy) photoFile.click();
      });
      photoGrid.appendChild(add);
    }
    photoCount.textContent = photos.length + "/" + MAX_PHOTOS;
  }

  function renderPdfs() {
    pdfList.textContent = "";
    pdfs.forEach(function (it) {
      var row = el("div", "an-pdf");
      row.classList.toggle("done", !!it.url);

      var icon = el("div", "an-pdf-icon");
      icon.innerHTML = FILE_SVG;
      row.appendChild(icon);

      var info = el("div", "an-pdf-info");
      info.appendChild(el("div", "an-pdf-name", it.file.name));
      info.appendChild(el("div", "an-pdf-meta", formatSize(it.file.size) + (it.url ? " \u00b7 Uploaded" : "")));
      row.appendChild(info);

      row.appendChild(removeButton("Remove PDF", function () {
        if (busy) return;
        pdfs = pdfs.filter(function (p) { return p.id !== it.id; });
        renderPdfs();
      }));
      pdfList.appendChild(row);
    });
    if (pdfs.length < MAX_PDFS) {
      var add = el("button", "an-add-pdf");
      add.type = "button";
      add.disabled = busy;
      add.innerHTML = PLUS_SVG;
      add.appendChild(el("span", "", "Add PDF"));
      add.addEventListener("click", function () {
        if (!busy) pdfFile.click();
      });
      pdfList.appendChild(add);
    }
    pdfCount.textContent = pdfs.length + "/" + MAX_PDFS;
  }

  function renderLinks() {
    linksEl.textContent = "";
    links.forEach(function (it) {
      var row = el("div", "an-link");
      var img = document.createElement("img");
      img.alt = "";
      img.src = "https://img.youtube.com/vi/" + it.id + "/hqdefault.jpg";
      row.appendChild(img);
      row.appendChild(el("div", "an-link-text", "youtu.be/" + it.id));
      row.appendChild(removeButton("Remove link", function () {
        if (busy) return;
        links = links.filter(function (l) { return l.id !== it.id; });
        renderLinks();
      }));
      linksEl.appendChild(row);
    });
    linkCount.textContent = links.length + "/" + MAX_LINKS;
  }

  function resizeImage(file) {
    var source = window.createImageBitmap
      ? createImageBitmap(file, { imageOrientation: "from-image" })
      : Promise.reject(new Error("unsupported"));
    return source.then(function (bmp) {
      var scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      var w = Math.max(1, Math.round(bmp.width * scale));
      var h = Math.max(1, Math.round(bmp.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve(blob || file);
        }, "image/jpeg", 0.85);
      });
    }).catch(function () {
      return file;
    });
  }

  function addPhotos(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return /^image\//.test(f.type);
    });
    if (!files.length) {
      toast("Please choose image files.");
      return;
    }
    var room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast("You can add up to " + MAX_PHOTOS + " photos.");
      return;
    }
    if (files.length > room) {
      toast("Only " + MAX_PHOTOS + " photos allowed. Extra photos were skipped.");
      files = files.slice(0, room);
    }
    Promise.all(files.map(resizeImage)).then(function (blobs) {
      var tooBig = 0;
      blobs.forEach(function (blob) {
        if (photos.length >= MAX_PHOTOS) return;
        if (blob.size > MAX_IMAGE_BYTES) {
          tooBig++;
          return;
        }
        photos.push({ id: nextId++, blob: blob, preview: URL.createObjectURL(blob), url: "" });
      });
      if (tooBig) toast(tooBig === 1 ? "One photo was too large and was skipped." : tooBig + " photos were too large and were skipped.");
      renderPhotos();
    });
  }

  function isPdf(file) {
    return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  }

  function addPdfs(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(isPdf);
    if (!files.length) {
      toast("Please choose PDF files.");
      return;
    }
    var room = MAX_PDFS - pdfs.length;
    if (room <= 0) {
      toast("You can add up to " + MAX_PDFS + " PDF files.");
      return;
    }
    if (files.length > room) {
      toast("Only " + MAX_PDFS + " PDF files allowed. Extra files were skipped.");
      files = files.slice(0, room);
    }
    var tooBig = 0;
    files.forEach(function (file) {
      if (file.size > MAX_PDF_BYTES) {
        tooBig++;
        return;
      }
      pdfs.push({ id: nextId++, file: file, url: "" });
    });
    if (tooBig) toast(tooBig === 1 ? "One PDF is over 10 MB and was skipped." : tooBig + " PDFs are over 10 MB and were skipped.");
    renderPdfs();
  }

  function addLink() {
    if (busy) return;
    var raw = linkInput.value.trim();
    if (!raw) return;
    var match = YT_ID_PATTERN.exec(raw);
    if (!match) {
      toast("Enter a valid YouTube link.");
      return;
    }
    var id = match[1];
    if (links.some(function (l) { return l.id === id; })) {
      toast("That video is already added.");
      return;
    }
    if (links.length >= MAX_LINKS) {
      toast("You can add up to " + MAX_LINKS + " videos.");
      return;
    }
    links.push({ id: id, url: "https://www.youtube.com/watch?v=" + id });
    linkInput.value = "";
    renderLinks();
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || "").split(",")[1] || "");
      };
      reader.onerror = function () {
        reject(new Error("Could not read image"));
      };
      reader.readAsDataURL(blob);
    });
  }

  function uploadPhoto(blob) {
    return Promise.all([blobToBase64(blob), currentUser.getIdToken()]).then(function (parts) {
      if (!parts[0]) throw new Error("Empty image");
      return fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + parts[1]
        },
        body: JSON.stringify({ image: parts[0] })
      });
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok || !data || !data.url) {
          throw new Error((data && data.error) || "Photo upload failed");
        }
        return data.url;
      });
    });
  }

  function uploadPdf(file) {
    var env = window.CLOUDINARY_ENV || {};
    if (!env.cloudName || !env.uploadPreset) {
      return Promise.reject(new Error("PDF upload is not configured"));
    }
    var data = new FormData();
    data.append("file", file);
    data.append("upload_preset", env.uploadPreset);
    data.append("public_id", "durbar/notes/" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + ".pdf");
    return fetch("https://api.cloudinary.com/v1_1/" + encodeURIComponent(env.cloudName) + "/raw/upload", {
      method: "POST",
      body: data
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok || !body || !body.secure_url) {
          throw new Error((body && body.error && body.error.message) || "PDF upload failed");
        }
        return body.secure_url;
      });
    });
  }

  function runPool(tasks, limit, worker, onDone) {
    var index = 0;
    var active = 0;
    var failure = null;
    return new Promise(function (resolve, reject) {
      if (!tasks.length) {
        resolve();
        return;
      }
      function settle() {
        if (failure) {
          if (active === 0) reject(failure);
          return;
        }
        if (index >= tasks.length) {
          if (active === 0) resolve();
          return;
        }
        launch();
      }
      function launch() {
        while (!failure && active < limit && index < tasks.length) {
          var task = tasks[index++];
          active++;
          worker(task).then(function () {
            onDone();
          }, function (err) {
            failure = failure || err;
          }).then(function () {
            active--;
            settle();
          });
        }
      }
      launch();
    });
  }

  function publish() {
    if (busy || !currentUser) return;
    var title = titleEl.value.trim();
    var description = descEl.value.trim();
    if (title.length < 2) {
      toast("Enter a title.");
      titleEl.focus();
      return;
    }
    if (!description && !photos.length && !pdfs.length && !links.length) {
      toast("Add a description, photo, PDF or video.");
      return;
    }

    var pendingPhotos = photos.filter(function (p) { return !p.url; });
    var pendingPdfs = pdfs.filter(function (p) { return !p.url; });
    var total = pendingPhotos.length + pendingPdfs.length;
    var done = 0;

    function progress() {
      done++;
      publishBtn.textContent = "Uploading " + done + "/" + total + "...";
      renderPhotos();
      renderPdfs();
    }

    setBusy(true, total ? "Uploading 0/" + total + "..." : "Publishing...");

    Promise.all([
      runPool(pendingPhotos, PHOTO_CONCURRENCY, function (item) {
        return uploadPhoto(item.blob).then(function (url) { item.url = url; });
      }, progress),
      runPool(pendingPdfs, PDF_CONCURRENCY, function (item) {
        return uploadPdf(item.file).then(function (url) { item.url = url; });
      }, progress)
    ]).then(function () {
      publishBtn.textContent = "Publishing...";
      var ref = notesRef(subjectKey, unitId).push();
      var data = {
        authorUid: currentUser.uid,
        title: title,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      if (description) data.description = description;
      if (photos.length) {
        data.photos = photos.map(function (p) { return { url: p.url }; });
      }
      if (pdfs.length) {
        data.pdfs = pdfs.map(function (p) {
          return { url: p.url, name: p.file.name, sizeBytes: p.file.size };
        });
      }
      if (links.length) {
        data.youtubeLinks = links.map(function (l, i) {
          return { url: l.url, videoId: l.id, videoNumber: i + 1 };
        });
      }
      return ref.set(data);
    }).then(function () {
      location.replace(backUrl());
    }).catch(function (err) {
      setBusy(false);
      toast("Couldn't publish: " + (err && err.message ? err.message : "try again"));
    });
  }

  backLink.addEventListener("click", function (e) {
    if (history.length > 1 && document.referrer && document.referrer.indexOf(location.host) !== -1) {
      e.preventDefault();
      history.back();
    }
  });

  titleEl.addEventListener("input", updatePublishState);

  descEl.addEventListener("input", function () {
    charsEl.textContent = String(descEl.value.length);
  });

  photoFile.addEventListener("change", function () {
    var files = photoFile.files;
    addPhotos(files);
    photoFile.value = "";
  });

  pdfFile.addEventListener("change", function () {
    var files = pdfFile.files;
    addPdfs(files);
    pdfFile.value = "";
  });

  linkAdd.addEventListener("click", addLink);

  linkInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addLink();
    }
  });

  publishBtn.addEventListener("click", publish);

  function start(user) {
    if (started) return;
    started = true;
    currentUser = user;

    if (!unitId || !subjectKey) {
      denied("Missing unit. Open this page from a unit's notes.");
      return;
    }

    db.ref("users").child(user.uid).once("value").then(function (snap) {
      var u = snap.val() || {};
      var role = String(u.role || "").trim().toLowerCase();
      var assigned = String(u.assignedSubject || "").trim();

      if (ROLES.indexOf(role) === -1) {
        denied("Only professors and moderators can add notes.");
        return;
      }
      if (!assigned) {
        denied("You don't have an assigned subject yet.");
        return;
      }
      if (sanitizeKey(assigned).toLowerCase() !== String(subjectKey).toLowerCase()) {
        denied("You can only add notes to your assigned subject (" + assigned + ").");
        return;
      }

      var unitRef;
      try {
        unitRef = unitsRef(subjectKey).child(unitId);
      } catch (e) {
        denied("Unit not found.");
        return;
      }

      return unitRef.once("value").then(function (unitSnap) {
        var unit = unitSnap.val();
        if (!unit || typeof unit !== "object") {
          denied("Unit not found.");
          return;
        }
        var unitName = typeof unit.name === "string" && unit.name ? unit.name : unitNameParam;
        unitNameParam = unitName;
        subjectName = assigned;
        ctxEl.textContent = assigned + " \u00b7 " + (unitName || "Unit");
        gate.hidden = true;
        form.hidden = false;
        renderPhotos();
        renderPdfs();
        renderLinks();
        updatePublishState();
      });
    }).catch(function () {
      denied("Could not check your access. Try again.");
    });
  }

  auth.onAuthStateChanged(function (user) {
    if (user) start(user);
  });
})();