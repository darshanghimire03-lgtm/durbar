(function () {
  var NAMES = ["Baisakh", "Jestha", "Asadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  var SUBJ = typeof SUBJECTS !== "undefined" ? SUBJECTS : ["Economic", "Account", "Computer Science", "English", "Nepali"];
  var NATIONAL_NODE = "national_day";
  var ROLES = ["captain", "professor"];
  var BACK_URL = "/#calender";
  var TYPES = [
    { key: "test", label: "Test", color: "#EF6C00" },
    { key: "exam", label: "Exam", color: "#1A4FBF" },
    { key: "festival", label: "Festival", color: "#D32F2F" },
    { key: "national_day", label: "National Day", color: "#C2185B" },
    { key: "school_event", label: "School Event", color: "#2E7D32" },
    { key: "vacation", label: "Vacation", color: "#0288D1" },
    { key: "emergency", label: "Holiday", color: "#212121" }
  ];

  var params = new URLSearchParams(location.search);
  var pYear = parseInt(params.get("year"), 10) || 0;
  var pMonth = parseInt(params.get("month"), 10) || 1;
  var pDay = parseInt(params.get("day"), 10) || 1;
  var monthLens = (params.get("ml") || "").split(",").map(function (n) { return parseInt(n, 10); });
  var editPath = params.get("edit") || "";
  var currentUser = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function typeOf(k) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].key === k) return TYPES[i];
    return TYPES[2];
  }
  function mName(m) { return NAMES[m - 1] || ""; }
  function bsKey(y, m, d) { return y * 10000 + m * 100 + d; }
  function fromKey(k) { return { year: Math.floor(k / 10000), month: Math.floor(k / 100) % 100, day: k % 100 }; }
  function endOf(e) { return Math.max(e.startKey, e.endKey); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function txt(v, k) { return typeof v[k] === "string" ? v[k] : ""; }
  function num(v, k) { return typeof v[k] === "number" ? Math.trunc(v[k]) : null; }
  function monthLength(m) { return monthLens[m - 1] || 32; }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "ae-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function openLayer(html) {
    var scrim = document.createElement("div");
    scrim.className = "ae-scrim";
    scrim.innerHTML = html;
    document.body.appendChild(scrim);
    var api = { el: scrim, close: function () { scrim.remove(); } };
    scrim.addEventListener("mousedown", function (e) { if (e.target === scrim) api.close(); });
    return api;
  }
  function denied(msg) {
    $("aeForm").hidden = true;
    $("aeGate").style.display = "block";
    $("aeGate").innerHTML = esc(msg) + '<br><br><a href="' + BACK_URL + '">Back to calendar</a>';
  }

  function buildEvent(year, month, typeKey, id, v, path) {
    if (!v || typeof v !== "object") return null;
    var base = { id: id, type: typeKey, title: "", description: "", subjects: [], startTime: "", endTime: "", photoUrl: "", path: path };
    if (typeKey === "vacation") {
      var sm = num(v, "startMonth");
      if (sm == null) sm = month;
      var sd = num(v, "startDay");
      if (sd == null) return null;
      var em = num(v, "endMonth");
      if (em == null) em = sm;
      var ed = num(v, "endDay");
      if (ed == null) ed = sd;
      return Object.assign(base, { title: txt(v, "title"), description: txt(v, "description"), startKey: bsKey(year, sm, sd), endKey: bsKey(year, em, ed) });
    }
    var day = num(v, "day");
    if (day == null) return null;
    var key = bsKey(year, month, day);
    if (typeKey === "exam") {
      var subject = txt(v, "subject");
      return Object.assign(base, { subjects: subject ? [subject] : [], startTime: txt(v, "startTime"), endTime: txt(v, "endTime"), startKey: key, endKey: key });
    }
    if (typeKey === "test") {
      var subs = Object.keys(v.subjects || {}).map(function (k) { return v.subjects[k]; }).filter(function (s) { return typeof s === "string"; });
      return Object.assign(base, { subjects: subs, startKey: key, endKey: key });
    }
    if (typeKey === "festival") {
      return Object.assign(base, { title: txt(v, "title"), description: txt(v, "description"), photoUrl: txt(v, "photoUrl"), startKey: key, endKey: key });
    }
    if (typeKey === "school_event" || typeKey === "emergency") {
      return Object.assign(base, { title: txt(v, "title"), description: txt(v, "description"), startKey: key, endKey: key });
    }
    return null;
  }
  function loadEditing() {
    if (!editPath) return Promise.resolve(null);
    return db.ref("calendar/" + editPath).once("value").then(function (snap) {
      var v = snap.val();
      if (!v) return null;
      var parts = editPath.split("/");
      if (parts[0] === NATIONAL_NODE) {
        var m = num(v, "month"), d = num(v, "day");
        if (m == null || d == null) return null;
        var k = bsKey(pYear, m, d);
        return { id: parts[1], type: "national_day", title: txt(v, "title"), description: txt(v, "description"), subjects: [], startTime: "", endTime: "", photoUrl: txt(v, "photoUrl"), startKey: k, endKey: k, path: editPath };
      }
      return buildEvent(parseInt(parts[0], 10), parseInt(parts[1], 10), parts[2], parts[3], v, editPath);
    });
  }
  function pathFor(ev) {
    var s = fromKey(ev.startKey);
    if (ev.type === "national_day") return NATIONAL_NODE + "/" + pad(s.month) + "-" + pad(s.day);
    return s.year + "/" + s.month + "/" + ev.type + "/" + ev.id;
  }
  function toDbMap(ev) {
    var s = fromKey(ev.startKey), n = fromKey(endOf(ev));
    switch (ev.type) {
      case "exam": return { id: ev.id, day: s.day, subject: ev.subjects[0] || "", startTime: ev.startTime, endTime: ev.endTime };
      case "test": return { id: ev.id, day: s.day, subjects: ev.subjects };
      case "festival": return { id: ev.id, day: s.day, title: ev.title, description: ev.description, photoUrl: ev.photoUrl };
      case "school_event":
      case "emergency": return { id: ev.id, day: s.day, title: ev.title, description: ev.description };
      case "vacation": return { id: ev.id, title: ev.title, description: ev.description, startMonth: s.month, startDay: s.day, endMonth: n.month, endDay: n.day };
      default: return { id: ev.id, title: ev.title, description: ev.description, photoUrl: ev.photoUrl, month: s.month, day: s.day };
    }
  }
  function saveEvent(ev, previousPath) {
    var newPath = pathFor(ev);
    var updates = {};
    if (previousPath && previousPath !== newPath) updates[previousPath] = null;
    updates[newPath] = toDbMap(ev);
    return db.ref("calendar").update(updates);
  }

  function pickMonthDay(m0, d0, cb) {
    var layer = openLayer('<div class="ae-dlg"><h3>Select month and day</h3>' +
      '<div class="ae-pick"><select id="aePm">' + NAMES.map(function (n, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === m0 ? " selected" : "") + ">" + n + "</option>"; }).join("") + '</select><select id="aePd"></select></div>' +
      '<div class="ae-btns"><button class="ae-btn" type="button" data-c>Cancel</button><button class="ae-btn p" type="button" id="aePOk">OK</button></div></div>');
    var pm = layer.el.querySelector("#aePm"), pd = layer.el.querySelector("#aePd");
    function fillDays(keep) {
      var max = monthLength(parseInt(pm.value, 10));
      var html = "";
      for (var i = 1; i <= max; i++) html += '<option value="' + i + '">' + i + "</option>";
      pd.innerHTML = html;
      pd.value = String(Math.min(keep, max));
    }
    fillDays(d0);
    pm.onchange = function () { fillDays(parseInt(pd.value, 10)); };
    layer.el.querySelector("[data-c]").onclick = function () { layer.close(); };
    layer.el.querySelector("#aePOk").onclick = function () { layer.close(); cb(parseInt(pm.value, 10), parseInt(pd.value, 10)); };
  }
  function pickSubjects(type, selected, cb) {
    var single = type === "exam";
    var layer = openLayer('<div class="ae-dlg"><h3>Subject</h3><div class="ae-sl">' +
      SUBJ.map(function (s) { return '<label class="ae-si"><input type="' + (single ? "radio" : "checkbox") + '" name="aeSub" value="' + esc(s) + '"' + (selected.indexOf(s) !== -1 ? " checked" : "") + ">" + esc(s) + "</label>"; }).join("") +
      '</div><div class="ae-btns"><button class="ae-btn" type="button" data-c>Cancel</button><button class="ae-btn p" type="button" id="aeSOk">Done</button></div></div>');
    layer.el.querySelector("[data-c]").onclick = function () { layer.close(); };
    layer.el.querySelector("#aeSOk").onclick = function () {
      var vals = Array.prototype.map.call(layer.el.querySelectorAll("input:checked"), function (i) { return i.value; });
      layer.close();
      cb(vals);
    };
  }

  function resizeImage(file, maxSide) {
    var source = window.createImageBitmap
      ? createImageBitmap(file, { imageOrientation: "from-image" })
      : Promise.reject(new Error("unsupported"));
    return source.then(function (bmp) {
      var scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      var w = Math.round(bmp.width * scale);
      var h = Math.round(bmp.height * scale);
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) { resolve(blob || file); }, "image/jpeg", 0.82);
      });
    }).catch(function () { return file; });
  }
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "").split(",")[1] || ""); };
      reader.onerror = function () { reject(new Error("Could not read image")); };
      reader.readAsDataURL(blob);
    });
  }
  function uploadImage(blob) {
    return Promise.all([blobToBase64(blob), currentUser.getIdToken()]).then(function (parts) {
      if (!parts[0]) throw new Error("Empty image");
      return fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + parts[1] },
        body: JSON.stringify({ image: parts[0] })
      });
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok || !data || !data.url) throw new Error((data && data.error) || "Upload failed");
        return data.url;
      });
    });
  }

  function initForm(editing, role) {
    $("aeGate").style.display = "none";
    $("aeForm").hidden = false;
    $("aeRole").textContent = role;
    $("aeTitle").textContent = editing ? "Edit event" : "Add event";
    $("aeTypes").innerHTML = TYPES.map(function (t, i) { return '<button class="ae-chip" type="button" data-t="' + i + '">' + esc(t.label) + "</button>"; }).join("");
    var saveLabel = editing ? "Update event" : "Save event";
    $("aeSave").textContent = saveLabel;

    var type = editing ? editing.type : "festival";
    var date = editing ? fromKey(editing.startKey) : { year: pYear, month: pMonth, day: pDay };
    var eventYear = date.year;
    var es = editing ? fromKey(editing.startKey) : null;
    var ee = editing ? fromKey(endOf(editing)) : null;
    var rsM = es ? es.month : pMonth, rsD = es ? es.day : pDay;
    var reM = ee ? ee.month : pMonth, reD = ee ? ee.day : pDay;
    var startTime = editing ? editing.startTime : "";
    var endTime = editing ? editing.endTime : "";
    var photoUrl = editing ? editing.photoUrl : "";
    var pickedBlob = null, pickedPreview = "";
    var selected = editing ? editing.subjects.slice() : [];
    if (editing) {
      $("aeTitleIn").value = editing.title;
      $("aeDesc").value = editing.description;
    }

    function renderDates() {
      $("aeStart").textContent = mName(date.month) + " " + date.day;
      $("aeRs").textContent = mName(rsM) + " " + rsD;
      $("aeRe").textContent = mName(reM) + " " + reD;
      $("aeTs").value = startTime;
      $("aeTe").value = endTime;
    }
    function renderSubjects() { $("aeSubj").textContent = selected.length ? selected.join(", ") : "Subject"; }
    function renderPhoto() {
      var box = $("aePhoto");
      var src = pickedPreview || photoUrl;
      Array.prototype.forEach.call(box.querySelectorAll("img"), function (i) { i.remove(); });
      $("aeHint").style.display = src ? "none" : "block";
      if (src) {
        var im = document.createElement("img");
        im.src = src;
        box.appendChild(im);
      }
    }
    function applyType() {
      var usesSubjects = type === "test" || type === "exam";
      var usesText = !usesSubjects;
      var usesPhoto = type === "festival" || type === "national_day";
      if (type === "exam" && selected.length > 1) selected = [selected[0]];
      $("aeSubj").style.display = usesSubjects ? "block" : "none";
      $("aeTitleIn").style.display = usesText ? "block" : "none";
      $("aeMedia").style.display = usesText ? "grid" : "none";
      $("aeMedia").classList.toggle("has", usesPhoto);
      $("aePhoto").style.display = usesPhoto ? "flex" : "none";
      $("aeDesc").style.height = (usesPhoto || type === "vacation") ? "" : "96px";
      $("aeDate").style.display = type === "vacation" ? "none" : "block";
      $("aeRange").style.display = type === "vacation" ? "block" : "none";
      $("aeTime").style.display = type === "exam" ? "block" : "none";
      $("aeSave").style.background = typeOf(type).color;
      Array.prototype.forEach.call(document.querySelectorAll(".ae-chip"), function (c) {
        var t = TYPES[parseInt(c.dataset.t, 10)];
        var on = t.key === type;
        c.style.background = on ? t.color : "";
        c.style.color = on ? "#fff" : "";
      });
      renderSubjects();
      renderDates();
      renderPhoto();
    }
    applyType();

    $("aeTypes").onclick = function (ev) {
      var c = ev.target.closest(".ae-chip");
      if (!c) return;
      type = TYPES[parseInt(c.dataset.t, 10)].key;
      applyType();
    };
    $("aeSubj").onclick = function () {
      pickSubjects(type, selected, function (v) {
        selected = type === "exam" ? v.slice(0, 1) : v;
        renderSubjects();
      });
    };
    $("aeStart").onclick = function () {
      pickMonthDay(date.month, date.day, function (m, d) {
        date = { year: date.year, month: m, day: d };
        renderDates();
      });
    };
    $("aeRs").onclick = function () { pickMonthDay(rsM, rsD, function (m, d) { rsM = m; rsD = d; renderDates(); }); };
    $("aeRe").onclick = function () { pickMonthDay(reM, reD, function (m, d) { reM = m; reD = d; renderDates(); }); };
    $("aeTs").onchange = function (e) { startTime = e.target.value; };
    $("aeTe").onchange = function (e) { endTime = e.target.value; };
    $("aePhoto").onclick = function () { $("aeFile").click(); };
    $("aeFile").onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      if (!/^image\//.test(f.type)) { toast("Please choose an image file"); return; }
      resizeImage(f, 1080).then(function (blob) {
        pickedBlob = blob;
        if (pickedPreview) URL.revokeObjectURL(pickedPreview);
        pickedPreview = URL.createObjectURL(blob);
        renderPhoto();
      }).catch(function (err) { toast(err.message); });
    };

    function validate() {
      var title = $("aeTitleIn").value.trim();
      switch (type) {
        case "test": return selected.length ? null : "Choose a subject";
        case "exam":
          if (!selected.length) return "Choose a subject";
          if (!startTime) return "Select the starting time";
          if (!endTime) return "Select the ending time";
          if (endTime <= startTime) return "Ending time must be after the starting time";
          return null;
        case "festival":
        case "national_day":
          if (!title) return "Enter a title";
          if (!pickedBlob && !photoUrl) return "Upload a photo";
          return null;
        case "school_event":
        case "emergency": return title ? null : "Enter a title";
        case "vacation":
          if (!title) return "Enter a title";
          if (reM * 100 + reD < rsM * 100 + rsD) return "End must be after the start";
          return null;
      }
      return null;
    }
    function commit(finalPhoto) {
      var btn = $("aeSave");
      var usesSubjects = type === "test" || type === "exam";
      var usesText = !usesSubjects;
      var usesPhoto = type === "festival" || type === "national_day";
      var startKey, endKey;
      if (type === "vacation") {
        startKey = bsKey(eventYear, rsM, rsD);
        endKey = bsKey(eventYear, reM, reD);
      } else if (type === "national_day") {
        startKey = bsKey(pYear || eventYear, date.month, date.day);
        endKey = startKey;
      } else {
        startKey = bsKey(date.year, date.month, date.day);
        endKey = startKey;
      }
      var id = type === "national_day" ? pad(date.month) + "-" + pad(date.day) : (editing && editing.type !== "national_day" ? editing.id : db.ref("calendar").push().key);
      var ev = {
        id: id,
        type: type,
        title: usesText ? $("aeTitleIn").value.trim() : "",
        description: usesText ? $("aeDesc").value.trim() : "",
        subjects: usesSubjects ? selected.slice() : [],
        startTime: type === "exam" ? startTime : "",
        endTime: type === "exam" ? endTime : "",
        photoUrl: usesPhoto ? finalPhoto : "",
        startKey: startKey,
        endKey: endKey
      };
      saveEvent(ev, editing ? editing.path : null).then(function () {
        toast(editing ? "Event updated" : "Event added");
        setTimeout(function () { location.href = BACK_URL; }, 700);
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = saveLabel;
        toast("Couldn't save: " + err.message);
      });
    }
    $("aeSave").onclick = function () {
      var err = validate();
      if (err) { toast(err); return; }
      var btn = $("aeSave");
      btn.disabled = true;
      var usesPhoto = type === "festival" || type === "national_day";
      if (usesPhoto && pickedBlob) {
        btn.textContent = "Uploading photo...";
        uploadImage(pickedBlob).then(function (url) {
          photoUrl = url;
          pickedBlob = null;
          commit(url);
        }).catch(function (e) {
          btn.disabled = false;
          btn.textContent = saveLabel;
          toast("Photo upload failed: " + e.message);
        });
      } else {
        commit(photoUrl);
      }
    };
  }

  auth.onAuthStateChanged(function (user) {
    if (!user) return;
    currentUser = user;
    db.ref("users").child(user.uid).child("role").once("value").then(function (snap) {
      var v = snap.val();
      var role = typeof v === "string" ? v.trim().toLowerCase() : "";
      if (ROLES.indexOf(role) === -1) { denied("Only captain or professor can add or edit events."); return; }
      if (!pYear) { denied("Missing date. Open this page from the calendar."); return; }
      return loadEditing().catch(function () { return null; }).then(function (editing) {
        if (editPath && !editing) { denied("This event could not be loaded."); return; }
        initForm(editing, role);
      });
    }).catch(function () { denied("Could not check your access. Try again."); });
  });
})();