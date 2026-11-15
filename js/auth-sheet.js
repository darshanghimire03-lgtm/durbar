(function () {
  var SHEET_URL = "layout/auth-sheet.html";

  var overlay = null;
  var overlayPromise = null;
  var ui = null;
  var handlers = [];
  var busy = false;          // a sign-in / save request is running
  var checking = false;      // checking the user's profile after sign-in
  var needsProfile = false;  // profile step is on screen
  var signingUp = false;     // account creation in progress
  var redirectChecked = false;
  var retryTimer = null;
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

  function filled(v) {
    return typeof v === "string" && v.trim() !== "";
  }

  function isComplete(p) {
    return !!p && filled(p.fullName) && filled(p.phone) && filled(p.gender) &&
      filled(String(p.classLevel || "")) && filled(p.section);
  }

  // Writes users/{uid}. Keeps existing role / photo / createdAt, defaults role to "student".
  function saveProfile(user, data) {
    var ref = db.ref("users").child(user.uid);
    return ref.once("value").then(function (snap) {
      var old = snap.val() || {};
      return ref.update({
        uid: user.uid,
        email: user.email || data.email || "",
        fullName: data.fullName,
        profileImageUrl: old.profileImageUrl || user.photoURL || "",
        role: old.role || "student",
        phone: data.phone,
        gender: data.gender,
        classLevel: data.classLevel,
        section: data.section,
        createdAt: old.createdAt || firebase.database.ServerValue.TIMESTAMP
      });
    }).then(function () {
      if (!user.displayName && data.fullName) {
        return user.updateProfile({ displayName: data.fullName }).catch(function () {});
      }
    });
  }

  function finish(user) {
    checking = false;
    needsProfile = false;
    signingUp = false;
    if (ui) ui.setBusy(false);
    if (nextUrl) {
      location.replace(nextUrl);
      return;
    }
    hide();
    handlers.forEach(function (fn) { fn(user); });
  }

  // After any sign-in: if the profile is incomplete, show the profile steps.
  function route(user) {
    checking = true;
    db.ref("users").child(user.uid).once("value").then(function (snap) {
      var p = snap.val() || {};
      if (isComplete(p)) {
        finish(user);
        return;
      }
      return build().then(function (el) {
        checking = false;
        needsProfile = true;
        ui.startComplete(user, p);
        el.hidden = false;
        document.body.style.overflow = "hidden";
      });
    }).catch(function () {
      finish(user);
    });
  }

  function wireSheet(root) {
    var $ = function (sel) { return root.querySelector(sel); };

    var errorBox = $("#asError");
    var infoBox = $("#asInfo");
    var topbar = $("#asTopbar");
    var backBtn = $("#asBack");
    var progress = Array.prototype.slice.call(root.querySelectorAll("#asProgress i"));
    var stepCount = $("#asStepCount");
    var titleEl = $("#asTitle");
    var descEl = $("#asDesc");

    var signinForm = $("#asSigninForm");
    var signinEmail = $("#asEmail");
    var signinPass = $("#asPassword");
    var signinBtn = $("#asSigninBtn");
    var signinLabel = $("#asSigninLabel");
    var forgotBtn = $("#asForgot");

    var wizard = $("#asWizard");
    var panes = Array.prototype.slice.call(root.querySelectorAll(".as-step"));
    var nameInput = $("#asName");
    var regEmail = $("#asRegEmail");
    var phoneInput = $("#asPhone");
    var newPass = $("#asNewPass");
    var confirmPass = $("#asConfirm");
    var nextBtn = $("#asNextBtn");
    var nextLabel = $("#asNextLabel");

    var signOutBtn = $("#asSignOut");
    var googleBlock = $("#asGoogleBlock");
    var googleBtn = $("#asGoogleBtn");
    var googleLabel = $("#asGoogleLabel");
    var switchRow = $("#asSwitchRow");
    var switchText = $("#asSwitchText");
    var switchBtn = $("#asSwitchBtn");

    var mode = "signin"; // signin | signup | complete
    var stepIdx = 0;

    var TITLES = {
      signup: [
        ["Create account", "Let's start with your name and email"],
        ["Contact details", "Your phone number and gender"],
        ["Your class", "Choose your class level and section"],
        ["Set a password", "Keep your account secure"]
      ],
      complete: [
        ["Complete your profile", "Confirm your name to continue"],
        ["Contact details", "Your phone number and gender"],
        ["Your class", "Choose your class level and section"]
      ]
    };

    function steps() {
      return mode === "signup" ? [1, 2, 3, 4] : [1, 2, 3];
    }

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

    function nextText(loading) {
      var last = stepIdx === steps().length - 1;
      if (loading) return mode === "signup" ? "Creating account..." : "Saving...";
      if (last) return mode === "signup" ? "Create account" : "Save";
      return "Next";
    }

    function setBusy(isBusy, which) {
      busy = isBusy;
      googleBtn.disabled = isBusy;
      signinBtn.disabled = isBusy;
      nextBtn.disabled = isBusy;
      backBtn.disabled = isBusy;
      googleBtn.classList.toggle("loading", isBusy && which === "google");
      signinBtn.classList.toggle("loading", isBusy && which === "signin");
      nextBtn.classList.toggle("loading", isBusy && which === "next");
      googleLabel.textContent = isBusy && which === "google" ? "Signing in..." : "Continue with Google";
      signinLabel.textContent = isBusy && which === "signin" ? "Signing in..." : "Sign in";
      nextLabel.textContent = nextText(isBusy && which === "next");
    }

    function render() {
      var signin = mode === "signin";
      var list = steps();
      var stepNo = list[stepIdx];
      var entry = signin || (mode === "signup" && stepIdx === 0);

      signinForm.hidden = !signin;
      wizard.hidden = signin;
      topbar.hidden = signin;
      googleBlock.hidden = !entry;
      switchRow.hidden = !entry;
      signOutBtn.hidden = mode !== "complete";

      panes.forEach(function (p) {
        p.hidden = signin || Number(p.getAttribute("data-step")) !== stepNo;
      });
      progress.forEach(function (bar, i) {
        bar.hidden = i >= list.length;
        bar.classList.toggle("done", i <= stepIdx);
      });
      stepCount.textContent = (stepIdx + 1) + "/" + list.length;
      backBtn.style.visibility = (mode === "complete" && stepIdx === 0) ? "hidden" : "visible";
      regEmail.readOnly = mode === "complete";

      if (signin) {
        titleEl.textContent = "Welcome back";
        descEl.textContent = "Sign in to continue to Durbar";
        switchText.textContent = "New to Durbar?";
        switchBtn.textContent = "Create account";
      } else {
        var t = TITLES[mode][stepIdx];
        titleEl.textContent = t[0];
        descEl.textContent = t[1];
        switchText.textContent = "Already have an account?";
        switchBtn.textContent = "Sign in";
      }
      nextLabel.textContent = nextText(false);
    }

    function focusPane() {
      var pane = panes.filter(function (p) { return !p.hidden; })[0];
      var input = pane && pane.querySelector("input:not([readonly]):not([type=radio])");
      if (input) input.focus({ preventScroll: true });
    }

    function radioValue(name) {
      var r = wizard.querySelector('input[name="' + name + '"]:checked');
      return r ? r.value : "";
    }

    function setRadio(name, value) {
      Array.prototype.forEach.call(wizard.querySelectorAll('input[name="' + name + '"]'), function (r) {
        r.checked = !!value && r.value === String(value);
      });
    }

    function collect() {
      return {
        fullName: nameInput.value.trim(),
        email: regEmail.value.trim(),
        phone: "+977 " + phoneInput.value.trim(),
        gender: radioValue("gender"),
        classLevel: radioValue("classLevel"),
        section: radioValue("section")
      };
    }

    function validate(stepNo) {
      if (stepNo === 1) {
        if (nameInput.value.trim().length < 2) return { msg: "Enter your full name.", el: nameInput };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.value.trim())) return { msg: "Enter a valid email address.", el: regEmail };
      }
      if (stepNo === 2) {
        if (!/^9[78]\d{8}$/.test(phoneInput.value.trim())) return { msg: "Enter a valid 10-digit phone number (starts with 97 or 98).", el: phoneInput };
        if (!radioValue("gender")) return { msg: "Select your gender." };
      }
      if (stepNo === 3) {
        if (!radioValue("classLevel")) return { msg: "Select your class level." };
        if (!radioValue("section")) return { msg: "Select your section." };
      }
      if (stepNo === 4) {
        if (newPass.value.length < 6) return { msg: messageFor("auth/weak-password"), el: newPass };
        if (newPass.value !== confirmPass.value) return { msg: "Passwords do not match.", el: confirmPass };
      }
      return null;
    }

    function handleError(err) {
      setBusy(false);
      showError(messageFor(err && err.code));
    }

    // ---- Sign in (email) ----
    signinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      clearMessages();
      var email = signinEmail.value.trim();
      var password = signinPass.value;
      if (!email) { showError("Enter your email address."); signinEmail.focus(); return; }
      if (!password) { showError("Enter your password."); signinPass.focus(); return; }
      setBusy(true, "signin");
      // onAuthStateChanged continues the flow
      auth.signInWithEmailAndPassword(email, password).catch(handleError);
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

    // ---- Google (Firebase OAuth) ----
    googleBtn.addEventListener("click", function () {
      if (busy) return;
      clearMessages();
      setBusy(true, "google");

      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      // onAuthStateChanged continues the flow (profile check, then app)
      auth.signInWithPopup(provider).catch(function (err) {
        var code = err && err.code;
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
          auth.signInWithRedirect(provider).catch(handleError);
          return;
        }
        handleError(err);
      });
    });

    // ---- Wizard (create account / complete profile) ----
    wizard.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      clearMessages();

      var list = steps();
      var err = validate(list[stepIdx]);
      if (err) {
        showError(err.msg);
        if (err.el) err.el.focus();
        return;
      }
      if (stepIdx < list.length - 1) {
        stepIdx++;
        render();
        focusPane();
        return;
      }
      submitWizard();
    });

    function submitWizard() {
      var data = collect();

      if (mode === "signup") {
        setBusy(true, "next");
        signingUp = true;
        auth.createUserWithEmailAndPassword(data.email, newPass.value).then(function (cred) {
          var user = cred.user;
          return user.updateProfile({ displayName: data.fullName }).catch(function () {}).then(function () {
            return saveProfile(user, data);
          }).then(function () {
            signingUp = false;
            finish(user);
          }, function () {
            // Account exists but profile write failed: let the user retry with Save
            signingUp = false;
            needsProfile = true;
            mode = "complete";
            stepIdx = steps().length - 1;
            setBusy(false);
            render();
            showError("Account created, but we couldn't save your details. Tap Save to try again.");
          });
        }).catch(function (err) {
          signingUp = false;
          setBusy(false);
          if (err && (err.code === "auth/email-already-in-use" || err.code === "auth/invalid-email")) {
            stepIdx = 0;
            render();
          }
          showError(messageFor(err && err.code));
        });
        return;
      }

      // complete profile (Google / existing users)
      var user = auth.currentUser;
      if (!user) { showError("Please sign in again."); return; }
      setBusy(true, "next");
      saveProfile(user, data).then(function () {
        finish(user);
      }, function () {
        setBusy(false);
        showError("Couldn't save your details. Please try again.");
      });
    }

    backBtn.addEventListener("click", function () {
      if (busy) return;
      clearMessages();
      if (stepIdx > 0) {
        stepIdx--;
      } else if (mode === "signup") {
        mode = "signin";
      }
      render();
    });

    switchBtn.addEventListener("click", function () {
      if (busy) return;
      clearMessages();
      mode = mode === "signin" ? "signup" : "signin";
      stepIdx = 0;
      render();
      if (mode === "signup") focusPane();
    });

    signOutBtn.addEventListener("click", function () {
      if (busy) return;
      auth.signOut();
    });

    // Phone: digits only
    phoneInput.addEventListener("input", function () {
      phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
    });

    // Show / hide password
    Array.prototype.forEach.call(root.querySelectorAll(".as-eye"), function (btn) {
      btn.addEventListener("click", function () {
        var input = root.querySelector("#" + btn.getAttribute("data-target"));
        var hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        btn.textContent = hidden ? "Hide" : "Show";
        btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
      });
    });

    // Result of a signInWithRedirect fallback
    if (!redirectChecked) {
      redirectChecked = true;
      auth.getRedirectResult().catch(function (err) {
        show();
        handleError(err);
      });
    }

    render();

    ui = {
      setBusy: setBusy,
      reset: function () {
        if (mode === "complete") {
          mode = "signin";
          stepIdx = 0;
          wizard.reset();
          clearMessages();
          setBusy(false);
          render();
        }
      },
      // Same steps as signup, minus the password step; last button is "Save"
      startComplete: function (user, profile) {
        mode = "complete";
        stepIdx = 0;
        clearMessages();
        setBusy(false);
        nameInput.value = profile.fullName || user.displayName || "";
        regEmail.value = user.email || profile.email || "";
        phoneInput.value = String(profile.phone || "").replace(/^\+977/, "").replace(/\D/g, "").slice(0, 10);
        setRadio("gender", profile.gender);
        setRadio("classLevel", profile.classLevel || "11");
        setRadio("section", profile.section);
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
    // true while signing in, checking the profile, or on the profile steps
    isBusy: function () { return busy || checking || needsProfile; },
    onComplete: function (fn) { handlers.push(fn); }
  };

  // Registered immediately so it runs before the page's own auth listener.
  auth.onAuthStateChanged(function (user) {
    if (!user) {
      checking = false;
      needsProfile = false;
      if (ui) ui.reset();
      show();
      return;
    }
    if (signingUp) return; // signup flow saves the profile itself
    route(user);
  });
})();