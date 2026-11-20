(function () {
  var MAX_PHOTOS = 8;
  var MAX_SIDE = 1600;
  var MAX_BLOB_BYTES = 2900000;
  var CONCURRENCY = 3;
  var HOME_URL = "/home/";
  var DEFAULT_AVATAR = "/favicon.png";

  var gate = document.getElementById("apGate");
  var form = document.getElementById("apForm");
  var backLink = document.getElementById("apBack");
  var avatarEl = document.getElementById("apAvatar");
  var nameEl = document.getElementById("apName");
  var roleEl = document.getElementById("apRole");
  var audienceEl = document.getElementById("apAudience");
  var textEl = document.getElementById("apText");
  var charsEl = document.getElementById("apChars");
  var countEl = document.getElementById("apPhotoCount");
  var gridEl = document.getElementById("apGrid");
  var fileInput = document.getElementById("apFile");
  var postBtn = document.getElementById("apPost");
  var toastEl = document.getElementById("apToast");

  var currentUser = null;
  var items = [];
  var audience = "everyone";
  var busy = false;
  var nextId = 1;
  var started = false;
  var toastTimer = null;

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
    }, 3200);
  }

  function sectionsOf(value) {
    return String(value || "").split(",").map(function (s) {
      return s.replace(/^section/i, "").trim().toUpperCase();
    }).filter(Boolean);
  }

  function updatePostState() {
    var empty = !textEl.value.trim() && !items.length;
    postBtn.disabled = busy || empty;
  }

  function setBusy(isBusy, label) {
    busy = isBusy;
    textEl.disabled = isBusy;
    postBtn.textContent = isBusy ? label : "Post";
    Array.prototype.forEach.call(audienceEl.querySelectorAll("button"), function (b) {
      b.disabled = isBusy;
    });
    renderGrid();
    updatePostState();
  }

  function renderAudience(sections) {
    var options = [{ value: "everyone", label: "Everyone" }];
    sections.forEach(function (s) {
      options.push({ value: "section " + s, label: "Section " + s });
    });
    audienceEl.textContent = "";
    options.forEach(function (opt) {
      var btn = el("button", "ap-chip", opt.label);
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", opt.value === audience ? "true" : "false");
      btn.classList.toggle("on", opt.value === audience);
      btn.addEventListener("click", function () {
        audience = opt.value;
        Array.prototype.forEach.call(audienceEl.children, function (child, i) {
          var active = options[i].value === audience;
          child.classList.toggle("on", active);
          child.setAttribute("aria-checked", active ? "true" : "false");
        });
      });
      audienceEl.appendChild(btn);
    });
  }

  var PLUS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function removeItem(id) {
    if (busy) return;
    items = items.filter(function (it) {
      if (it.id !== id) return true;
      URL.revokeObjectURL(it.preview);
      return false;
    });
    renderGrid();
    updatePostState();
  }

  function renderGrid() {
    gridEl.textContent = "";
    items.forEach(function (it) {
      var tile = el("div", "ap-tile");
      tile.classList.toggle("done", !!it.url);
      var img = document.createElement("img");
      img.alt = "";
      img.src = it.preview;
      tile.appendChild(img);
      var rm = el("button", "ap-remove");
      rm.type = "button";
      rm.setAttribute("aria-label", "Remove photo");
      rm.innerHTML = CLOSE_SVG;
      rm.disabled = busy;
      rm.addEventListener("click", function () {
        removeItem(it.id);
      });
      tile.appendChild(rm);
      gridEl.appendChild(tile);
    });
    if (items.length < MAX_PHOTOS) {
      var add = el("button", "ap-add");
      add.type = "button";
      add.disabled = busy;
      add.innerHTML = PLUS_SVG;
      add.appendChild(el("span", "", "Add"));
      add.addEventListener("click", function () {
        if (!busy) fileInput.click();
      });
      gridEl.appendChild(add);
    }
    countEl.textContent = items.length + "/" + MAX_PHOTOS;
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

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return /^image\//.test(f.type);
    });
    if (!files.length) {
      toast("Please choose image files.");
      return;
    }
    var room = MAX_PHOTOS - items.length;
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
        if (items.length >= MAX_PHOTOS) return;
        if (blob.size > MAX_BLOB_BYTES) {
          tooBig++;
          return;
        }
        items.push({ id: nextId++, blob: blob, preview: URL.createObjectURL(blob), url: "" });
      });
      if (tooBig) toast(tooBig === 1 ? "One photo was too large and was skipped." : tooBig + " photos were too large and were skipped.");
      renderGrid();
      updatePostState();
    });
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

  function uploadImage(blob) {
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
          throw new Error((data && data.error) || "Upload failed");
        }
        return data.url;
      });
    });
  }

  function uploadPending(onProgress) {
    var pending = items.filter(function (it) { return !it.url; });
    var done = items.length - pending.length;
    var index = 0;
    var active = 0;
    var failure = null;

    return new Promise(function (resolve, reject) {
      if (!pending.length) {
        resolve();
        return;
      }
      function next() {
        if (failure) {
          if (active === 0) reject(failure);
          return;
        }
        if (index >= pending.length) {
          if (active === 0) resolve();
          return;
        }
        var item = pending[index++];
        active++;
        uploadImage(item.blob).then(function (url) {
          item.url = url;
          done++;
          onProgress(done);
        }).catch(function (err) {
          failure = failure || err;
        }).then(function () {
          active--;
          next();
        });
        if (active < CONCURRENCY) next();
      }
      next();
    });
  }

  function submit() {
    if (busy || !currentUser) return;
    var text = textEl.value.trim();
    if (!text && !items.length) {
      toast("Write something or add a photo.");
      return;
    }
    var total = items.length;
    setBusy(true, total ? "Uploading 0/" + total + "..." : "Posting...");

    uploadPending(function (n) {
      postBtn.textContent = "Uploading " + n + "/" + total + "...";
      renderGrid();
    }).then(function () {
      postBtn.textContent = "Posting...";
      var ref = db.ref("posts").push();
      var data = {
        postId: ref.key,
        authorUid: currentUser.uid,
        text: text,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        privacy: audience
      };
      if (items.length) {
        data.photos = items.map(function (it) { return it.url; });
      }
      return ref.set(data);
    }).then(function () {
      location.replace(HOME_URL);
    }).catch(function (err) {
      setBusy(false);
      renderGrid();
      var msg = err && err.message ? err.message : "try again";
      toast("Couldn't post: " + msg);
    });
  }

  backLink.addEventListener("click", function (e) {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  textEl.addEventListener("input", function () {
    charsEl.textContent = String(textEl.value.length);
    updatePostState();
  });

  fileInput.addEventListener("change", function () {
    var files = fileInput.files;
    addFiles(files);
    fileInput.value = "";
  });

  postBtn.addEventListener("click", submit);

  function start(user) {
    if (started) return;
    started = true;
    currentUser = user;

    db.ref("users").child(user.uid).once("value").then(function (snap) {
      return snap.val() || {};
    }).catch(function () {
      return {};
    }).then(function (u) {
      var name = (typeof u.fullName === "string" && u.fullName.trim()) || user.displayName || (user.email ? user.email.split("@")[0] : "Durbar User");
      var photo = (typeof u.profileImageUrl === "string" && u.profileImageUrl) || user.photoURL || DEFAULT_AVATAR;
      var role = typeof u.role === "string" ? u.role : "";

      nameEl.textContent = name;
      roleEl.textContent = role;
      roleEl.hidden = !role;
      avatarEl.onerror = function () {
        avatarEl.onerror = null;
        avatarEl.src = DEFAULT_AVATAR;
      };
      avatarEl.src = photo;

      renderAudience(sectionsOf(u.section));
      renderGrid();
      updatePostState();

      gate.hidden = true;
      form.hidden = false;
    });
  }

  auth.onAuthStateChanged(function (user) {
    if (user) start(user);
  });
})();