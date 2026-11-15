(function () {
  var SHEET_URL = "layout/auth-sheet.html";

  var overlay = null;
  var overlayPromise = null;
  var handlers = [];
  var busy = false;
  var nextUrl = readNext();
  var redirectChecked = false;
  var retryTimer = null;

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
        return "This sign-in method is not enabled in Firebase.";
      case "auth/auth-domain-config-required":
        return "Firebase authDomain is missing.";
      case "auth/account-exists-with-different-credential":
        return "An account already exists with this email using a different sign-in method.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/missing-password":
        return "Enter your password.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/email-already-in-use":
        return "An account with this email already exists. Try signing in.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
        return "Incorrect email or password.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  // Create users/{uid} on first login only. Never overwrites existing data.
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
    var $ = function (id) { return root.querySelector(id); };

    var errorBox = $("#asError");
    var infoBox = $("#asInfo");
    var googleBtn = $("#asGoogleBtn");
    var googleLabel = $("#asGoogleLabel");
    var form = $("#asEmailForm");
    var nameField = $("#asNameField");
    var nameInput = $("#asName");
    var emailInput = $("#asEmail");
    var passInput = $("#asPassword");
    var eyeBtn = $("#asEye");
    var forgotBtn = $("#asForgot");
    var submitBtn = $("#asSubmitBtn");
    var submitLabel = $("#asSubmitLabel");
    var switchText = $("#asSwitchText");
    var switchBtn = $("#asSwitchBtn");
    var titleEl = $("#asTitle");
    var descEl = $("#asDesc");

    var mode = "signin";

    function showError(message) {
      infoBox.classList.remove("visible");
      errorBox.textContent = message;
      errorBox.classList.add("visible");
    }

    function showInfo(message) {
      errorBox.classList.remove("visible");
      infoBox.textContent = message;
      infoBox.classList.add("visible");
    }

    function clearMessages() {
      errorBox.textContent = "";
      infoBox.textContent = "";
      errorBox.classList.remove("visible");
      infoBox.classList.remove("visible");
    }

    function setBusy(isBusy, which) {
      busy = isBusy;
      googleBtn.disabled = isBusy;
      submitBtn.disabled = isBusy;
      googleBtn.classList.toggle("loading", isBusy && which === "google");
      submitBtn.classList.toggle("loading", isBusy && which === "email");
      googleLabel.textContent = isBusy && which === "google" ? "Signing in..." : "Continue with Google";
      if (isBusy && which === "email") {
        submitLabel.textContent = mode === "signup" ? "Creating account..." : "Signing in...";
      } else {
        submitLabel.textContent = mode === "signup" ? "Create account" : "Sign in";
      }
    }

    function setMode(next) {
      mode = next;
      var signup = mode === "signup";
      nameField.hidden = !signup;
      forgotBtn.hidden = signup;
      titleEl.textContent = signup ? "Create account" : "Welcome back";
      descEl.textContent = signup ? "Join Durbar in a few seconds" : "Sign in to continue to Durbar";
      submitLabel.textContent = signup ? "Create account" : "Sign in";
      switchText.textContent = signup ? "Already have an account?" : "New to Durbar?";
      switchBtn.textContent = signup ? "Sign in" : "Create account";
      passInput.setAttribute("autocomplete", signup ? "new-password" : "current-password");
      clearMessages();
    }

    function complete(user) {
      ensureUserRecord(user).then(function () {
        setBusy(false);
        form.reset();
        if (nextUrl) {
          location.replace(nextUrl);
          return;
        }
        hide();
        handlers.forEach(function (fn) { fn(user); });
      });
    }

    function handleError(err) {
      setBusy(false);
      showError(messageFor(err && err.code));
    }

    // Google (Firebase OAuth)
    googleBtn.addEventListener("click", function () {
      if (busy) return;
      clearMessages();
      setBusy(true, "google");

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

    // Email + password
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      clearMessages();

      var email = emailInput.value.trim();
      var password = passInput.value;
      var name = nameInput.value.trim();

      if (!email) { showError("Enter your email address."); emailInput.focus(); return; }
      if (!password) { showError("Enter your password."); passInput.focus(); return; }
      if (mode === "signup" && !name) { showError("Enter your name."); nameInput.focus(); return; }
      if (mode === "signup" && password.length < 6) { showError(messageFor("auth/weak-password")); passInput.focus(); return; }

      setBusy(true, "email");

      if (mode === "signup") {
        auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
          return cred.user.updateProfile({ displayName: name }).catch(function () {}).then(function () {
            complete(cred.user);
          });
        }).catch(handleError);
      } else {
        auth.signInWithEmailAndPassword(email, password).then(function (cred) {
          complete(cred.user);
        }, handleError);
      }
    });

    // Forgot password
    forgotBtn.addEventListener("click", function () {
      if (busy) return;
      var email = emailInput.value.trim();
      if (!email) {
        showError("Enter your email above, then tap Forgot password.");
        emailInput.focus();
        return;
      }
      clearMessages();
      auth.sendPasswordResetEmail(email).then(function () {
        showInfo("Password reset email sent. Check your inbox.");
      }, function (err) {
        showError(messageFor(err && err.code));
      });
    });

    // Show / hide password
    eyeBtn.addEventListener("click", function () {
      var hidden = passInput.type === "password";
      passInput.type = hidden ? "text" : "password";
      eyeBtn.textContent = hidden ? "Hide" : "Show";
      eyeBtn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
    });

    switchBtn.addEventListener("click", function () {
      if (busy) return;
      setMode(mode === "signin" ? "signup" : "signin");
    });

    setMode("signin");

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
    }).catch(function () {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(show, 2000);
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

  // Keep users signed in across restarts, then watch auth state.
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