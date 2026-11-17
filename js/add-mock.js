(function () {
  var SUBJECT_LIST = ["Economic", "Account", "Computer Science", "English", "Nepali"];
  var STAFF_ROLES = ["professor", "moderator"];
  var OPTION_COUNT = 4;
  var MAX_PHOTOS = 4;
  var MAX_BASE64 = 3900000;
  var ATTEMPTS = [[1600, 0.82], [1280, 0.72], [960, 0.62], [720, 0.55]];
  var LABELS = ["A", "B", "C", "D"];

  var ICON = {
    expand: '<svg class="am-exp" viewBox="0 0 24 24"><path d="M7.41,8.59L12,13.17l4.59,-4.58L18,10l-6,6 -6,-6 1.41,-1.41z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5 12,10.59 6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 12,13.41 17.59,19 19,17.59 13.41,12z"/></svg>'
  };

  var main = document.getElementById("amMain");
  var addBtn = document.getElementById("amAdd");
  var filePick = document.getElementById("amFile");
  var toastEl = null;
  var toastTimer = null;
  var userRef = null;
  var mocksStarted = false;
  var state = {
    currentUser: null,
    user: null,
    userLoaded: false,
    mocks: {},
    mocksLoaded: false,
    expanded: new Set()
  };

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "am-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2800);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanKey(raw) {
    return String(raw).replace(/[.#$\[\]]/g, "_");
  }

  function norm(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function flatten(mocks) {
    var list = [];
    Object.keys(mocks || {}).forEach(function (key) {
      var node = mocks[key] || {};
      var nodeSubject = node.subject || key;
      var qs = node.questions || {};
      Object.keys(qs).forEach(function (qid) {
        var q = qs[qid];
        if (!q) return;
        list.push({
          questionId: q.questionId || qid,
          question: q.question || "",
          options: Array.isArray(q.options) ? q.options : Object.values(q.options || {}),
          answerIndex: typeof q.answerIndex === "number" ? q.answerIndex : 0,
          photos: Array.isArray(q.photos) ? q.photos : Object.values(q.photos || {}),
          subject: q.subject || nodeSubject,
          nodeSubject: nodeSubject,
          nodeKey: key
        });
      });
    });
    return list;
  }

  function isStaff() {
    var role = String((state.user && state.user.role) || "").trim().toLowerCase();
    return STAFF_ROLES.indexOf(role) !== -1;
  }

  function assignedSubject() {
    var assigned = String((state.user && state.user.assignedSubject) || "").trim();
    if (!assigned) return "";
    var match = SUBJECT_LIST.filter(function (s) { return s.toLowerCase() === assigned.toLowerCase(); })[0];
    return match || assigned;
  }

  function canManage(subject) {
    if (!isStaff()) return false;
    var assigned = assignedSubject();
    if (!assigned) return false;
    return assigned.toLowerCase() === String(subject || "").trim().toLowerCase();
  }

  function visibleQuestions() {
    if (!state.userLoaded || !isStaff()) return [];
    var scope = assignedSubject();
    if (!scope) return [];
    var target = norm(scope);
    return flatten(state.mocks).filter(function (q) {
      return norm(q.subject) === target || norm(q.nodeSubject) === target;
    });
  }

  function render() {
    var staff = isStaff();
    var scope = assignedSubject();
    addBtn.hidden = !(state.userLoaded && staff && scope);

    if (!state.userLoaded || !state.mocksLoaded) {
      main.innerHTML = '<div class="am-state"><div class="am-spin"></div></div>';
      return;
    }

    var questions = visibleQuestions();
    if (!questions.length) {
      var text;
      if (!staff) text = "Only your subject's moderator or professor can manage questions";
      else if (!scope) text = "No subject is assigned to your account";
      else text = "No " + scope + " questions yet";
      main.innerHTML = (staff && scope ? '<div class="am-scope">' + esc(scope) + '</div>' : '') +
        '<div class="am-state">' + esc(text) + '</div>';
      return;
    }

    var scrollY = window.scrollY;
    main.innerHTML = '<div class="am-scope">' + esc(scope) + ' · ' + questions.length + ' questions</div>' +
      '<div class="am-list">' + questions.map(function (q, i) { return cardHtml(q, i); }).join("") + '</div>';
    Array.prototype.forEach.call(main.querySelectorAll(".am-card"), function (el) { bindCard(el, questions); });
    window.scrollTo(0, scrollY);
  }

  function cardHtml(q, index) {
    var key = q.questionId || (q.subject + "#" + index);
    var open = state.expanded.has(key);
    var photos = (q.photos || []).slice(0, MAX_PHOTOS);
    var manage = canManage(q.subject);
    return '<div class="am-card' + (open ? ' open' : '') + '" data-key="' + esc(key) + '" data-id="' + esc(q.questionId) + '">' +
      '<div class="am-top"><div class="am-subj">' + esc(q.subject) + '  •  Q' + (index + 1) + '</div>' + ICON.expand + '</div>' +
      '<div class="am-qt">' + esc(q.question) + '</div>' +
      (photos.length ? '<div class="am-photos">' + photos.map(function (u) { return '<img src="' + esc(u) + '" alt="">'; }).join("") + '</div>' : '') +
      '<div class="am-hint">Tap to view options and answer</div>' +
      '<div class="am-details">' +
      q.options.slice(0, OPTION_COUNT).map(function (o, i) {
        return i === q.answerIndex
          ? '<div class="am-od ok">' + LABELS[i] + '. ' + esc(o) + '  ✓</div>'
          : '<div class="am-od">' + LABELS[i] + '. ' + esc(o) + '</div>';
      }).join("") +
      (manage ? '<div class="am-acts"><button class="am-act" type="button" data-act="edit">Edit</button><button class="am-act del" type="button" data-act="delete">Delete</button></div>' : '') +
      '</div></div>';
  }

  function bindCard(el, questions) {
    var timer = null;
    var longFired = false;
    var sx = 0;
    var sy = 0;
    var q = questions.filter(function (item) { return item.questionId === el.getAttribute("data-id"); })[0];
    function clear() { clearTimeout(timer); timer = null; }

    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".am-act")) return;
      longFired = false;
      sx = e.clientX;
      sy = e.clientY;
      clear();
      timer = setTimeout(function () {
        longFired = true;
        if (q) openOptionsDialog(q);
      }, 550);
    });
    el.addEventListener("pointermove", function (e) {
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) clear();
    });
    el.addEventListener("pointerup", clear);
    el.addEventListener("pointercancel", clear);
    el.addEventListener("pointerleave", clear);
    el.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      clear();
      if (q && !longFired) {
        longFired = true;
        openOptionsDialog(q);
      }
    });
    el.addEventListener("click", function (e) {
      var act = e.target.closest(".am-act");
      if (act) {
        e.stopPropagation();
        if (!q) return;
        if (act.getAttribute("data-act") === "edit") openQuestionDialog(q);
        else openDeleteDialog(q);
        return;
      }
      if (longFired) {
        longFired = false;
        return;
      }
      var key = el.getAttribute("data-key");
      if (state.expanded.has(key)) state.expanded.delete(key);
      else state.expanded.add(key);
      el.classList.toggle("open");
    });
  }

  function showDialog(html) {
    var overlay = document.createElement("div");
    overlay.className = "am-scrim";
    overlay.innerHTML = '<div class="am-dlg">' + html + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay && !overlay.locked) overlay.remove();
    });
    return overlay;
  }

  function openOptionsDialog(q) {
    if (!canManage(q.subject)) return;
    var dlg = showDialog('<h2>Question Options</h2>' +
      '<div class="am-row" id="amOptEdit" style="margin-top:12px">Edit</div>' +
      '<div class="am-row del" id="amOptDelete">Delete</div>');
    dlg.querySelector("#amOptEdit").onclick = function () { dlg.remove(); openQuestionDialog(q); };
    dlg.querySelector("#amOptDelete").onclick = function () { dlg.remove(); openDeleteDialog(q); };
  }

  function openDeleteDialog(q) {
    if (!canManage(q.subject)) return;
    var dlg = showDialog('<h2>Delete Question</h2><p>Are you sure you want to delete this question?</p>' +
      '<div class="am-dact"><button class="am-dbtn cancel" id="amDCancel" type="button">Cancel</button><button class="am-dbtn danger" id="amDOk" type="button">Delete</button></div>');
    dlg.querySelector("#amDCancel").onclick = function () { dlg.remove(); };
    dlg.querySelector("#amDOk").onclick = function () {
      dlg.remove();
      if (!q.questionId) {
        toast("Failed: missing question id");
        return;
      }
      removeQuestion(q).then(function () {
        toast("Question deleted");
      }).catch(function (e) {
        toast("Failed: " + (e.message || e));
      });
    };
  }

  function removeQuestion(q) {
    var nodeKey = q.nodeKey || cleanKey(q.subject);
    return db.ref("mocks").child(nodeKey).child("questions").child(q.questionId).remove();
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
      img.src = url;
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "").split(",")[1] || ""); };
      reader.onerror = function () { reject(new Error("Could not read image")); };
      reader.readAsDataURL(blob);
    });
  }

  function encodeImage(img, attempt) {
    var maxDim = ATTEMPTS[attempt][0];
    var quality = ATTEMPTS[attempt][1];
    var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, "image/jpeg", quality);
    }).then(function (blob) {
      if (!blob) throw new Error("Image error");
      return blobToBase64(blob);
    }).then(function (b64) {
      if (!b64) throw new Error("Empty image");
      if (b64.length <= MAX_BASE64) return b64;
      if (attempt < ATTEMPTS.length - 1) return encodeImage(img, attempt + 1);
      throw new Error("Image is too large");
    });
  }

  function uploadPhoto(file) {
    return loadImage(file).then(function (img) {
      return encodeImage(img, 0);
    }).then(function (b64) {
      return state.currentUser.getIdToken().then(function (token) {
        return fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({ image: b64 })
        });
      });
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok || !data || !data.url) throw new Error((data && data.error) || "Upload failed");
        return data.url;
      });
    });
  }

  function uploadAll(files) {
    var urls = [];
    return files.reduce(function (chain, file) {
      return chain.then(function () {
        return uploadPhoto(file).then(function (url) { urls.push(url); });
      });
    }, Promise.resolve()).then(function () { return urls; });
  }

  function openQuestionDialog(editing) {
    if (!isStaff()) {
      toast("Only your subject's moderator or professor can manage questions");
      return;
    }
    var locked = editing ? editing.subject : assignedSubject();
    if (!locked) {
      toast("No subject is assigned to your account");
      return;
    }
    if (!canManage(locked)) {
      toast("You can only manage questions of your assigned subject");
      return;
    }

    var existing = editing ? (editing.photos || []).slice(0, MAX_PHOTOS) : [];
    var picked = [];
    var names = ["Option A", "Option B", "Option C", "Option D"];

    var dlg = showDialog(
      '<h2>' + (editing ? "Edit Mock Question" : "Add Mock Question") + '</h2>' +
      '<div class="am-locked">' + (editing ? "Editing: " : "Adding to: ") + esc(locked) + '</div>' +
      '<textarea class="am-edit" id="amQuestion" placeholder="Question"></textarea>' +
      '<div class="am-phead"><div class="am-lbl" id="amPhotoLabel">Photos (0/4)</div><div class="am-addp" id="amAddPhoto">Add photo</div></div>' +
      '<div class="am-slots" id="amSlots"></div>' +
      '<div class="am-lbl">Options (tap the circle for the right answer)</div>' +
      names.map(function (l, i) {
        return '<div class="am-orow"><input type="radio" name="amAnswer" id="amRb' + i + '"><input class="am-edit" id="amOpt' + i + '" type="text" placeholder="' + l + '"></div>';
      }).join("") +
      '<div class="am-dend"><button class="am-dbtn cancel" id="amCancel" type="button">Cancel</button><button class="am-dbtn ok" id="amSave" type="button">' + (editing ? "Update" : "Save") + '</button></div>'
    );

    var fQuestion = dlg.querySelector("#amQuestion");
    var fSave = dlg.querySelector("#amSave");
    var fCancel = dlg.querySelector("#amCancel");
    var fAdd = dlg.querySelector("#amAddPhoto");
    var slots = dlg.querySelector("#amSlots");
    var photoLabel = dlg.querySelector("#amPhotoLabel");
    var radios = [0, 1, 2, 3].map(function (i) { return dlg.querySelector("#amRb" + i); });
    var fields = [0, 1, 2, 3].map(function (i) { return dlg.querySelector("#amOpt" + i); });

    if (editing) {
      fQuestion.value = editing.question;
      fields.forEach(function (f, i) { f.value = editing.options[i] || ""; });
      if (radios[editing.answerIndex]) radios[editing.answerIndex].checked = true;
    }

    function releasePreviews() {
      picked.forEach(function (p) { URL.revokeObjectURL(p.preview); });
    }

    function refreshPhotos() {
      var combined = existing.map(function (u) { return { src: u }; }).concat(picked.map(function (p) { return { src: p.preview }; }));
      var html = "";
      for (var i = 0; i < MAX_PHOTOS; i++) {
        if (i < combined.length) {
          html += '<div class="am-slot"><img src="' + esc(combined[i].src) + '" alt=""><div class="am-x" data-i="' + i + '">' + ICON.close + '</div></div>';
        } else {
          html += '<div class="am-slot"></div>';
        }
      }
      slots.innerHTML = html;
      photoLabel.textContent = "Photos (" + combined.length + "/" + MAX_PHOTOS + ")";
      fAdd.style.display = combined.length >= MAX_PHOTOS ? "none" : "";
      Array.prototype.forEach.call(slots.querySelectorAll(".am-x"), function (x) {
        x.onclick = function () {
          var i = parseInt(x.getAttribute("data-i"), 10);
          if (i < existing.length) {
            existing.splice(i, 1);
          } else {
            var pi = i - existing.length;
            if (pi >= 0 && pi < picked.length) {
              URL.revokeObjectURL(picked[pi].preview);
              picked.splice(pi, 1);
            }
          }
          refreshPhotos();
        };
      });
    }
    refreshPhotos();

    fAdd.onclick = function () {
      if (existing.length + picked.length >= MAX_PHOTOS) {
        toast("Maximum " + MAX_PHOTOS + " photos allowed");
        return;
      }
      filePick.value = "";
      filePick.onchange = function () {
        var files = Array.prototype.slice.call(filePick.files || []);
        if (!files.length) return;
        var remaining = MAX_PHOTOS - (existing.length + picked.length);
        if (files.length > remaining) toast("Only " + remaining + " more photo(s) allowed");
        files.slice(0, remaining).forEach(function (file) {
          picked.push({ file: file, preview: URL.createObjectURL(file) });
        });
        refreshPhotos();
      };
      filePick.click();
    };

    fCancel.onclick = function () {
      releasePreviews();
      dlg.remove();
    };

    fSave.onclick = function () {
      var questionText = fQuestion.value.trim();
      var options = fields.map(function (f) { return f.value.trim(); });
      var answerIndex = radios.findIndex(function (r) { return r.checked; });

      if (!questionText) { fQuestion.focus(); toast("Enter the question"); return; }
      if (options.some(function (o) { return !o; })) { toast("Fill all " + OPTION_COUNT + " options"); return; }
      if (answerIndex < 0) { toast("Select the right answer"); return; }
      if (!state.currentUser) { toast("You must be signed in"); return; }
      if (!canManage(locked)) { toast("You can only manage questions of your assigned subject"); return; }

      fSave.disabled = true;
      fCancel.disabled = true;
      fAdd.style.pointerEvents = "none";
      fSave.textContent = "Saving...";
      dlg.locked = true;

      function restore() {
        fSave.disabled = false;
        fCancel.disabled = false;
        fAdd.style.pointerEvents = "";
        fSave.textContent = editing ? "Update" : "Save";
        dlg.locked = false;
      }

      uploadAll(picked.map(function (p) { return p.file; })).then(function (urls) {
        return saveQuestion({
          existingId: editing && editing.questionId ? editing.questionId : null,
          nodeKey: editing && editing.nodeKey ? editing.nodeKey : null,
          subject: locked,
          question: questionText,
          options: options,
          answerIndex: answerIndex,
          photos: existing.concat(urls)
        });
      }).then(function () {
        toast(editing ? "Question updated" : "Question added to " + locked);
        releasePreviews();
        dlg.remove();
      }).catch(function (e) {
        restore();
        toast("Couldn't save: " + (e && e.message ? e.message : "unknown error"));
      });
    };
  }

  function saveQuestion(input) {
    var nodeKey = input.nodeKey || cleanKey(input.subject);
    var nodeRef = db.ref("mocks").child(nodeKey);
    var id = input.existingId || nodeRef.child("questions").push().key;
    if (!id) return Promise.reject(new Error("Could not create question id"));

    var question = {
      questionId: id,
      question: input.question,
      options: input.options,
      answerIndex: input.answerIndex,
      photos: input.photos,
      subject: input.subject
    };

    var valid = question.question.trim() !== "" &&
      question.options.length === OPTION_COUNT &&
      question.options.every(function (o) { return o.trim() !== ""; }) &&
      question.answerIndex >= 0 && question.answerIndex < OPTION_COUNT &&
      question.photos.length <= MAX_PHOTOS;
    if (!valid) return Promise.reject(new Error("Invalid question"));

    return nodeRef.child("subject").set(input.subject).then(function () {
      return nodeRef.child("questions").child(id).set(question);
    });
  }

  addBtn.addEventListener("click", function () { openQuestionDialog(null); });

  render();

  auth.onAuthStateChanged(function (user) {
    if (!user) return;
    state.currentUser = user;

    if (userRef) userRef.off();
    userRef = db.ref("users").child(user.uid);
    userRef.on("value", function (snap) {
      state.user = snap.val();
      state.userLoaded = true;
      render();
    }, function () {
      state.user = null;
      state.userLoaded = true;
      render();
    });

    if (!mocksStarted) {
      mocksStarted = true;
      db.ref("mocks").on("value", function (snap) {
        state.mocks = snap.val() || {};
        state.mocksLoaded = true;
        render();
      }, function (err) {
        state.mocks = {};
        state.mocksLoaded = true;
        toast("Couldn't load questions: " + err.message);
        render();
      });
    }
  });
})();