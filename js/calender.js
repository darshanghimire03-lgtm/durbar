(function () {
  var STORE_KEY = "durbar_mock_items";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["S", "M", "T", "W", "T", "F", "S"];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var PREV_PATH = "M15 5l-7 7 7 7";
  var NEXT_PATH = "M9 5l7 7-7 7";
  var TRASH_PATH = "M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10 11v5M14 11v5";
  var PLUS_PATH = "M12 5v14M5 12h14";
  var DOC_PATH = "M7 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5zM15 3.5V8h4M9 12.5h6M9 16h4";
  var CAL_PATH = "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4";

  var root = null;
  var now = new Date();
  var showForm = false;
  var year = now.getFullYear();
  var month = now.getMonth();
  var selected = keyOf(now);
  var items = [];

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
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
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

  function icon(d) {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    s.appendChild(p);
    return s;
  }

  function iconButton(path, label, handler) {
    var b = el("button", "mk-icon-btn");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.appendChild(icon(path));
    b.addEventListener("click", handler);
    return b;
  }

  function itemsOn(k) {
    return items.filter(function (it) { return it.date === k; });
  }

  function shiftMonth(delta) {
    var d = new Date(year, month + delta, 1);
    year = d.getFullYear();
    month = d.getMonth();
    render();
  }

  function buildForm() {
    var form = el("div", "mk-form");
    var title = el("input", "mk-input");
    title.type = "text";
    title.maxLength = 80;
    title.placeholder = "Event name";
    var date = el("input", "mk-input");
    date.type = "date";
    date.value = selected;
    var row = el("div", "mk-form-row");
    var cancel = el("button", "mk-btn ghost", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", function () {
      showForm = false;
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
      items.push({
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        type: "event",
        title: name,
        date: date.value
      });
      saveItems();
      selected = date.value;
      var d = parseKey(date.value);
      year = d.getFullYear();
      month = d.getMonth();
      showForm = false;
      render();
    });
    row.appendChild(cancel);
    row.appendChild(save);
    form.appendChild(title);
    form.appendChild(date);
    form.appendChild(row);
    return form;
  }

  function buildRow(it) {
    var row = el("div", "mk-item");
    var ic = el("span", "mk-item-icon");
    ic.appendChild(icon(it.type === "mock" ? DOC_PATH : CAL_PATH));
    var info = el("div", "mk-item-info");
    info.appendChild(el("div", "mk-item-title", it.title));
    info.appendChild(el("div", "mk-item-sub", it.type === "mock" ? "Mock test" : "Event"));
    row.appendChild(ic);
    row.appendChild(info);
    row.appendChild(iconButton(TRASH_PATH, "Delete", function () {
      items = items.filter(function (x) { return x.id !== it.id; });
      saveItems();
      render();
    }));
    return row;
  }

  function render() {
    if (!root) return;
    items = loadItems();
    root.textContent = "";

    var head = el("div", "mk-cal-head");
    head.appendChild(iconButton(PREV_PATH, "Previous month", function () { shiftMonth(-1); }));
    head.appendChild(el("div", "mk-cal-title", MONTHS[month] + " " + year));
    head.appendChild(iconButton(NEXT_PATH, "Next month", function () { shiftMonth(1); }));
    root.appendChild(head);

    var grid = el("div", "mk-grid");
    DAYS.forEach(function (d) {
      grid.appendChild(el("div", "mk-dow", d));
    });
    var first = new Date(year, month, 1).getDay();
    var total = new Date(year, month + 1, 0).getDate();
    var todayKey = keyOf(new Date());
    var i;
    for (i = 0; i < first; i++) {
      grid.appendChild(el("span", "mk-blank"));
    }
    for (i = 1; i <= total; i++) {
      (function (day) {
        var k = year + "-" + pad(month + 1) + "-" + pad(day);
        var cell = el("button", "mk-day", String(day));
        cell.type = "button";
        if (k === todayKey) cell.classList.add("today");
        if (k === selected) cell.classList.add("selected");
        if (itemsOn(k).length) cell.classList.add("has");
        cell.addEventListener("click", function () {
          selected = k;
          showForm = false;
          render();
        });
        grid.appendChild(cell);
      })(i);
    }
    root.appendChild(grid);

    root.appendChild(el("div", "mk-day-title", prettyDate(selected)));

    if (showForm) {
      root.appendChild(buildForm());
    } else {
      var add = el("button", "mk-btn wide");
      add.type = "button";
      add.appendChild(icon(PLUS_PATH));
      add.appendChild(el("span", "", "Add to this day"));
      add.addEventListener("click", function () {
        showForm = true;
        render();
      });
      root.appendChild(add);
    }

    var dayItems = itemsOn(selected);
    if (!dayItems.length) {
      var empty = el("div", "mk-empty");
      empty.appendChild(el("h2", "", "Nothing on this day"));
      empty.appendChild(el("p", "", "Pick another date or add something."));
      root.appendChild(empty);
      return;
    }

    var list = el("div", "mk-list");
    dayItems.forEach(function (it) {
      list.appendChild(buildRow(it));
    });
    root.appendChild(list);
  }

  function start() {
    root = document.getElementById("calenderRoot");
    render();
  }

  window.Tabs = window.Tabs || {};
  window.Tabs.calender = {
    start: start,
    show: render
  };
})();