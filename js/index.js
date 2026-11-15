(function () {
  var HEADER_URL = "layout/header.html";
  var NAV_URL = "layout/navigation.html";
  var TAB_SCRIPTS = ["js/home.js", "js/shorts.js", "js/subject.js"];

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url);
      return res.text();
    });
  }

  function mount(slotId, html) {
    var slot = document.getElementById(slotId);
    var holder = document.createElement("template");
    holder.innerHTML = html.trim();
    slot.replaceWith(holder.content);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = function () {
        reject(new Error(src));
      };
      document.body.appendChild(tag);
    });
  }

  function loadScriptsInOrder(list) {
    return list.reduce(function (chain, src) {
      return chain.then(function () {
        return loadScript(src);
      });
    }, Promise.resolve());
  }

  function showBootError() {
    var feed = document.getElementById("feed");
    if (!feed) return;
    feed.textContent = "";
    var box = document.createElement("div");
    box.className = "state";
    var message = document.createElement("div");
    message.textContent = "Couldn't load the page. Check your connection.";
    var retry = document.createElement("button");
    retry.className = "retry-btn";
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", function () {
      location.reload();
    });
    box.appendChild(message);
    box.appendChild(retry);
    feed.appendChild(box);
  }

  Promise.all([fetchText(HEADER_URL), fetchText(NAV_URL)]).then(function (parts) {
    mount("headerSlot", parts[0]);
    mount("navSlot", parts[1]);
    return loadScriptsInOrder(TAB_SCRIPTS);
  }).then(initApp).catch(showBootError);

  function initApp() {
    var tabs = window.Tabs;
    var views = {
      home: document.getElementById("view-home"),
      subject: document.getElementById("view-subject"),
      shorts: document.getElementById("view-shorts")
    };
    var tabButtons = document.querySelectorAll(".nav-item[data-view]");
    var started = false;

    function select(target) {
      tabButtons.forEach(function (n) {
        n.classList.toggle("active", n.getAttribute("data-view") === target);
      });
      Object.keys(views).forEach(function (key) {
        views[key].classList.toggle("active", key === target);
      });
      document.documentElement.classList.toggle("shorts-mode", target === "shorts");
      if (tabs[target] && tabs[target].show) tabs[target].show();
      window.scrollTo(0, 0);
    }

    tabButtons.forEach(function (item) {
      item.addEventListener("click", function () {
        select(item.getAttribute("data-view"));
      });
    });

    var nextUrl = window.AuthSheet.nextUrl;

    function startApp(user) {
      if (started) return;
      started = true;
      tabs.home.start(user);
      tabs.subject.start();
      tabs.shorts.start();
      if (location.hash === "#shorts" || new URLSearchParams(location.search).get("short")) {
        select("shorts");
      } else if (location.hash === "#subject") {
        select("subject");
      }
    }

    window.AuthSheet.onComplete(startApp);

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        if (started) location.reload();
        return;
      }
      if (window.AuthSheet.isBusy()) return;
      if (nextUrl) {
        location.replace(nextUrl);
        return;
      }
      startApp(user);
    });
  }
})();