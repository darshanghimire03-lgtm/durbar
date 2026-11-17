(function () {
  var STORE_KEY = "durbar_mock_items";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["S", "M", "T", "W", "T", "F", "S"];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICONS = {
    mock: "M7 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5zM15 3.5V8h4M9 12.5h6M9 16h4",
    event: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4",
    prev: "M15 5l-7 7 7 7",
    next: "M9 5l7 7-7 7",
    trash: "M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10 11v5M14 11v5",
    plus: "M12 5v14M5 12h14"
  };

  var root = null;
  var today = new Date();
  var state = {
    tab: "mock",
    year: today.getFullYear(),
    month: today.getMonth(),
    selected: keyOf(today),
    form: null
  };
  var items = loadItems();

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function keyOf(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseKey(k) {
    var p = k.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function prettyDate(k) {
    var d = parseKey(k);
    return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear();
  }

  function loadItems() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
    } catch (err) {}
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, className) {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    if (className) s.setAttribute("class", className);
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", ICONS[name]);
    s.appendChild(p);
    return s;
  }

  function iconButton(name, label, handler) {
    var b = el("button", "mk-icon-btn");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.appendChild(icon(name));
    b.addEventListener("click", handler);
    return b;
  }

  function addItem(type, title, date) {
    items.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), type: type, title: title, date: date });
    saveItems();
  }

  function removeItem(id) {
    items = items.filter(function (it) { return it.id !== id; });
    saveItems();
  }

  function itemsOn(k) {
    return items.filter(function (it) { return it.date === k; });
  }

  function buildForm(type, defaultDate) {
    var form = el("div", "mk-form");
    var title = el("input", "mk-input");
    title.type = "text";
    title.maxLength = 80;
    title.placeholder = type === "mock" ? "Mock test name" : "Event name";
    var date = el("input", "mk-input");
    date.type = "date";
    date.value = defaultDate;
    var row = el("div", "mk-form-row");
    var cancel = el("button", "mk-btn ghost", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", function () {
      state.form = null;
      render();
    });
    var save = el("button", "mk-btn", "Add");
    save.type = "button";
    save.addEventListener("click", function () {
      var name = title.value.trim();
      if (!name) {
        title.focus();
        return;
      }
      if (!date.value) {
        date.focus();
        return;
      }
      addItem(type, name, date.value);
      state.form = null;
      if (type === "event") {
        state.selected = date.value;
        var d = parseKey(date.value);
        state.year = d.getFullYear();
        state.month = d.getMonth();
      }
      render();
    });
    row.appendChild(cancel);
    row.appendChild(save);
    form.appendChild(title);
    form.appendChild(date);
    form.appendChild(row);
    return form;
  }

  function buildItemRow(it) {
    var row = el("div", "mk-item");
    var ic = el("span", "mk-item-icon " + it.type);
    ic.appendChild(icon(it.type));
    var info = el("div", "mk-item-info");
    info.appendChild(el("div", "mk-item-title", it.title));
    var sub = prettyDate(it.date);
    if (it.type === "mock") {
      sub += keyOf(new Date()) > it.date ? " · Past" : " · Upcoming";
    }
    info.appendChild(el("div", "mk-item-sub", sub));
    row.appendChild(ic);
    row.appendChild(info);
    row.appendChild(iconButton("trash", "Delete", function () {
      removeItem(it.id);
      render();
    }));
    return row;
  }

  function buildEmpty(title, text) {
    var box = el("div", "mk-empty");
    box.appendChild(el("h2", "", title));
    box.appendChild(el("p", "", text));
    return box;
  }

  function buildAddButton(label, type, defaultDate) {
    var b = el("button", "mk-btn wide");
    b.type = "button";
    b.appendChild(icon("plus"));
    b.appendChild(el("span", "", label));
    b.addEventListener("click", function () {
      state.form = { type: type, date: defaultDate };
      render();
    });
    return b;
  }

  function renderMock(container) {
    var mocks = items.filter(function (it) { return it.type === "mock"; }).sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    if (state.form && state.form.type === "mock") {
      container.appendChild(buildForm("mock", state.form.date));
    } else {
      container.appendChild(buildAddButton("Add mock test", "mock", keyOf(new Date())));
    }
    if (!mocks.length) {
      container.appendChild(buildEmpty("No mock tests yet", "Mock tests you add will appear here."));
      return;
    }
    var list = el("div", "mk-list");
    mocks.forEach(function (it) {
      list.appendChild(buildItemRow(it));
    });
    container.appendChild(list);
  }

  function shiftMonth(delta) {
    var d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    render();
  }

  function renderCalendar(container) {
    var head = el("div", "mk-cal-head");
    head.appendChild(iconButton("prev", "Previous month", function () { shiftMonth(-1); }));
    head.appendChild(el("div", "mk-cal-title", MONTHS[state.month] + " " + state.year));
    head.appendChild(iconButton("next", "Next month", function () { shiftMonth(1); }));
    container.appendChild(head);

    var grid = el("div", "mk-grid");
    DAYS.forEach(function (d) {
      grid.appendChild(el("div", "mk-dow", d));
    });
    var first = new Date(state.year, state.month, 1).getDay();
    var total = new Date(state.year, state.month + 1, 0).getDate();
    var todayKey = keyOf(new Date());
    var i;
    for (i = 0; i < first; i++) {
      grid.appendChild(el("span", "mk-blank"));
    }
    for (i = 1; i <= total; i++) {
      (function (day) {
        var k = state.year + "-" + pad(state.month + 1) + "-" + pad(day);
        var cell = el("button", "mk-day", String(day));
        cell.type = "button";
        if (k === todayKey) cell.classList.add("today");
        if (k === state.selected) cell.classList.add("selected");
        if (itemsOn(k).length) cell.classList.add("has");
        cell.addEventListener("click", function () {
          state.selected = k;
          state.form = null;
          render();
        });
        grid.appendChild(cell);
      })(i);
    }
    container.appendChild(grid);

    container.appendChild(el("div", "mk-day-title", prettyDate(state.selected)));

    if (state.form && state.form.type === "event") {
      container.appendChild(buildForm("event", state.form.date));
    } else {
      container.appendChild(buildAddButton("Add to this day", "event", state.selected));
    }

    var dayItems = itemsOn(state.selected);
    if (!dayItems.length) {
      container.appendChild(buildEmpty("Nothing on this day", "Pick another date or add something."));
      return;
    }
    var list = el("div", "mk-list");
    dayItems.forEach(function (it) {
      list.appendChild(buildItemRow(it));
    });
    container.appendChild(list);
  }

  function render() {
    if (!root) return;
    root.textContent = "";
    var seg = el("div", "mk-seg");
    [["mock", "Mock Tests"], ["calendar", "Calendar"]].forEach(function (t) {
      var b = el("button", "mk-seg-btn" + (state.tab === t[0] ? " active" : ""), t[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        state.tab = t[0];
        state.form = null;
        render();
      });
      seg.appendChild(b);
    });
    root.appendChild(seg);
    var body = el("div", "mk-body");
    if (state.tab === "mock") renderMock(body);
    else renderCalendar(body);
    root.appendChild(body);
  }

  function start() {
    root = document.getElementById("mockRoot");
    items = loadItems();
    render();
  }

  window.Tabs = window.Tabs || {};
  window.Tabs.mock = {
    start: start,
    show: render
  };
})();