(function () {
  var STORE_KEY = "durbar_mock_items";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var DOC_PATH = "M7 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5zM15 3.5V8h4M9 12.5h6M9 16h4";
  var TRASH_PATH = "M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10 11v5M14 11v5";
  var PLUS_PATH = "M12 5v14M5 12h14";

  var root = null;
  var showForm = false;
  var items = [];

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function keyOf(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function prettyDate(k) {
    var p = k.split("-");
    return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
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

  function buildForm() {
    var form = el("div", "mk-form");
    var title = el("input", "mk-input");
    title.type = "text";
    title.maxLength = 80;
    title.placeholder = "Mock test name";
    var date = el("input", "mk-input");
    date.type = "date";
    date.value = keyOf(new Date());
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
        type: "mock",
        title: name,
        date: date.value
      });
      saveItems();
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
    ic.appendChild(icon(DOC_PATH));
    var info = el("div", "mk-item-info");
    info.appendChild(el("div", "mk-item-title", it.title));
    info.appendChild(el("div", "mk-item-sub", prettyDate(it.date) + (keyOf(new Date()) > it.date ? " · Past" : " · Upcoming")));
    var del = el("button", "mk-icon-btn");
    del.type = "button";
    del.setAttribute("aria-label", "Delete");
    del.appendChild(icon(TRASH_PATH));
    del.addEventListener("click", function () {
      items = items.filter(function (x) { return x.id !== it.id; });
      saveItems();
      render();
    });
    row.appendChild(ic);
    row.appendChild(info);
    row.appendChild(del);
    return row;
  }

  function render() {
    if (!root) return;
    items = loadItems();
    root.textContent = "";

    if (showForm) {
      root.appendChild(buildForm());
    } else {
      var add = el("button", "mk-btn wide");
      add.type = "button";
      add.appendChild(icon(PLUS_PATH));
      add.appendChild(el("span", "", "Add mock test"));
      add.addEventListener("click", function () {
        showForm = true;
        render();
      });
      root.appendChild(add);
    }

    var mocks = items.filter(function (it) { return it.type === "mock"; }).sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });

    if (!mocks.length) {
      var empty = el("div", "mk-empty");
      empty.appendChild(el("h2", "", "No mock tests yet"));
      empty.appendChild(el("p", "", "Mock tests you add will appear here."));
      root.appendChild(empty);
      return;
    }

    var list = el("div", "mk-list");
    mocks.forEach(function (it) {
      list.appendChild(buildRow(it));
    });
    root.appendChild(list);
  }

  function start() {
    root = document.getElementById("mockRoot");
    render();
  }

  window.Tabs = window.Tabs || {};
  window.Tabs.mock = {
    start: start,
    show: render
  };
})();