(function () {
  var SUBJECT_LIST = ["Economic", "Account", "Computer Science", "English", "Nepali"];
  var PER_SET = 20;
  var SECS = 60;
  var PASS = 10;
  var ORDER_PREFIX = "durbar_mock_order_";
  var MANAGE_PAGE = "/html/add-mock.html";
  var STAFF_ROLES = ["professor", "moderator"];
  var LABELS = ["A", "B", "C", "D"];

  var ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#1E2A78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4,5.5C4,4.67 4.67,4 5.5,4H10.5C12.43,4 14,5.57 14,7.5V20C13.16,19.37 12.12,19 11,19H5.5C4.67,19 4,18.33 4,17.5V5.5Z"/><path fill="none" stroke="#1E2A78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M20,5.5C20,4.67 19.33,4 18.5,4H13.5C11.57,4 10,5.57 10,7.5V20C10.84,19.37 11.88,19 13,19H18.5C19.33,19 20,18.33 20,17.5V5.5Z"/></svg>',
    bookBlue: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#1F4AA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4,5.5C4,4.67 4.67,4 5.5,4H10.5C12.43,4 14,5.57 14,7.5V20C13.16,19.37 12.12,19 11,19H5.5C4.67,19 4,18.33 4,17.5V5.5Z"/><path fill="none" stroke="#1F4AA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M20,5.5C20,4.67 19.33,4 18.5,4H13.5C11.57,4 10,5.57 10,7.5V20C10.84,19.37 11.88,19 13,19H18.5C19.33,19 20,18.33 20,17.5V5.5Z"/></svg>',
    chev: '<svg class="mk-chev" viewBox="0 0 24 24"><path d="M8.59,16.59L13.17,12L8.59,7.41L10,6l6,6 -6,6z"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><path d="M22,5.72l-4.6,-3.86 -1.29,1.53 4.6,3.86L22,5.72zM7.88,3.39L6.6,1.86 2,5.71l1.29,1.53 4.59,-3.85zM12.5,8L11,8v6l4.75,2.85 0.75,-1.23 -4,-2.37L12.5,8zM12,4c-4.97,0 -9,4.03 -9,9s4.02,9 9,9c4.97,0 9,-4.03 9,-9s-4.03,-9 -9,-9zM12,20c-3.87,0 -7,-3.13 -7,-7s3.13,-7 7,-7 7,3.13 7,7 -3.13,7 -7,7z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M10,16.5v-9l6,4.5 -6,4.5z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M4,11v2h12l-5.5,5.5 1.42,1.42L19.84,12l-7.92,-7.92L10.5,5.5 16,11z"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M14.4,6L14,4H5v17h2v-7h5.6l0.4,2h7V6z"/></svg>',
    bulb: '<svg viewBox="0 0 24 24"><path d="M9,21c0,0.55 0.45,1 1,1h4c0.55,0 1,-0.45 1,-1v-1H9v1zM12,2C8.14,2 5,5.14 5,9c0,2.38 1.19,4.47 3,5.74V17c0,0.55 0.45,1 1,1h6c0.55,0 1,-0.45 1,-1v-2.26c1.81,-1.27 3,-3.36 3,-5.74 0,-3.86 -3.14,-7 -7,-7z"/></svg>',
    passed: '<svg class="mk-ricon" viewBox="0 0 120 120"><path d="M14,38 L22,44 M12,60 L22,60 M14,82 L22,76 M106,38 L98,44 M108,60 L98,60 M106,82 L98,76" fill="none" stroke="#8DB8F2" stroke-width="3.5" stroke-linecap="round"/><path d="M42,22 H78 A8,8 0 0 1 86,30 V84 A8,8 0 0 1 78,92 H42 A8,8 0 0 1 34,84 V30 A8,8 0 0 1 42,22 Z" fill="#E4EEFC" stroke="#8DB8F2" stroke-width="3"/><path d="M53,14 H67 A3,3 0 0 1 70,17 V24 H50 V17 A3,3 0 0 1 53,14 Z" fill="#8DB8F2"/><path d="M46,38 H74 M46,48 H74 M46,58 H62" fill="none" stroke="#8DB8F2" stroke-width="3" stroke-linecap="round"/><path d="M70,76 A14,14 0 1 1 98,76 A14,14 0 1 1 70,76 Z" fill="#2E9E5B" stroke="#fff" stroke-width="2"/><path d="M77,76 L82,81 L91,71" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    failed: '<svg class="mk-ricon" viewBox="0 0 120 120"><path d="M14,38 L22,44 M12,60 L22,60 M14,82 L22,76 M106,38 L98,44 M108,60 L98,60 M106,82 L98,76" fill="none" stroke="#8DB8F2" stroke-width="3.5" stroke-linecap="round"/><path d="M42,22 H78 A8,8 0 0 1 86,30 V84 A8,8 0 0 1 78,92 H42 A8,8 0 0 1 34,84 V30 A8,8 0 0 1 42,22 Z" fill="#E4EEFC" stroke="#8DB8F2" stroke-width="3"/><path d="M53,14 H67 A3,3 0 0 1 70,17 V24 H50 V17 A3,3 0 0 1 53,14 Z" fill="#8DB8F2"/><path d="M46,38 H74 M46,48 H74 M46,58 H62" fill="none" stroke="#8DB8F2" stroke-width="3" stroke-linecap="round"/><path d="M70,76 A14,14 0 1 1 98,76 A14,14 0 1 1 70,76 Z" fill="#EF4B58" stroke="#fff" stroke-width="2"/><path d="M78,70 L90,82 M90,70 L78,82" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>'
  };

  var root = null;
  var started = false;
  var toastEl = null;
  var toastTimer = null;
  var state = {
    uid: "guest",
    user: null,
    mocks: {},
    loaded: false,
    screen: "subjects",
    subject: "",
    setNumber: 1,
    test: null
  };

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "mk-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
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

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
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
          nodeSubject: nodeSubject
        });
      });
    });
    return list;
  }

  function questionsFor(subject) {
    var target = norm(subject);
    return flatten(state.mocks).filter(function (q) {
      return norm(q.subject) === target || norm(q.nodeSubject) === target;
    });
  }

  function setCountFor(subject) {
    return Math.floor(questionsFor(subject).length / PER_SET);
  }

  function orderedIds(subject, available) {
    var key = ORDER_PREFIX + state.uid + "_" + cleanKey(subject);
    var saved = [];
    try {
      var raw = localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {}
    if (!Array.isArray(saved)) saved = [];
    var set = new Set(available);
    var kept = saved.filter(function (id) { return set.has(id); });
    var keptSet = new Set(kept);
    var fresh = shuffle(available.filter(function (id) { return !keptSet.has(id); }));
    var result = kept.concat(fresh);
    if (JSON.stringify(result) !== JSON.stringify(saved)) {
      try { localStorage.setItem(key, JSON.stringify(result)); } catch (e) {}
    }
    return result;
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

  function setTesting(on) {
    document.documentElement.classList.toggle("mk-testing", !!on);
  }

  function isTabActive() {
    var view = document.getElementById("view-mock");
    return !view || view.classList.contains("active");
  }

  function header(title, withTimer) {
    return '<div class="mk-hdr">' +
      '<button class="mk-round" id="mkBack" type="button" aria-label="Back">' + ICON.back + '</button>' +
      '<div class="mk-title">' + esc(title) + '</div>' +
      (withTimer ? '<div class="mk-timer" id="mkTimerPill">' + ICON.timer + '<span id="mkTimer">01:00</span></div>' : '') +
      '</div>';
  }

  function bindBack() {
    var btn = document.getElementById("mkBack");
    if (btn) btn.onclick = goBack;
  }

  function goBack() {
    if (state.screen === "test") {
      toast("Back is disabled during the test");
      return;
    }
    if (state.test) clearInterval(state.test.timer);
    state.test = null;
    state.screen = state.screen === "sets" ? "subjects" : "sets";
    setTesting(false);
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    if (!root) return;
    if (state.screen === "subjects") renderSubjects();
    else if (state.screen === "sets") renderSets();
    else if (state.screen === "start" && state.test) renderStart();
    else if (state.screen === "test" && state.test) renderQuestion();
    else if (state.screen === "result" && state.test) renderResult();
    else {
      state.screen = "subjects";
      renderSubjects();
    }
  }

  function renderSubjects() {
    var staff = isStaff() && assignedSubject();
    var html = '<div class="page-head"><h1 class="page-title">Mock</h1><p class="page-sub">All subjects</p></div>';
    if (staff) {
      html += '<div class="mk-manage-row"><a class="mk-manage" href="' + MANAGE_PAGE + '">Manage ' + esc(assignedSubject()) + ' questions</a></div>';
    }
    html += '<div class="mk-list">' + SUBJECT_LIST.map(function (name) {
      var count = setCountFor(name);
      var meta = !state.loaded ? "Loading..." : count === 0 ? "No sets yet" : count === 1 ? "1 set" : count + " sets";
      return '<div class="mk-card" data-subject="' + esc(name) + '">' +
        '<div class="mk-tile">' + ICON.book + '</div>' +
        '<div class="mk-txt"><div class="mk-name">' + esc(name) + '</div><div class="mk-meta">' + meta + '</div></div>' +
        ICON.chev + '</div>';
    }).join("") + '</div>';
    root.innerHTML = html;
    Array.prototype.forEach.call(root.querySelectorAll(".mk-card"), function (el) {
      el.onclick = function () { openSets(el.getAttribute("data-subject")); };
    });
  }

  function openSets(subject) {
    state.subject = subject;
    state.screen = "sets";
    renderSets();
    window.scrollTo(0, 0);
  }

  function renderSets() {
    var count = setCountFor(state.subject);
    var body;
    if (!state.loaded) {
      body = '<div class="mk-empty">Loading...</div>';
    } else if (count === 0) {
      body = '<div class="mk-empty">No sets yet</div>';
    } else {
      var cards = "";
      for (var i = 1; i <= count; i++) {
        cards += '<div class="mk-card" data-set="' + i + '">' +
          '<div class="mk-tile">' + ICON.book + '</div>' +
          '<div class="mk-txt"><div class="mk-name">Set ' + i + '</div><div class="mk-meta">' + PER_SET + ' questions</div></div>' +
          ICON.chev + '</div>';
      }
      body = '<div class="mk-list">' + cards + '</div>';
    }
    root.innerHTML = header(state.subject, false) + body;
    bindBack();
    Array.prototype.forEach.call(root.querySelectorAll(".mk-card"), function (el) {
      el.onclick = function () { loadTest(parseInt(el.getAttribute("data-set"), 10)); };
    });
  }

  function loadTest(setNumber) {
    var byId = new Map();
    questionsFor(state.subject).forEach(function (q) { if (q.questionId) byId.set(q.questionId, q); });
    var ids = orderedIds(state.subject, Array.from(byId.keys()));
    var arranged = ids.map(function (id) { return byId.get(id); }).filter(Boolean);
    var from = (setNumber - 1) * PER_SET;
    var to = from + PER_SET;
    if (setNumber < 1 || arranged.length < to) {
      toast("This set isn't available yet");
      return;
    }
    state.setNumber = setNumber;
    state.test = {
      base: arranged.slice(from, to),
      questions: arranged.slice(from, to),
      answers: [],
      index: 0,
      timer: null,
      endAt: 0,
      selected: -1,
      leftAt: -1
    };
    state.test.answers = state.test.questions.map(function () { return -1; });
    state.screen = "start";
    renderStart();
    window.scrollTo(0, 0);
  }

  function renderStart() {
    var t = state.test;
    var n = t.questions.length;
    var rules = [
      "This set has " + n + " questions, all from " + state.subject + ".",
      "Questions and their options appear in a random order every time.",
      "You get " + SECS + " seconds for each question.",
      "When the time ends, the question is skipped and the next one opens.",
      "Choose an option and tap Next. You can't go back to a previous question.",
      "Every correct answer gives 1 point. Wrong answers don't lose points.",
      "You need at least " + PASS + " correct answers to pass.",
      "Leaving the test in the middle will lose your progress."
    ];
    root.innerHTML = header(state.subject + " - Set " + state.setNumber, false) +
      '<div class="mk-wrap">' +
      '<div class="mk-pill">' + ICON.bookBlue + '<span>Rules</span></div>' +
      '<div class="mk-rules-h">Rules</div>' +
      '<div class="mk-rules-sub">' + esc(state.subject) + ' - Set ' + state.setNumber + ' · ' + n + ' questions</div>' +
      rules.map(function (text, i) {
        return '<div class="mk-rule"><div class="mk-num">' + (i + 1) + '</div><div class="mk-rt">' + esc(text) + '</div></div>';
      }).join("") +
      '<button class="mk-btn" id="mkStart" type="button">' + ICON.play + '<span class="mk-sep"></span><span>Start Test</span></button>' +
      '</div>';
    bindBack();
    document.getElementById("mkStart").onclick = startTest;
  }

  function startTest() {
    var t = state.test;
    var presented = shuffle(t.base).map(function (q) {
      var order = shuffle(q.options.map(function (_, i) { return i; }));
      return Object.assign({}, q, {
        options: order.map(function (i) { return q.options[i]; }),
        answerIndex: order.indexOf(q.answerIndex)
      });
    });
    t.questions = presented;
    t.answers = presented.map(function () { return -1; });
    t.index = 0;
    state.screen = "test";
    setTesting(true);
    renderQuestion();
    window.scrollTo(0, 0);
  }

  function renderQuestion() {
    var t = state.test;
    var q = t.questions[t.index];
    t.selected = -1;
    var photos = (q.photos || []).slice(0, 4);
    root.innerHTML = header("Set " + state.setNumber, true) +
      '<div class="mk-wrap">' +
      '<div class="mk-progress">Question ' + (t.index + 1) + ' of ' + t.questions.length + '</div>' +
      '<div class="mk-bar"><i id="mkBarFill"></i></div>' +
      '<div class="mk-q">' + esc(q.question) + '</div>' +
      (photos.length ? '<div class="mk-photos">' + photos.map(function (u) { return '<img src="' + esc(u) + '" alt="">'; }).join("") + '</div>' : '') +
      '<div class="mk-opts">' +
      q.options.map(function (o, i) {
        return '<div class="mk-opt" data-i="' + i + '"><div class="mk-letter">' + (LABELS[i] || "") + '</div><div class="mk-ot">' + esc(o) + '</div></div>';
      }).join("") +
      '</div>' +
      '<button class="mk-btn mk-next" id="mkNext" type="button"><span>' + (t.index === t.questions.length - 1 ? "Finish" : "Next") + '</span>' + ICON.arrow + '</button>' +
      '</div>';
    bindBack();
    Array.prototype.forEach.call(root.querySelectorAll(".mk-opt"), function (el) {
      el.onclick = function () {
        t.selected = parseInt(el.getAttribute("data-i"), 10);
        Array.prototype.forEach.call(root.querySelectorAll(".mk-opt"), function (o) {
          o.classList.toggle("sel", o === el);
        });
      };
    });
    document.getElementById("mkNext").onclick = function () { submit(t.selected); };
    startTimer();
  }

  function abandonTest() {
    if (state.test) clearInterval(state.test.timer);
    state.test = null;
    state.screen = "sets";
    setTesting(false);
  }

  function startTimer() {
    var t = state.test;
    clearInterval(t.timer);
    t.endAt = Date.now() + SECS * 1000;
    function tick() {
      if (!isTabActive()) {
        abandonTest();
        return;
      }
      var left = Math.max(0, t.endAt - Date.now());
      var secs = Math.ceil(left / 1000);
      var fill = document.getElementById("mkBarFill");
      var label = document.getElementById("mkTimer");
      var pill = document.getElementById("mkTimerPill");
      if (fill) fill.style.width = (left / (SECS * 1000) * 100) + "%";
      if (label) label.textContent = String(Math.floor(secs / 60)).padStart(2, "0") + ":" + String(secs % 60).padStart(2, "0");
      if (pill) pill.classList.toggle("urgent", secs <= 10);
      if (left <= 0) submit(-1);
    }
    tick();
    if (state.test === t && state.screen === "test") t.timer = setInterval(tick, 100);
  }

  function submit(choice) {
    var t = state.test;
    if (!t || state.screen !== "test") return;
    clearInterval(t.timer);
    t.answers[t.index] = choice;
    if (t.index === t.questions.length - 1) {
      state.screen = "result";
      setTesting(false);
      renderResult();
      window.scrollTo(0, 0);
    } else {
      t.index++;
      renderQuestion();
    }
  }

  function renderResult() {
    var t = state.test;
    var total = t.questions.length;
    var score = 0;
    t.questions.forEach(function (q, i) { if (t.answers[i] === q.answerIndex) score++; });
    var skipped = t.answers.filter(function (a) { return a === -1; }).length;
    var wrong = total - score - skipped;
    var passed = score >= PASS;
    var tips = buildSuggestions(score, total, wrong, skipped, passed);
    root.innerHTML = header(state.subject + " - Set " + state.setNumber, false) +
      '<div class="mk-wrap">' +
      (passed ? ICON.passed : ICON.failed) +
      '<div class="mk-rtitle" style="color:' + (passed ? "#2E7D32" : "#E53935") + '">' + (passed ? "Passed" : "Failed") + '</div>' +
      '<div class="mk-rscore">' + score + ' / ' + total + '</div>' +
      '<div class="mk-rstats">' + score + ' correct  ·  ' + wrong + ' wrong  ·  ' + skipped + ' skipped</div>' +
      '<div class="mk-sugg-h">' + ICON.bulb + '<span>Suggestions</span></div>' +
      '<div class="mk-sugg-card">' +
      tips.map(function (tip, i) {
        return (i > 0 ? '<div class="mk-sugg-div"></div>' : '') +
          '<div class="mk-sugg"><div class="mk-snum">' + (i + 1) + '</div><div class="mk-st">' + esc(tip) + '</div></div>';
      }).join("") +
      '</div>' +
      '<button class="mk-btn" id="mkFinish" type="button">' + ICON.flag + '<span class="mk-sep"></span><span>Finish</span></button>' +
      '</div>';
    bindBack();
    document.getElementById("mkFinish").onclick = goBack;
  }

  function buildSuggestions(score, total, wrong, skipped, passed) {
    var percent = Math.floor(score * 100 / total);
    var tips = [];
    if (score === total) {
      tips.push("Perfect score. Move on to the next set to keep challenging yourself.");
    } else if (percent >= 80) {
      tips.push("Great result. A little more practice and you will be close to a perfect score.");
    } else if (passed) {
      tips.push("You passed, but there is room to improve. Revise the weaker topics and try again.");
    } else {
      tips.push("You needed " + PASS + " correct answers and were " + (PASS - score) + " short.");
      tips.push("Revise your " + state.subject + " notes and units before trying this set again.");
    }
    if (skipped > 0) {
      tips.push(skipped + " question(s) ran out of time. Practise answering faster, you get " + SECS + " seconds each.");
    }
    if (wrong > 0 && !passed) {
      tips.push("Retake this set after revising to see your progress. The questions and options will be in a new order.");
    }
    return tips;
  }

  function onMocksChanged() {
    if (state.screen === "subjects") renderSubjects();
    else if (state.screen === "sets") renderSets();
  }

  document.addEventListener("visibilitychange", function () {
    var t = state.test;
    if (!t || state.screen !== "test") return;
    if (document.hidden) {
      t.leftAt = t.index;
    } else if (t.leftAt !== -1) {
      var was = t.leftAt;
      t.leftAt = -1;
      if (t.index === was) submit(-1);
      toast("You left the test. Question skipped.");
    }
  });

  window.addEventListener("beforeunload", function (e) {
    if (state.screen === "test") {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  function start(user) {
    if (started) return;
    started = true;
    root = document.getElementById("mockRoot");
    if (!root) return;
    state.uid = user && user.uid ? user.uid : "guest";
    render();

    db.ref("mocks").on("value", function (snap) {
      state.mocks = snap.val() || {};
      state.loaded = true;
      onMocksChanged();
    }, function (err) {
      state.mocks = {};
      state.loaded = true;
      toast("Couldn't load questions: " + err.message);
      onMocksChanged();
    });

    if (user) {
      db.ref("users").child(user.uid).on("value", function (snap) {
        state.user = snap.val();
        if (state.screen === "subjects") renderSubjects();
      }, function () {
        state.user = null;
      });
    }
  }

  function show() {
    if (!started || state.screen === "test") return;
    render();
  }

  window.Tabs = window.Tabs || {};
  window.Tabs.mock = {
    start: start,
    show: show
  };
})();