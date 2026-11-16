(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";
  var BOOK_PATH = "M4 5.5A1.5 1.5 0 0 1 5.5 4H9v15H5.5A1.5 1.5 0 0 1 4 17.5v-12zM9 4h6v15H9zM15 4h3.5A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5H15zM9.8 19v1.8M14.2 19v1.8";
  var CHEVRON_PATH = "M9 5l7 7-7 7";

  var listEl = document.getElementById("unitList");
  var comingSoonEl = document.getElementById("comingSoon");
  var subjectNameEl = document.getElementById("subjectName");

  var subjectName = qs("subjectName") || "Subject";
  var subjectKey = qs("subjectKey") || sanitizeKey(subjectName);

  subjectNameEl.textContent = subjectName;
  document.title = "Durbar \u00B7 " + subjectName;

  function svgIcon(d, className) {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    if (className) s.setAttribute("class", className);
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    s.appendChild(p);
    return s;
  }

  function clearSkeletons() {
    listEl.querySelectorAll(".skeleton").forEach(function (s) { s.remove(); });
  }

  function updateEmptyState(hasUnits) {
    listEl.style.display = hasUnits ? "" : "none";
    comingSoonEl.style.display = hasUnits ? "none" : "block";
  }

  function buildUnit(unit) {
    var notes = unit.notes || {};
    var noteCount = Object.keys(notes).length;
    var subtitle = noteCount === 1 ? "1 note" : (noteCount + " notes");

    var li = document.createElement("li");

    var a = document.createElement("a");
    a.className = "unit-card";
    a.href = "/html/notes.html?unitId=" + encodeURIComponent(unit.id) +
             "&unitName=" + encodeURIComponent(unit.name) +
             "&subjectName=" + encodeURIComponent(subjectName) +
             "&subjectKey=" + encodeURIComponent(subjectKey);

    var icon = document.createElement("span");
    icon.className = "unit-icon";
    icon.appendChild(svgIcon(BOOK_PATH));

    var info = document.createElement("span");
    info.className = "unit-info";

    var name = document.createElement("div");
    name.className = "unit-name";
    name.textContent = unit.name;

    var count = document.createElement("div");
    count.className = "unit-count";
    count.textContent = subtitle;

    info.appendChild(name);
    info.appendChild(count);

    a.appendChild(icon);
    a.appendChild(info);
    a.appendChild(svgIcon(CHEVRON_PATH, "chevron"));
    li.appendChild(a);
    return li;
  }

  unitsRef(subjectKey).once("value")
    .then(function (snapshot) {
      var units = [];
      snapshot.forEach(function (child) {
        units.push(child.val());
      });

      clearSkeletons();

      if (units.length === 0) {
        updateEmptyState(false);
        return;
      }

      listEl.innerHTML = "";
      units.forEach(function (unit) {
        listEl.appendChild(buildUnit(unit));
      });
      updateEmptyState(true);
    })
    .catch(function (err) {
      console.error("loadUnits cancelled: " + err.message);
      clearSkeletons();
      updateEmptyState(false);
    });
})();