(function () {
  var HEADER_URL = "layout/header.html";
  var NAV_URL = "layout/navigation.html";
  var TAB_SCRIPTS = ["js/post.js", "js/shorts.js", "js/subject.js", "js/mock.js"];

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

  function showBootError(err) {
    var feed = document.getElementById("feed");
    if (!feed) return;
    var detail = err && err.message ? err.message : "";
    if (typeof auth === "undefined" || typeof db === "undefined") {
      detail = "Firebase is not configured. Check the Vercel environment variables.";
    }
    console.error("Boot failed", err);
    feed.textContent = "";
    var box = document.createElement("div");
    box.className = "state";
    var message = document.createElement("div");
    message.textContent = "Couldn't load the page. Check your connection.";
    box.appendChild(message);
    if (detail) {
      var info = document.createElement("div");
      info.textContent = detail;
      info.style.fontSize = "0.8rem";
      info.style.marginTop = "8px";
      box.appendChild(info);
    }
    var retry = document.createElement("button");
    retry.className = "retry-btn";
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", function () {
      location.reload();
    });
    box.appendChild(retry);
    feed.appendChild(box);
  }

  function loadTabScripts() {
    return Promise.all(TAB_SCRIPTS.map(function (src) {
      return loadScript(src).then(function () {
        return null;
      }, function (err) {
        return err;
      });
    })).then(function (results) {
      var failed = results.filter(Boolean);
      if (failed.length === TAB_SCRIPTS.length) throw failed[0];
      if (!window.Tabs || !window.Tabs.home) throw new Error("Missing " + TAB_SCRIPTS[0]);
    });
  }

  Promise.all([fetchText(HEADER_URL), fetchText(NAV_URL)]).then(function (parts) {
    mount("headerSlot", parts[0]);
    mount("navSlot", parts[1]);
    return loadTabScripts();
  }).then(initApp).catch(showBootError);

  function initApp() {
    var tabs = window.Tabs;
    var views = {
      home: document.getElementById("view-home"),
      subject: document.getElementById("view-subject"),
      mock: document.getElementById("view-mock"),
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

    var sheetApi = window.AuthSheet || {
      nextUrl: "",
      isBusy: function () { return false; },
      onComplete: function () {}
    };
    var nextUrl = sheetApi.nextUrl;

    function safeStart(tab, user) {
      try {
        if (tabs[tab] && tabs[tab].start) tabs[tab].start(user);
      } catch (err) {
        console.error(tab + " failed to start", err);
      }
    }

    function startApp(user) {
      if (started) return;
      started = true;
      safeStart("home", user);
      safeStart("subject", user);
      safeStart("mock", user);
      safeStart("shorts", user);
      if (location.hash === "#shorts" || new URLSearchParams(location.search).get("short")) {
        select("shorts");
      } else if (location.hash === "#subject") {
        select("subject");
      } else if (location.hash === "#mock") {
        select("mock");
      }
    }

    sheetApi.onComplete(startApp);

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        if (started) location.reload();
        return;
      }
      if (sheetApi.isBusy()) return;
      if (nextUrl) {
        location.replace(nextUrl);
        return;
      }
      startApp(user);
    });
  }
})();