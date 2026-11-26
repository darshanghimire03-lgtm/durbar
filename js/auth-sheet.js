(function () {
  var SHEET_URL = "/html/auth-sheet.html";
  var SETUP_URL = "/account-setup/";
  var ME_URL = "/api/me";

  var overlay = null;
  var overlayPromise = null;
  var ui = null;
  var handlers = [];
  var busy = false;
  var checking = false;
  var redirecting = false;
  var signingUp = false;
  var redirectChecked = false;
  var retryTimer = null;
  var sessionPromise = null;
  var nextUrl = readNext();
  var profToken = readProfToken();
  var inviteOk = false;
  var restoreFailed = readRestoreFlag();

  function readRestoreFlag() {
    try {
      var v = sessionStorage.getItem("durbar_restore") === "1";
      sessionStorage.removeItem("durbar_restore");
      return v;
    } catch (e) {
      return false;
    }
  }

  function persistSession(data) {
    var apiKey = firebase.app().options.apiKey;
    var acc = data.account || {};
    var now = String(Date.now());
    var user = {
      uid: data.uid,
      email: acc.email || null,
      emailVerified: !!acc.emailVerified,
      displayName: acc.displayName || null,
      isAnonymous: false,
      photoURL: acc.photoUrl || null,
      phoneNumber: acc.phoneNumber || null,
      tenantId: null,
      providerData: (acc.providers || []).map(function (p) {
        return {
          uid: p.rawId || p.email || data.uid,
          displayName: p.displayName || null,
          email: p.email || null,
          phoneNumber: p.phoneNumber || null,
          photoURL: p.photoUrl || null,
          providerId: p.providerId
        };
      }),
      stsTokenManager: {
        refreshToken: data.refreshToken,
        accessToken: data.idToken,
        expirationTime: Date.now() + (Number(data.expiresIn) || 3600) * 1000
      },
      createdAt: String(acc.createdAt || now),
      lastLoginAt: String(acc.lastLoginAt || now),
      apiKey: apiKey,
      appName: "[DEFAULT]"
    };
    var key = "firebase:authUser:" + apiKey + ":[DEFAULT]";

    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        try {
          localStorage.setItem(key, JSON.stringify(user));
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }
      var req = indexedDB.open("firebaseLocalStorageDb", 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains("firebaseLocalStorage")) {
          d.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
        }
      };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var idb = req.result;
        var tx = idb.transaction("firebaseLocalStorage", "readwrite");
        tx.objectStore("firebaseLocalStorage").put({ fbase_key: key, value: user });
        tx.oncomplete = function () { idb.close(); resolve(); };
        tx.onerror = tx.onabort = function () { reject(tx.error); };
      };
    });
  }

  function checkWebsiteSession() {
    if (profToken || /^\/signup\/?$/.test(location.pathname)) return Promise.resolve(null);
    if (!sessionPromise) {
      sessionPromise = fetch(ME_URL, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (d) {
        if (!d || !d.loggedIn) return null;
        return {
          name: typeof d.name === "string" ? d.name : "",
          email: typeof d.email === "string" ? d.email : "",
          photo: typeof d.photo === "string" ? d.photo : ""
        };
      }).catch(function () {
        return null;
      });
    }
    return sessionPromise;
  }

  function readNext() {
    var raw = new URLSearchParams(location.search).get("next") || "";
    if (!/^\/[A-Za-z0-9_\-\/.]*([?#][^\s]*)?$/.test(raw)) return "";
    if (raw.indexOf("//") !== -1 || raw.indexOf("..") !== -1) return "";
    if (/^\/(index\.html)?([?#].*)?$/.test(raw)) return "";
    return raw;
  }

  function readProfToken() {
    var m = location.pathname.match(/^\/signup\/prof\/([A-Za-z0-9]{4,40})\/?$/);
    return m ? m[1] : "";
  }

  function checkInvite() {
    return db.ref("invite/proflinks").child(profToken).once("value").then(function (snap) {
      var v = snap.val();
      return !!v && v.accessToken === profToken;
    });
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

  function syncUrl(mode) {
    if (profToken) return;
    var path = mode === "signup" ? "/signup/" : "/login/";
    if (location.pathname === path) return;
    history.replaceState(null, "", path + location.search + location.hash);
  }

  function restoreUrl() {
    if (/^\/(login|signup)(\/prof\/[A-Za-z0-9]+)?\/?$/.test(location.pathname)) {
      history.replaceState(null, "", "/" + location.search + location.hash);
    }
  }

  function filled(v) {
    return typeof v === "string" && v.trim() !== "";
  }

  function isComplete(p) {
    if (!p) return false;
    var base = filled(p.fullName) && filled(p.phone) && filled(p.gender) &&
      filled(String(p.classLevel || "")) && filled(p.section);
    if (!base) return false;
    if (String(p.role || "").toLowerCase() === "professor") return filled(p.assignedSubject);
    return true;
  }

  function createBaseProfile(user, role, token) {
    var ref = db.ref("users").child(user.uid);
    return ref.once("value").then(function (snap) {
      var old = snap.val() || {};
      var data = {
        uid: user.uid,
        email: user.email || old.email || "",
        role: role || old.role || "student",
        createdAt: old.createdAt || firebase.database.ServerValue.TIMESTAMP,
        fullName: old.fullName || user.displayName || "",
        phone: old.phone || "",
        gender: old.gender || "",
        profileImageUrl: old.profileImageUrl || user.photoURL || ""
      };
      if (token) data.inviteToken = token;
      return ref.update(data);
    }).then(function () {
      if (!token) return;
      return ref.child("inviteToken").remove().catch(function () {});
    });
  }

  function goToSetup() {
    redirecting = true;
    checking = false;
    var url = SETUP_URL + (nextUrl ? "?next=" + encodeURIComponent(nextUrl) : "");
    location.replace(url);
  }

  function finish(user) {
    checking = false;
    redirecting = false;
    signingUp = false;
    if (ui) ui.setBusy(false);
    if (nextUrl) {
      location.replace(nextUrl);
      return;
    }
    hide();
    handlers.forEach(function (fn) { fn(user); });
  }

  function route(user) {
    checking = true;
    db.ref("users").child(user.uid).once("value").then(function (snap) {
      if (isComplete(snap.val())) {
        finish(user);
        return;
      }
      goToSetup();
    }).catch(function () {
      finish(user);
    });
  }

  function wireSheet(root) {
    var $ = function (sel) { return root.querySelector(sel); };

    var errorBox = $("#asError");
    var infoBox = $("#asInfo");
    var titleEl = $("#asTitle");
    var descEl = $("#asDesc");

    var continueBox = $("#asContinue");
    var avatarEl = $("#asAvatar");
    var accountName = $("#asAccountName");
    var accountEmail = $("#asAccountEmail");
    var continueBtn = $("#asContinueBtn");
    var continueLabel = $("#asContinueLabel");
    var anotherBtn = $("#asAnotherBtn");

    var signinForm = $("#asSigninForm");
    var signinEmail = $("#asEmail");
    var signinPass = $("#asPassword");
    var signinBtn = $("#asSigninBtn");
    var signinLabel = $("#asSigninLabel");
    var forgotBtn = $("#asForgot");

    var signupForm = $("#asSignupForm");
    var regEmail = $("#asRegEmail");
    var newPass = $("#asNewPass");
    var signupBtn = $("#asSignupBtn");
    var signupLabel = $("#asSignupLabel");

    var googleBlock = $("#asGoogleBlock");
    var googleBtn = $("#asGoogleBtn");
    var googleLabel = $("#asGoogleLabel");
    var switchRow = $("#asSwitchRow");
    var switchText = $("#asSwitchText");
    var switchBtn = $("#asSwitchBtn");

    var mode = profToken || /^\/signup\/?$/.test(location.pathname) ? "signup" : "signin";
    var continueMode = false;
    var continueText = "Continue";
    var continueEmail = "";

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
      signinBtn.disabled = isBusy;
      signupBtn.disabled = isBusy || (!!profToken && !inviteOk);
      continueBtn.disabled = isBusy;
      anotherBtn.disabled = isBusy;
      googleBtn.classList.toggle("loading", isBusy && which === "google");
      signinBtn.classList.toggle("loading", isBusy && which === "signin");
      signupBtn.classList.toggle("loading", isBusy && which === "signup");
      continueBtn.classList.toggle("loading", isBusy && which === "continue");
      googleLabel.textContent = isBusy && which === "google" ? "Signing in..." : "Continue with Google";
      signinLabel.textContent = isBusy && which === "signin" ? "Signing in..." : "Sign in";
      signupLabel.textContent = isBusy && which === "signup" ? "Creating account..." : "Create account";
      continueLabel.textContent = isBusy && which === "continue" ? "Signing in..." : continueText;
    }

    function paintAvatar(info) {
      avatarEl.textContent = (info.name || info.email || "?").trim().charAt(0).toUpperCase();
      if (!/^https:\/\//i.test(info.photo || "")) return;
      var img = new Image();
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onload = function () {
        avatarEl.textContent = "";
        avatarEl.appendChild(img);
      };
      img.src = info.photo;
    }

    function render() {
      var signin = mode === "signin";

      if (continueMode && !profToken) {
        continueBox.hidden = false;
        signinForm.hidden = true;
        signupForm.hidden = true;
        googleBlock.hidden = true;
        switchRow.hidden = true;
        titleEl.textContent = "Welcome back";
        descEl.textContent = "Continue with your Durbar account";
        return;
      }

      continueBox.hidden = true;
      signinForm.hidden = !signin;
      signupForm.hidden = signin;
      if (profToken) {
        titleEl.textContent = "Professor sign up";
        descEl.textContent = "Create your professor account. You'll add your details next.";
        switchRow.hidden = true;
        googleBlock.hidden = true;
        return;
      }
      switchRow.hidden = false;
      googleBlock.hidden = false;
      if (signin) {
        titleEl.textContent = "Welcome back";
        descEl.textContent = "Sign in to continue to Durbar";
        switchText.textContent = "New to Durbar?";
        switchBtn.textContent = "Create account";
      } else {
        titleEl.textContent = "Create account";
        descEl.textContent = "Just your email and a password. You'll add your details next.";
        switchText.textContent = "Already have an account?";
        switchBtn.textContent = "Sign in";
      }
    }

    function handleError(err) {
      setBusy(false);
      showError(messageFor(err && err.code));
    }

    function leaveContinue(message) {
      sessionPromise = Promise.resolve(null);
      continueMode = false;
      clearMessages();
      render();
      syncUrl(mode);
      if (continueEmail) signinEmail.value = continueEmail;
      if (message) showError(message);
      signinEmail.focus({ preventScroll: true });
    }

    continueBtn.addEventListener("click", function () {
      if (busy) return;
      clearMessages();
      setBusy(true, "continue");

      fetch(ME_URL, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          if (!res.ok || !d.uid || !d.idToken || !d.refreshToken) {
            throw new Error(d.error || "restore_failed");
          }
          return d;
        });
      }).then(function (data) {
        return persistSession(data);
      }).then(function () {
        try { sessionStorage.setItem("durbar_restore", "1"); } catch (e) {}
        location.reload();
      }).catch(function (err) {
        setBusy(false);
        if (err instanceof TypeError) {
          showError(messageFor("auth/network-request-failed"));
          return;
        }
        leaveContinue("Please sign in again to continue.");
      });
    });

    anotherBtn.addEventListener("click", function () {
      if (busy) return;
      leaveContinue("");
    });

    signinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      clearMessages();
      var email = signinEmail.value.trim();
      var password = signinPass.value;
      if (!email) { showError("Enter your email address."); signinEmail.focus(); return; }
      if (!password) { showError("Enter your password."); signinPass.focus(); return; }
      setBusy(true, "signin");
      auth.signInWithEmailAndPassword(email, password).catch(handleError);
    });

    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      if (profToken && !inviteOk) return;
      clearMessages();
      var email = regEmail.value.trim();
      var password = newPass.value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(messageFor("auth/invalid-email")); regEmail.focus(); return; }
      if (password.length < 6) { showError(messageFor("auth/weak-password")); newPass.focus(); return; }

      setBusy(true, "signup");
      signingUp = true;
      auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
        return createBaseProfile(cred.user, profToken ? "professor" : "", profToken).catch(function (err) {
          if (profToken) throw err;
        });
      }).then(function () {
        signingUp = false;
        goToSetup();
      }, function (err) {
        signingUp = false;
        handleError(err);
      });
    });

    forgotBtn.addEventListener("click", function () {
      if (busy) return;
      var email = signinEmail.value.trim();
      if (!email) {
        showError("Enter your email above, then tap Forgot password.");
        signinEmail.focus();
        return;
      }
      clearMessages();
      auth.sendPasswordResetEmail(email).then(function () {
        showInfo("Password reset email sent. Check your inbox.");
      }, function (err) {
        showError(messageFor(err && err.code));
      });
    });

    googleBtn.addEventListener("click", function () {
      if (busy) return;
      clearMessages();
      setBusy(true, "google");

      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      auth.signInWithPopup(provider).catch(function (err) {
        var code = err && err.code;
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
          auth.signInWithRedirect(provider).catch(handleError);
          return;
        }
        handleError(err);
      });
    });

    switchBtn.addEventListener("click", function () {
      if (busy || profToken) return;
      clearMessages();
      mode = mode === "signin" ? "signup" : "signin";
      render();
      syncUrl(mode);
      (mode === "signup" ? regEmail : signinEmail).focus({ preventScroll: true });
    });

    Array.prototype.forEach.call(root.querySelectorAll(".as-eye"), function (btn) {
      btn.addEventListener("click", function () {
        var input = root.querySelector("#" + btn.getAttribute("data-target"));
        var hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        btn.textContent = hidden ? "Hide" : "Show";
        btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
      });
    });

    if (!redirectChecked) {
      redirectChecked = true;
      auth.getRedirectResult().catch(function (err) {
        show({ form: true });
        handleError(err);
      });
    }

    render();

    if (profToken) {
      setBusy(false);
      checkInvite().then(function (ok) {
        inviteOk = ok;
        setBusy(false);
        if (!ok) showError("This invitation link is invalid or has expired.");
      }).catch(function () {
        inviteOk = false;
        setBusy(false);
        showError("Couldn't verify the invitation link. Check your connection and reload.");
      });
    }

    ui = {
      setBusy: setBusy,
      showError: showError,
      setContinue: function (info) {
        continueMode = !!info && !profToken;
        if (continueMode) {
          var label = info.name || info.email || "Durbar user";
          continueEmail = info.email || "";
          accountName.textContent = label;
          accountEmail.textContent = continueEmail;
          accountEmail.hidden = !continueEmail;
          continueText = "Continue as " + label;
          continueLabel.textContent = continueText;
          paintAvatar(info);
        }
        render();
      },
      sync: function () {
        if (!continueMode) syncUrl(mode);
      },
      reset: function () {
        mode = profToken || /^\/signup\/?$/.test(location.pathname) ? "signup" : "signin";
        continueMode = false;
        clearMessages();
        setBusy(false);
        render();
      }
    };
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

  function show(opts) {
    var wantForm = !!(opts && opts.form) || restoreFailed;
    checkWebsiteSession().then(function (info) {
      return build().then(function (el) {
        if (auth.currentUser) return;
        if (ui) ui.setContinue(wantForm ? null : info);
        if (restoreFailed && ui) {
          restoreFailed = false;
          ui.showError("Couldn't continue automatically. Please sign in.");
        }
        el.hidden = false;
        document.body.style.overflow = "hidden";
        if (ui) ui.sync();
      });
    }).catch(function () {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(show, 2000);
    });
  }

  function hide() {
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = "";
    restoreUrl();
  }

  window.AuthSheet = {
    show: show,
    hide: hide,
    nextUrl: nextUrl,
    isBusy: function () { return busy || checking || redirecting; },
    onComplete: function (fn) { handlers.push(fn); }
  };

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      checking = false;
      redirecting = false;
      if (ui) ui.reset();
      show();
      return;
    }
    if (signingUp) return;
    route(user);
  });
})();