(function () {
  var SHEET_URL = "layout/auth-sheet.html";

  var overlay = null;
  var overlayPromise = null;
  var handlers = [];
  var busy = false;
  var nextUrl = readNext();
  var redirectChecked = false;
  var showBound = null;

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
      case "auth/account-exists-with-different-credential":
        return "An account already exists with this email using a different sign-in method.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      default:
        return "Sign-in failed. Please try again.";
    }
  }

  // Create the users/{uid} record on first login only. Never overwrites existing data.
  function ensureUserRecord(user) {
    if (!user) return Promise.resolve();
    var ref = db.ref("users").child(user.uid);
    return ref.once("value").then(function (snap) {
      if (snap.exists()) return;
      return ref.update({
        fullName: user.displayName || "",
        email: user.email || "",
        profileImageUrl: user.photoURL || "",
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
    }).catch(function () {});
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
      busy = isLoading;
      googleBtn.disabled = isLoading;
      googleBtn.classList.toggle("loading", isLoading);
      googleLabel.textContent = isLoading ? "Signing in..." : "Continue with Google";
    }

    function complete(user) {
      ensureUserRecord(user).then(function () {
        setLoading(false);
        if (nextUrl) {
          location.replace(nextUrl);
          return;
        }
        hide();
        handlers.forEach(function (fn) { fn(user); });
      });
    }

    function handleError(err) {
      setLoading(false);
      showError(messageFor(err && err.code));
    }

    googleBtn.addEventListener("click", function () {
      if (busy) return;
      clearError();
      setLoading(true);

      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      auth.signInWithPopup(provider).then(function (cred) {
        complete(cred.user);
      }, function (err) {
        var code = err && err.code;
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
          auth.signInWithRedirect(provider).catch(handleError);
          return;
        }
        handleError(err);
      });
    });

    // Result of a signInWithRedirect fallback (runs after the page reloads)
    if (!redirectChecked) {
      redirectChecked = true;
      auth.getRedirectResult().then(function (cred) {
        if (cred && cred.user) complete(cred.user);
      }, function (err) {
        show();
        handleError(err);
      });
    }
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
      overlay = root.querySelector("#authSheet");
      wireSheet(root);
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
      var btn = el.querySelector("#asGoogleBtn");
      if (btn && !busy) btn.focus({ preventScroll: true });
    }).catch(function () {
      clearTimeout(showBound);
      showBound = setTimeout(show, 2000);
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
    isBusy: function () { return busy; },
    onComplete: function (fn) { handlers.push(fn); }
  };

  // Keep the user signed in across browser restarts, then watch auth state.
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {}).then(function () {
    auth.onAuthStateChanged(function (user) {
      if (!user) {
        show();
        return;
      }
      hide();
    });
  });
})();