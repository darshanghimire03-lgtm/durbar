(function () {
  var SHEET_URL = "layout/auth-sheet.html";

  var overlay = null;
  var overlayPromise = null;
  var handlers = [];
  var nextUrl = readNext();

  function readNext() {
    var raw = new URLSearchParams(location.search).get("next") || "";
    if (!/^\/[A-Za-z0-9_\-\/.]*([?#][^\s]*)?$/.test(raw)) return "";
    if (raw.indexOf("//") !== -1 || raw.indexOf("..") !== -1) return "";
    if (/^\/(index\.html)?([?#].*)?$/.test(raw)) return "";
    return raw;
  }

  function messageFor(code) {
    switch (code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Sign-in was cancelled.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      case "auth/unauthorized-domain":
        return "This website is not authorized in Firebase. Add it under Authentication > Settings > Authorized domains.";
      case "auth/operation-not-allowed":
        return "Google sign-in is not enabled in Firebase.";
      case "auth/auth-domain-config-required":
        return "Firebase authDomain is missing.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      default:
        return "Sign-in failed. Please try again.";
    }
  }

  function wireSheet(root) {
    var errorBox = root.querySelector("#asError");
    var googleBtn = root.querySelector("#asGoogleBtn");
    var googleLabel = root.querySelector("#asGoogleLabel");

    function showError(message) {
      errorBox.textContent = message;
      errorBox.classList.add("visible");
    }

    function clearError() {
      errorBox.textContent = "";
      errorBox.classList.remove("visible");
    }

    function setLoading(isLoading) {
      googleBtn.disabled = isLoading;
      googleBtn.classList.toggle("loading", isLoading);
      googleLabel.textContent = isLoading ? "Signing in..." : "Continue with Google";
    }

    function complete(user) {
      if (nextUrl) {
        location.replace(nextUrl);
        return;
      }
      hide();
      handlers.forEach(function (fn) { fn(user); });
    }

    googleBtn.addEventListener("click", function () {
      clearError();
      setLoading(true);

      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      auth.signInWithPopup(provider).then(function (cred) {
        setLoading(false);
        complete(cred.user);
      }, function (err) {
        var code = err && err.code;
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
          auth.signInWithRedirect(provider);
          return;
        }
        setLoading(false);
        showError(messageFor(code));
      });
    });
  }

  function build() {
    if (overlay) return Promise.resolve(overlay);
    if (overlayPromise) return overlayPromise;
    overlayPromise = fetch(SHEET_URL).then(function (res) {
      if (!res.ok) throw new Error("sheet");
      return res.text();
    }).then(function (html) {
      var holder = document.createElement("template");
      holder.innerHTML = html.trim();
      var root = holder.content;
      wireSheet(root);
      overlay = root.querySelector("#authSheet");
      document.body.appendChild(root);
      return overlay;
    }).catch(function (err) {
      overlayPromise = null;
      throw err;
    });
    return overlayPromise;
  }

  function show() {
    build().then(function (el) {
      if (auth.currentUser) return;
      el.hidden = false;
      document.body.style.overflow = "hidden";
    }).catch(function () {
      setTimeout(show, 2000);
    });
  }

  function hide() {
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = "";
  }

  window.AuthSheet = {
    show: show,
    hide: hide,
    nextUrl: nextUrl,
    isBusy: function () { return false; },
    onComplete: function (fn) { handlers.push(fn); }
  };

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      show();
      return;
    }
    hide();
  });
})();