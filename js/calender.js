(function () {
  var BASE_URL = "https://raw.githubusercontent.com/darshanghimire03-lgtm/Nepali_Bs_Calender/main/";
  var ADD_URL = "/html/add-event.html";
  var NAMES = ["Baisakh", "Jestha", "Asadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  var ENG = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var NATIONAL_NODE = "national_day";
  var ROLES = ["captain", "professor"];
  var TYPES = [
    { key: "test", label: "Test", color: "#EF6C00" },
    { key: "exam", label: "Exam", color: "#1A4FBF" },
    { key: "festival", label: "Festival", color: "#D32F2F" },
    { key: "national_day", label: "National Day", color: "#C2185B" },
    { key: "school_event", label: "School Event", color: "#2E7D32" },
    { key: "vacation", label: "Vacation", color: "#0288D1" },
    { key: "emergency", label: "Holiday", color: "#212121" }
  ];
  var MONTH_ALIASES = [
    [1, ["baisakh", "baishakh", "vaisakh", "baisak"]], [2, ["jestha", "jyestha", "jeth"]], [3, ["asadh", "ashadh", "asar", "asad"]],
    [4, ["shrawan", "srawan", "shravan", "saun"]], [5, ["bhadra", "bhadau", "bhado"]], [6, ["ashwin", "ashoj", "asoj", "aswin"]],
    [7, ["kartik", "kattik"]], [8, ["mangsir", "mangshir", "margashirsha"]], [9, ["poush", "paush", "push"]],
    [10, ["magh"]], [11, ["falgun", "phalgun", "fagun"]], [12, ["chaitra", "chait"]]
  ];

  var canManage = false;
  var started = false;
  var wired = false;
  var cache = {};
  var state = { year: 0, month: 1, today: null };
  var yearEvents = [];
  var national = [];
  var shownMonth = [];
  var shownAll = [];
  var listenedYear = 0;
  var yearRef = null;
  var yearCb = null;
  var nationalRef = null;
  var allRef = null;
  var allCb = null;
  var scrolledToUpcoming = false;

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
  function ord(e) { return TYPES.indexOf(typeOf(e.type)); }
  function mName(m) { return NAMES[m - 1] || ""; }
  function bsKey(y, m, d) { return y * 10000 + m * 100 + d; }
  function fromKey(k) { return { year: Math.floor(k / 10000), month: Math.floor(k / 100) % 100, day: k % 100 }; }
  function endOf(e) { return Math.max(e.startKey, e.endKey); }
  function covers(e, k) { return k >= e.startKey && k <= endOf(e); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function alpha(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function clock(v) {
    var p = String(v).split(":");
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return v;
    var s = h >= 12 ? "PM" : "AM";
    var t = h % 12 === 0 ? 12 : h % 12;
    return t + ":" + pad(m) + " " + s;
  }
  function timeText(e) {
    if (!e.startTime) return "";
    if (!e.endTime) return clock(e.startTime);
    return clock(e.startTime) + " - " + clock(e.endTime);
  }
  function part(d) { return mName(d.month) + " " + d.day; }
  function rangeText(e) {
    var s = fromKey(e.startKey), n = fromKey(endOf(e));
    if (e.startKey === endOf(e)) return part(s) + ", " + s.year;
    if (s.year === n.year) return part(s) + " - " + part(n) + ", " + s.year;
    return part(s) + ", " + s.year + " - " + part(n) + ", " + n.year;
  }
  function rangeNoYear(e) {
    var s = fromKey(e.startKey), n = fromKey(endOf(e));
    return e.startKey === endOf(e) ? part(s) : part(s) + " - " + part(n);
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "cl-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function progress(on) {
    var p = $("clProgress");
    if (p) p.hidden = !on;
  }

  function txt(v, k) { return typeof v[k] === "string" ? v[k] : ""; }
  function num(v, k) { return typeof v[k] === "number" ? Math.trunc(v[k]) : null; }

  function buildEvent(year, month, type, snap) {
    var v = snap.val();
    if (!v || typeof v !== "object") return null;
    var id = snap.key || "";
    var base = { id: id, type: type.key, title: "", description: "", subjects: [], startTime: "", endTime: "", photoUrl: "", path: year + "/" + month + "/" + type.key + "/" + id };
    var day, key;
    if (type.key === "vacation") {
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
    day = num(v, "day");
    if (day == null) return null;
    key = bsKey(year, month, day);
    if (type.key === "exam") {
      var subject = txt(v, "subject");
      return Object.assign(base, { title: subject ? subject + " Exam" : "Exam", subjects: subject ? [subject] : [], startTime: txt(v, "startTime"), endTime: txt(v, "endTime"), startKey: key, endKey: key });
    }
    if (type.key === "test") {
      var subs = Object.keys(v.subjects || {}).map(function (k) { return v.subjects[k]; }).filter(function (s) { return typeof s === "string"; });
      return Object.assign(base, { title: subs.length ? subs.join(" · ") + " Test" : "Test", subjects: subs, startKey: key, endKey: key });
    }
    if (type.key === "festival") {
      return Object.assign(base, { title: txt(v, "title"), description: txt(v, "description"), photoUrl: txt(v, "photoUrl"), startKey: key, endKey: key });
    }
    if (type.key === "school_event" || type.key === "emergency") {
      return Object.assign(base, { title: txt(v, "title"), description: txt(v, "description"), startKey: key, endKey: key });
    }
    return null;
  }
  function parseYearSnap(year, snap) {
    var out = [];
    snap.forEach(function (ms) {
      var month = parseInt(ms.key, 10);
      if (isNaN(month)) return false;
      ms.forEach(function (ts) {
        var type = TYPES.filter(function (t) { return t.key === ts.key; })[0];
        if (!type || type.key === NATIONAL_NODE) return false;
        ts.forEach(function (es) {
          var e = buildEvent(year, month, type, es);
          if (e) out.push(e);
          return false;
        });
        return false;
      });
      return false;
    });
    return out;
  }
  function parseNationalSnap(snap) {
    var out = [];
    snap.forEach(function (c) {
      var v = c.val();
      if (!v || typeof v !== "object") return false;
      var month = num(v, "month"), day = num(v, "day");
      if (month == null || day == null) return false;
      out.push({ id: txt(v, "id") || c.key || "", month: month, day: day, title: txt(v, "title"), description: txt(v, "description"), photoUrl: txt(v, "photoUrl"), path: NATIONAL_NODE + "/" + (c.key || "") });
      return false;
    });
    return out;
  }
  function nationalToEvent(n, year) {
    var k = bsKey(year, n.month, n.day);
    return { id: n.id, type: "national_day", title: n.title, description: n.description, subjects: [], startTime: "", endTime: "", photoUrl: n.photoUrl || "", startKey: k, endKey: k, path: n.path };
  }
  function removeEvent(path) {
    if (!canManage) return Promise.reject(new Error("Not allowed"));
    if (!path) return Promise.reject(new Error("Invalid event"));
    return db.ref("calendar").child(path).remove();
  }
  function listenNational() {
    if (nationalRef) return;
    nationalRef = db.ref("calendar/" + NATIONAL_NODE);
    nationalRef.on("value", function (snap) {
      national = parseNationalSnap(snap);
      render();
    }, function (err) { toast("Calendar sync failed: " + err.message); });
  }
  function ensureYearListener(year) {
    if (listenedYear === year) return;
    if (yearRef && yearCb) yearRef.off("value", yearCb);
    yearEvents = [];
    listenedYear = year;
    yearRef = db.ref("calendar/" + year);
    yearCb = yearRef.on("value", function (snap) {
      yearEvents = parseYearSnap(year, snap);
      render();
    }, function (err) { toast("Calendar sync failed: " + err.message); });
  }

  function monthFromName(name) {
    if (!name) return null;
    var l = String(name).trim().toLowerCase();
    for (var i = 0; i < MONTH_ALIASES.length; i++) {
      var al = MONTH_ALIASES[i][1];
      for (var j = 0; j < al.length; j++) if (l.indexOf(al[j]) === 0) return MONTH_ALIASES[i][0];
    }
    return null;
  }
  function firstInt(o, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!(k in o) || o[k] === null) continue;
      var v = o[k];
      if (typeof v === "number") return Math.trunc(v);
      if (typeof v === "string" && /^\s*-?\d+\s*$/.test(v)) return parseInt(v, 10);
    }
    return null;
  }
  function firstString(o, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!(k in o) || o[k] === null) continue;
      var v = o[k];
      if (typeof v === "string" && v.trim() !== "") return v;
    }
    return null;
  }
  function parseTriple(text) {
    var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(text);
    if (!m) return null;
    var a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = parseInt(m[3], 10);
    if (a > 31) return [a, b, c];
    if (c > 31) return [c, b, a];
    return null;
  }
  function adFromParts(n) {
    var y = firstInt(n, ["adYear", "ad_year", "engYear"]); if (y == null) return null;
    var m = firstInt(n, ["adMonth", "ad_month", "engMonth"]); if (m == null) return null;
    var d = firstInt(n, ["adDay", "ad_day", "engDay"]); if (d == null) return null;
    return [y, m, d];
  }
  function weekdayFrom(n) {
    var text = firstString(n, ["weekday", "dayOfWeek", "day_of_week", "dow", "dayName", "day_name"]);
    if (text != null) {
      var l = text.trim().toLowerCase();
      var names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      for (var i = 0; i < names.length; i++) if (l.indexOf(names[i]) === 0) return i;
    }
    var number = firstInt(n, ["weekday", "dayOfWeek", "day_of_week", "dow"]);
    return number != null && number >= 0 && number <= 6 ? number : null;
  }
  function pick(a, b) { return a != null ? a : b; }
  function walk(node, year, month, dayHint, out) {
    if (Array.isArray(node)) {
      node.forEach(function (item) { walk(item, year, month, null, out); });
      return;
    }
    if (node === null || typeof node !== "object") return;
    var ny = pick(firstInt(node, ["year", "bsYear", "bs_year"]), year);
    var nm = pick(firstInt(node, ["bsMonth", "bs_month", "monthIndex"]), null);
    if (nm == null) nm = firstInt(node, ["month"]);
    if (nm == null) nm = monthFromName(firstString(node, ["monthName", "month_name", "month"]));
    if (nm == null) nm = month;
    var nd = pick(firstInt(node, ["day", "bsDay", "bs_day", "nepaliDay", "np_day", "dayNumber"]), dayHint);
    var bsStr = firstString(node, ["bs", "bsDate", "bs_date", "nepaliDate", "nepali_date", "np", "npDate"]);
    var bsTriple = bsStr ? parseTriple(bsStr) : null;
    var resolved = bsTriple || ((ny != null && nm != null && nd != null) ? [ny, nm, nd] : null);
    if (resolved) {
      var adStr = firstString(node, ["ad", "adDate", "ad_date", "english", "englishDate", "english_date", "eng", "engDate", "gregorian", "date"]);
      var adTriple = (adStr ? parseTriple(adStr) : null) || adFromParts(node);
      out.push({ year: resolved[0], month: resolved[1], day: resolved[2], ad: adTriple ? { year: adTriple[0], month: adTriple[1], day: adTriple[2] } : null, weekday: weekdayFrom(node) });
      return;
    }
    Object.keys(node).forEach(function (key) {
      var value = node[key];
      if (value === null || typeof value !== "object") return;
      var cy = ny, cm = nm, cd = null;
      var number = /^-?\d+$/.test(key) ? parseInt(key, 10) : null;
      if (number != null) {
        if (number >= 1000 && number <= 9999) cy = number;
        else if (cy != null && cm == null && number >= 1 && number <= 12) cm = number;
        else if (cm != null && number >= 1 && number <= 32) cd = number;
      } else {
        var mf = monthFromName(key);
        if (mf != null) cm = mf;
      }
      walk(value, cy, cm, cd, out);
    });
  }
  function weekdayOf(entry) {
    if (entry.weekday != null) return entry.weekday;
    if (!entry.ad) return null;
    return new Date(entry.ad.year, entry.ad.month - 1, entry.ad.day).getDay();
  }
  function parseYearData(text, year) {
    var root = JSON.parse(text);
    var entries = [];
    walk(root, null, null, null, entries);
    var groups = {};
    entries.filter(function (e) { return e.year === year; }).forEach(function (e) {
      (groups[e.month] = groups[e.month] || []).push(e);
    });
    var result = {};
    Object.keys(groups).forEach(function (k) {
      var month = parseInt(k, 10);
      var sorted = groups[k].sort(function (a, b) { return a.day - b.day; });
      var ref = sorted.filter(function (e) { return weekdayOf(e) != null; })[0];
      var start = ref ? ((((weekdayOf(ref) || 0) - (ref.day - 1)) % 7) + 7) % 7 : 0;
      var adDays = {};
      sorted.forEach(function (e) { if (e.ad) adDays[e.day] = e.ad; });
      result[month] = { year: year, month: month, days: sorted[sorted.length - 1].day, startWeekday: start, adDays: adDays };
    });
    return result;
  }
  function buildOffline(year) {
    var lens = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
    var d = new Date(year - 57, 3, 14);
    var result = {};
    lens.forEach(function (len, i) {
      var adDays = {};
      var startWeekday = d.getDay();
      for (var day = 1; day <= len; day++) {
        adDays[day] = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
      result[i + 1] = { year: year, month: i + 1, days: len, startWeekday: startWeekday, adDays: adDays };
    });
    return result;
  }
  function loadYear(year) {
    if (cache[year]) return Promise.resolve(cache[year]);
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 15000);
    return fetch(BASE_URL + year + ".json", { signal: ctl.signal }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    }).then(function (text) {
      var parsed = parseYearData(text, year);
      if (Object.keys(parsed).length) cache[year] = parsed;
    }).catch(function () {}).then(function () {
      clearTimeout(timer);
      return cache[year] || null;
    });
  }
  function findToday() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
    var years = Object.keys(cache);
    for (var i = 0; i < years.length; i++) {
      var months = cache[years[i]];
      var ms = Object.keys(months);
      for (var j = 0; j < ms.length; j++) {
        var ad = months[ms[j]].adDays;
        var ds = Object.keys(ad);
        for (var k = 0; k < ds.length; k++) {
          var a = ad[ds[k]];
          if (a.year === y && a.month === m && a.day === d) return { year: parseInt(years[i], 10), month: parseInt(ms[j], 10), day: parseInt(ds[k], 10) };
        }
      }
    }
    return null;
  }

  function svgClip() { return '<svg viewBox="0 0 24 24"><path d="M9 4h6v3H9zM7 5H5v15h14V5h-2M8 12l2.5 2.5L16 9"/></svg>'; }
  function dayCells() {
    var month = cache[state.year][state.month];
    var all = yearEvents.concat(national.map(function (n) { return nationalToEvent(n, state.year); }));
    var cells = [];
    var todayKey = state.today ? bsKey(state.today.year, state.today.month, state.today.day) : null;
    var i;
    for (i = 0; i < month.startWeekday; i++) cells.push({ day: 0 });
    for (var day = 1; day <= month.days; day++) {
      var key = bsKey(state.year, state.month, day);
      var idx = (month.startWeekday + day - 1) % 7;
      cells.push({
        day: day,
        key: key,
        eng: month.adDays[day] ? month.adDays[day].day : null,
        isToday: todayKey === key,
        isSaturday: idx === 6,
        isSunday: idx === 0,
        events: all.filter(function (e) { return covers(e, key); }).sort(function (a, b) { return ord(a) - ord(b); })
      });
    }
    return { cells: cells, all: all, month: month };
  }
  function cellHtml(cell, i) {
    if (cell.day === 0) return '<div class="cl-cell cl-blank"></div>';
    var isWeekend = cell.isSaturday || cell.isSunday;
    var shown = cell.events.filter(function (e) { return !(isWeekend && e.type === "vacation"); });
    var hasExam = cell.events.some(function (e) { return e.type === "exam"; });
    var styled = shown.filter(function (e) { return e.type !== "exam"; });
    var top = styled.length ? typeOf(styled[0].type) : null;
    var withPhoto = styled.filter(function (e) { return e.photoUrl; })[0];
    var photoUrl = withPhoto ? withPhoto.photoUrl : "";
    var hasPhoto = !!photoUrl && !!top;
    var fill, dayColor, engColor, stroke = null, strokeW = 1.5, dot = null;
    if (hasPhoto) {
      fill = "transparent"; dayColor = "#fff"; engColor = "rgba(255,255,255,.85)";
      stroke = cell.isToday ? "#2F6BFF" : top.color; strokeW = 2; dot = cell.isToday ? "#fff" : top.color;
    } else if (cell.isToday) {
      fill = "#1F3F7F"; dayColor = "#fff"; engColor = "rgba(255,255,255,.7)";
    } else if (top) {
      fill = alpha(top.color, 0.141); dayColor = top.color; engColor = alpha(top.color, 0.6); stroke = top.color; dot = top.color;
    } else if (isWeekend) {
      fill = "#FDECEE"; dayColor = "#E5484D"; engColor = alpha("#E5484D", 0.6); stroke = "#E5484D";
    } else {
      fill = "#EEF3FD"; dayColor = "#14224A"; engColor = "#9AA3B5";
    }
    return '<div class="cl-cell' + (cell.isToday ? " cl-today" : "") + '" data-i="' + i + '" style="background:' + fill + '">' +
      (hasPhoto ? '<img class="cl-ph2" src="' + esc(photoUrl) + '" alt=""><span class="cl-sh"></span>' : "") +
      (stroke ? '<span class="cl-bd" style="border:' + strokeW + "px solid " + stroke + '"></span>' : "") +
      (dot ? '<span class="cl-dot" style="background:' + dot + '"></span>' : "") +
      '<span class="cl-d" style="color:' + dayColor + ";" + (hasPhoto ? "text-shadow:0 1px 6px rgba(0,0,0,.6)" : "") + '">' + cell.day + "</span>" +
      '<span class="cl-e" style="color:' + engColor + '">' + (cell.eng == null ? "" : cell.eng) + "</span>" +
      (hasExam ? '<span class="cl-ex">' + svgClip() + "</span>" : "") +
      "</div>";
  }
  function englishRange(month) {
    var keys = Object.keys(month.adDays).map(Number).sort(function (a, b) { return a - b; });
    if (!keys.length) return "";
    var f = month.adDays[keys[0]], l = month.adDays[keys[keys.length - 1]];
    var fn = ENG[f.month - 1] || "", ln = ENG[l.month - 1] || "";
    if (f.year !== l.year) return fn + " " + f.year + " - " + ln + " " + l.year;
    if (f.month !== l.month) return fn + " - " + ln + " " + f.year;
    return fn + " " + f.year;
  }
  function eventItem(e, todayKey, i) {
    var t = typeOf(e.type);
    var time = timeText(e);
    var base = t.label + " · " + rangeText(e);
    var sub = e.type === "exam" && time ? base + " · " + time : base;
    var s = fromKey(e.startKey), n = fromKey(endOf(e));
    var day = "";
    if (e.type === "vacation" && todayKey != null) {
      if (todayKey === e.startKey) day = "Start";
      else if (todayKey === endOf(e)) day = "End";
    } else {
      day = (endOf(e) !== e.startKey && n.month === s.month && n.year === s.year) ? s.day + "-" + n.day : String(s.day);
    }
    return '<div class="cl-ev" data-i="' + i + '">' +
      '<div class="cl-bg" style="background:' + t.color + '">' + (e.photoUrl ? '<img src="' + esc(e.photoUrl) + '" alt="">' : esc(t.label.charAt(0).toUpperCase())) + "</div>" +
      '<div class="cl-m"><b>' + esc(e.title) + "</b><span>" + esc(sub) + "</span></div>" +
      (day ? '<div class="cl-dy" style="background:' + alpha(t.color, 0.12) + ";color:" + t.color + '">' + day + "</div>" : "") +
      "</div>";
  }
  function render() {
    if (!state.year || !cache[state.year] || !cache[state.year][state.month]) return;
    if (!$("clGrid")) return;
    var built = dayCells();
    var cells = built.cells, all = built.all, month = built.month;
    $("clLabel").textContent = mName(state.month) + " " + state.year;
    $("clSub").textContent = englishRange(month);
    var grid = $("clGrid");
    grid.innerHTML = cells.map(cellHtml).join("");
    grid.onclick = function (ev) {
      var c = ev.target.closest(".cl-cell");
      if (!c || c.classList.contains("cl-blank")) return;
      showDayDialog(cells[parseInt(c.dataset.i, 10)]);
    };
    var first = bsKey(state.year, state.month, 1), last = bsKey(state.year, state.month, 32);
    var monthEvents = all.filter(function (e) { return e.startKey <= last && endOf(e) >= first; }).sort(function (a, b) { return a.startKey - b.startKey || ord(a) - ord(b); });
    var today = state.today;
    var isCurrent = today && today.year === state.year && today.month === state.month;
    var todayKey = today ? bsKey(today.year, today.month, today.day) : null;
    var relevant = isCurrent ? monthEvents.filter(function (e) { return endOf(e) >= todayKey; }) : monthEvents;
    shownMonth = relevant.slice(0, 3);
    $("clMonthList").innerHTML = shownMonth.map(function (e, i) { return eventItem(e, todayKey, i); }).join("");
    $("clMonthList").onclick = function (ev) {
      var c = ev.target.closest(".cl-ev");
      if (c) showEventDetail(shownMonth[parseInt(c.dataset.i, 10)]);
    };
    $("clEmpty").textContent = isCurrent ? "No upcoming events this month" : "No events this month";
    $("clEmpty").hidden = relevant.length > 0;
    $("clSeeAll").hidden = !all.length;
  }
  function show(year, month) {
    state.year = year;
    state.month = month;
    ensureYearListener(year);
    render();
  }
  function changeMonth(delta) {
    if (!state.year) return;
    var year = state.year, month = state.month + delta;
    if (month > 12) { month = 1; year++; } else if (month < 1) { month = 12; year--; }
    if (year === state.year) { show(year, month); return; }
    progress(true);
    loadYear(year).then(function (data) {
      progress(false);
      if (data && data[month]) show(year, month);
      else toast("Calendar data for " + year + " isn't available");
    });
  }
  function startCalendar() {
    var now = new Date();
    var estimate = now.getFullYear() + (now.getMonth() >= 3 ? 57 : 56);
    var years = [estimate, estimate - 1, estimate + 1];
    var fallback = null;
    progress(true);
    listenNational();
    function next(i) {
      if (i >= years.length) {
        if (fallback != null) {
          progress(false);
          show(fallback, 1);
          return;
        }
        cache[estimate] = buildOffline(estimate);
        state.today = findToday() || { year: estimate, month: 1, day: 1 };
        progress(false);
        toast("Offline: showing approximate dates");
        show(state.today.year, state.today.month);
        return;
      }
      loadYear(years[i]).then(function (data) {
        if (!data) { next(i + 1); return; }
        var today = findToday();
        if (today) {
          state.today = today;
          progress(false);
          show(today.year, today.month);
          return;
        }
        if (fallback == null) fallback = years[i];
        next(i + 1);
      });
    }
    next(0);
  }

  function openLayer(html) {
    var scrim = document.createElement("div");
    scrim.className = "cl-scrim";
    scrim.innerHTML = html;
    document.body.appendChild(scrim);
    var api = { el: scrim, close: function () { scrim.remove(); } };
    scrim.addEventListener("mousedown", function (e) { if (e.target === scrim) api.close(); });
    return api;
  }
  function monthLengths(year) {
    var out = [];
    for (var i = 1; i <= 12; i++) out.push(cache[year] && cache[year][i] ? cache[year][i].days : 32);
    return out.join(",");
  }
  function goAdd(month, day, editPath) {
    if (!canManage) { toast("Only captain or professor can do this"); return; }
    var p = new URLSearchParams({ year: String(state.year), month: String(month), day: String(day), ml: monthLengths(state.year) });
    if (editPath) p.set("edit", editPath);
    location.href = ADD_URL + "?" + p.toString();
  }
  function showDayDialog(cell) {
    var month = cache[state.year][state.month];
    var ad = month.adDays[cell.day];
    var eng = ad ? " · " + (ENG[ad.month - 1] || "") + " " + ad.day : "";
    var n = cell.events.length;
    var sub = n === 0 ? "No events" : n === 1 ? "1 event" : n + " events";
    var todayKey = state.today ? bsKey(state.today.year, state.today.month, state.today.day) : null;
    var layer = openLayer('<div class="cl-dlg">' +
      '<div class="cl-hd"><div class="cl-t2"><b>' + mName(state.month) + " " + cell.day + eng + "</b><span>" + sub + '</span></div><button class="cl-x" type="button" data-c>×</button></div>' +
      (n ? '<div class="cl-dl" id="clDl">' + cell.events.map(function (e, i) { return eventItem(e, todayKey, i); }).join("") + "</div>" : '<div class="cl-dempty">No events on this day</div>') +
      '<div class="cl-btns"><button class="cl-btn" type="button" data-c>Close</button>' + (canManage ? '<button class="cl-btn p" type="button" id="clDAdd">Add event</button>' : "") + "</div></div>");
    layer.el.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { layer.close(); }; });
    var add = layer.el.querySelector("#clDAdd");
    if (add) add.onclick = function () { layer.close(); goAdd(state.month, cell.day); };
    var dl = layer.el.querySelector("#clDl");
    if (dl) dl.onclick = function (ev) {
      var c = ev.target.closest(".cl-ev");
      if (!c) return;
      var e = cell.events[parseInt(c.dataset.i, 10)];
      layer.close();
      showEventDetail(e);
    };
  }
  function ic(path) { return '<svg viewBox="0 0 24 24">' + path + "</svg>"; }
  function showEventDetail(e, manage) {
    var can = (manage === undefined ? canManage : manage) && canManage;
    var t = typeOf(e.type);
    var dateText = e.type === "national_day" ? rangeNoYear(e) + " · every year" : rangeNoYear(e);
    var time = timeText(e);
    var layer = openLayer('<div class="cl-dlg flush">' +
      '<div class="cl-dh" style="background:' + alpha(t.color, 0.141) + '"><div class="cl-row">' +
      '<div class="cl-bg" style="background:' + t.color + '">' + (e.photoUrl ? '<img src="' + esc(e.photoUrl) + '" alt="">' : esc(t.label.charAt(0).toUpperCase())) + "</div>" +
      '<span class="cl-pill" style="color:' + t.color + '">' + esc(t.label) + "</span></div>" +
      '<button class="cl-x" type="button" data-c>✕</button></div>' +
      '<div class="cl-db"><h3>' + esc(e.title) + "</h3>" +
      '<div class="cl-ir"><div class="cl-tl">' + ic('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>') + "</div><div><small>Date</small><span>" + esc(dateText) + "</span></div></div>" +
      (time ? '<div class="cl-ir"><div class="cl-tl">' + ic('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>') + "</div><div><small>Time</small><span>" + esc(time) + "</span></div></div>" : "") +
      (e.subjects && e.subjects.length ? '<div class="cl-ir"><div class="cl-tl">' + ic('<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11"/>') + "</div><div><small>" + (e.subjects.length === 1 ? "Subject" : "Subjects") + "</small><span>" + esc(e.subjects.join(", ")) + "</span></div></div>" : "") +
      (e.description ? '<div class="cl-desc">' + esc(e.description) + "</div>" : "") +
      "</div>" +
      '<div class="cl-dft"><div class="cl-btns">' + (can ? '<button class="cl-btn d" type="button" id="clDel">Delete</button><button class="cl-btn p" type="button" id="clEdit">Edit</button>' : '<button class="cl-btn p" type="button" data-c>Done</button>') + "</div></div></div>");
    layer.el.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { layer.close(); }; });
    var ed = layer.el.querySelector("#clEdit"), del = layer.el.querySelector("#clDel");
    if (ed) ed.onclick = function () { layer.close(); var s = fromKey(e.startKey); goAdd(s.month, s.day, e.path); };
    if (del) del.onclick = function () { layer.close(); confirmDelete(e); };
  }
  function confirmDelete(e) {
    if (!canManage) return;
    var layer = openLayer('<div class="cl-dlg">' +
      '<div class="cl-hd"><div class="cl-t2"><b>Delete event?</b><span>' + esc(e.title) + "</span></div></div>" +
      '<div class="cl-dempty">This can\'t be undone.</div>' +
      '<div class="cl-btns"><button class="cl-btn" type="button" data-c>Cancel</button><button class="cl-btn d" type="button" id="clCDel">Delete</button></div></div>');
    layer.el.querySelector("[data-c]").onclick = function () { layer.close(); };
    var btn = layer.el.querySelector("#clCDel");
    btn.onclick = function () {
      btn.disabled = true;
      btn.textContent = "Deleting...";
      removeEvent(e.path).then(function () {
        layer.close();
        toast("Event deleted");
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = "Delete";
        toast("Couldn't delete: " + err.message);
      });
    };
  }

  function openAll() {
    $("clAllPage").hidden = false;
    scrolledToUpcoming = false;
    if (allRef && allCb) allRef.off("value", allCb);
    allRef = db.ref("calendar");
    allCb = allRef.on("value", function (snap) {
      var list = [];
      var latestYear = 0;
      var nat = [];
      snap.forEach(function (child) {
        var key = child.key || "";
        if (key === NATIONAL_NODE) { nat = parseNationalSnap(child); return false; }
        var year = parseInt(key, 10);
        if (isNaN(year)) return false;
        latestYear = Math.max(latestYear, year);
        parseYearSnap(year, child).forEach(function (e) { list.push(e); });
        return false;
      });
      var nationalYear = state.today ? state.today.year : latestYear;
      if (nationalYear > 0) nat.forEach(function (n) { list.push(nationalToEvent(n, nationalYear)); });
      list.sort(function (a, b) { return a.startKey - b.startKey || ord(a) - ord(b); });
      shownAll = list;
      var todayKey = state.today ? bsKey(state.today.year, state.today.month, state.today.day) : null;
      $("clAllList").innerHTML = list.map(function (e, i) { return eventItem(e, todayKey, i); }).join("");
      $("clAllCount").textContent = list.length === 1 ? "1 event" : list.length + " events";
      $("clAllCount").hidden = !list.length;
      $("clAllEmpty").textContent = "No events yet";
      $("clAllEmpty").hidden = list.length > 0;
      if (!scrolledToUpcoming && list.length && todayKey != null) {
        scrolledToUpcoming = true;
        var idx = -1;
        for (var i = 0; i < list.length; i++) if (endOf(list[i]) >= todayKey) { idx = i; break; }
        if (idx > 0) {
          var node = $("clAllList").children[idx];
          if (node) setTimeout(function () { $("clAllPage").scrollTo({ top: node.offsetTop - 80 }); }, 0);
        }
      }
    }, function () {
      $("clAllEmpty").textContent = "Couldn't load events";
      $("clAllEmpty").hidden = false;
    });
  }
  function closeAll() {
    $("clAllPage").hidden = true;
    if (allRef && allCb) allRef.off("value", allCb);
    allCb = null;
  }

  function wire() {
    if (wired) return;
    wired = true;
    $("clPrev").onclick = function () { changeMonth(-1); };
    $("clNext").onclick = function () { changeMonth(1); };
    $("clSeeAll").onclick = openAll;
    $("clAllBack").onclick = closeAll;
    $("clAllList").onclick = function (ev) {
      var c = ev.target.closest(".cl-ev");
      if (c) showEventDetail(shownAll[parseInt(c.dataset.i, 10)], false);
    };
    $("clAdd").onclick = function () {
      var t = state.today;
      var dd = t && t.year === state.year && t.month === state.month ? t.day : 1;
      goAdd(state.month, dd);
    };
  }
  function applyRole(role) {
    canManage = ROLES.indexOf(role) !== -1;
    var btn = $("clAdd");
    if (btn) btn.hidden = !canManage;
    render();
  }
  function loadRole(user) {
    if (!user) { applyRole(""); return; }
    db.ref("users").child(user.uid).child("role").once("value").then(function (snap) {
      var v = snap.val();
      applyRole(typeof v === "string" ? v.trim().toLowerCase() : "");
    }).catch(function () { applyRole(""); });
  }

  function start(user) {
    if (started) return;
    started = true;
    wire();
    loadRole(user);
    startCalendar();
  }

  window.Tabs = window.Tabs || {};
  window.Tabs.calender = {
    start: start,
    show: render
  };
})();