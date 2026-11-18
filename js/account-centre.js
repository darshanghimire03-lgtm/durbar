(function () {
  var DEFAULT_AVATAR = "/favicon.png";

  function $(id) { return document.getElementById(id); }

  var heroAvatar = $("heroAvatar");
  var heroName = $("heroName");
  var heroEmail = $("heroEmail");
  var heroRole = $("heroRole");
  var nameSub = $("nameSub");
  var phoneSub = $("phoneSub");
  var passPill = $("passPill");
  var googlePill = $("googlePill");
  var nameRow = $("nameRow");
  var phoneRow = $("phoneRow");
  var passRow = $("passRow");
  var googleRow = $("googleRow");
  var changePassRow = $("changePassRow");
  var deleteRow = $("deleteRow");
  var backBtn = $("backBtn");
  var overlay = $("overlay");
  var sheetTitle = $("sheetTitle");
  var sheetDesc = $("sheetDesc");
  var sheetError = $("sheetError");
  var sheetForm = $("sheetForm");
  var sheetFields = $("sheetFields");
  var sheetSubmit = $("sheetSubmit");
  var sheetSubmitLabel = $("sheetSubmitLabel");
  var sheetCancel = $("sheetCancel");
  var toastEl = $("toast");

  var currentUser = null;
  var profile = {};
  var sheetCfg = null;
  var sheetBusy = false;
  var linking = false;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 3000);
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  function hasProvider(id) {
    return !!currentUser && currentUser.providerData.some(function (p) {
      return p && p.providerId === id;
    });
  }

  function errorMessage(err) {
    var code = err && err.code;
    switch (code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
        return "Incorrect password.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Sign-in was cancelled.";
      case "auth/popup-blocked":
        return "Popup was blocked. Allow popups and try again.";
      case "auth/credential-already-in-use":
        return "That Google account is already linked to another Durbar account.";
      case "auth/provider-already-linked":
        return "This sign-in method is already linked.";
      case "auth/user-mismatch":
        return "Please use the same account you are signed in with.";
      case "auth/requires-recent-login":
        return "Please sign in again and retry.";
      case "auth/operation-not-supported-in-this-environment":
        return "This action isn't supported in this browser.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  function setPill(el, linked, actionText) {
    el.textContent = linked ? "Linked" : actionText;
    el.className = "pill " + (linked ? "linked" : "action");
  }

  function render() {
    var user = currentUser;
    if (!user) return;
    var name = (typeof profile.fullName === "string" && profile.fullName.trim()) ||
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "Student");
    var role = typeof profile.role === "string" ? profile.role.trim() : "";
    var pass = hasProvider("password");
    var google = hasProvider("google.com");

    heroName.textContent = name;
    heroEmail.textContent = user.email || profile.email || "";
    heroRole.textContent = capitalize(role.toLowerCase());
    heroRole.hidden = !role;
    heroAvatar.src = profile.profileImageUrl || user.photoURL || DEFAULT_AVATAR;
    nameSub.textContent = name;
    phoneSub.textContent = profile.phone || "Add phone number";

    setPill(passPill, pass, "Create");
    setPill(googlePill, google, "Link");
    passRow.disabled = pass;
    googleRow.disabled = google;
    changePassRow.hidden = !pass;
  }

  function clearSheetError() {
    sheetError.textContent = "";
    sheetError.classList.remove("visible");
  }

  function showSheetError(message) {
    sheetError.textContent = message;
    sheetError.classList.add("visible");
  }

  function setSheetBusy(isBusy) {
    sheetBusy = isBusy;
    sheetSubmit.disabled = isBusy;
    sheetCancel.disabled = isBusy;
    sheetSubmit.classList.toggle("loading", isBusy);
  }

  function openSheet(cfg) {
    sheetCfg = cfg;
    sheetTitle.textContent = cfg.title;
    sheetDesc.textContent = cfg.desc || "";
    sheetDesc.hidden = !cfg.desc;
    sheetSubmitLabel.textContent = cfg.submitLabel;
    sheetSubmit.classList.toggle("danger", !!cfg.danger);
    clearSheetError();
    sheetFields.textContent = "";

    (cfg.fields || []).forEach(function (f) {
      var wrap = document.createElement("label");
      wrap.className = "field";

      var lbl = document.createElement("span");
      lbl.className = "label";
      lbl.textContent = f.label;
      wrap.appendChild(lbl);

      var input = document.createElement("input");
      input.id = "f_" + f.id;
      input.type = f.type || "text";
      input.value = f.value || "";
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.autocomplete) input.autocomplete = f.autocomplete;
      if (f.inputmode) input.inputMode = f.inputmode;
      if (f.maxlength) input.maxLength = f.maxlength;

      if (f.prefix) {
        var row = document.createElement("div");
        row.className = "phone";
        var pre = document.createElement("span");
        pre.className = "prefix";
        pre.textContent = f.prefix;
        row.appendChild(pre);
        row.appendChild(input);
        wrap.appendChild(row);
      } else {
        wrap.appendChild(input);
      }

      if (f.digitsOnly) {
        input.addEventListener("input", function () {
          input.value = input.value.replace(/\D/g, "").slice(0, f.maxlength || 10);
        });
      }

      sheetFields.appendChild(wrap);
    });

    overlay.hidden = false;
    document.body.classList.add("sheet-open");

    var first = sheetFields.querySelector("input");
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closeSheet() {
    if (sheetBusy) return;
    overlay.hidden = true;
    document.body.classList.remove("sheet-open");
    sheetCfg = null;
    sheetFields.textContent = "";
  }

  function reauth(password) {
    if (password) {
      var cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
      return currentUser.reauthenticateWithCredential(cred);
    }
    return currentUser.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
  }

  function withRecentLogin(fn) {
    return fn().catch(function (err) {
      if (err && err.code === "auth/requires-recent-login") {
        return reauth("").then(fn);
      }
      throw err;
    });
  }

  function editName() {
    openSheet({
      title: "Edit name",
      desc: "This is the name your classmates will see.",
      submitLabel: "Save",
      fields: [{
        id: "name",
        label: "Full name",
        value: profile.fullName || currentUser.displayName || "",
        placeholder: "Your full name",
        autocomplete: "name"
      }],
      onSubmit: function (v) {
        var name = v.name.trim();
        if (name.length < 2) throw new Error("Enter your full name.");
        return db.ref("users").child(currentUser.uid).update({ fullName: name }).then(function () {
          profile.fullName = name;
          return currentUser.updateProfile({ displayName: name }).catch(function () {});
        }).then(function () {
          render();
          showToast("Name updated");
        });
      }
    });
  }

  function editPhone() {
    openSheet({
      title: "Edit phone number",
      desc: "Enter your 10-digit mobile number.",
      submitLabel: "Save",
      fields: [{
        id: "phone",
        label: "Phone number",
        prefix: "+977",
        type: "tel",
        value: String(profile.phone || "").replace(/^\+977/, "").replace(/\D/g, "").slice(0, 10),
        placeholder: "98XXXXXXXX",
        autocomplete: "tel-national",
        inputmode: "numeric",
        maxlength: 10,
        digitsOnly: true
      }],
      onSubmit: function (v) {
        var digits = v.phone.trim();
        if (!/^9[78]\d{8}$/.test(digits)) throw new Error("Enter a valid 10-digit phone number (starts with 97 or 98).");
        var phone = "+977 " + digits;
        return db.ref("users").child(currentUser.uid).update({ phone: phone }).then(function () {
          profile.phone = phone;
          render();
          showToast("Phone number updated");
        });
      }
    });
  }

  function createPassword() {
    if (hasProvider("password")) return;
    openSheet({
      title: "Create password",
      desc: "Add a password so you can also sign in with your email " + (currentUser.email || "") + ".",
      submitLabel: "Create password",
      fields: [
        { id: "password", label: "New password", type: "password", placeholder: "At least 6 characters", autocomplete: "new-password" },
        { id: "confirm", label: "Confirm password", type: "password", placeholder: "Repeat password", autocomplete: "new-password" }
      ],
      onSubmit: function (v) {
        if (!currentUser.email) throw new Error("Your account has no email address.");
        if (v.password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (v.password !== v.confirm) throw new Error("Passwords don't match.");
        return withRecentLogin(function () {
          var cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, v.password);
          return currentUser.linkWithCredential(cred);
        }).then(function () {
          return currentUser.reload();
        }).then(function () {
          render();
          showToast("Password created");
        });
      }
    });
  }

  function changePassword() {
    openSheet({
      title: "Change password",
      submitLabel: "Update password",
      fields: [
        { id: "current", label: "Current password", type: "password", placeholder: "Current password", autocomplete: "current-password" },
        { id: "next", label: "New password", type: "password", placeholder: "At least 6 characters", autocomplete: "new-password" },
        { id: "confirm", label: "Confirm new password", type: "password", placeholder: "Repeat new password", autocomplete: "new-password" }
      ],
      onSubmit: function (v) {
        if (!v.current) throw new Error("Enter your current password.");
        if (v.next.length < 6) throw new Error("Password must be at least 6 characters.");
        if (v.next !== v.confirm) throw new Error("Passwords don't match.");
        if (v.next === v.current) throw new Error("New password must be different from the current one.");
        return reauth(v.current).then(function () {
          return currentUser.updatePassword(v.next);
        }).then(function () {
          showToast("Password updated");
        });
      }
    });
  }

  function deleteAccount() {
    var usesPassword = hasProvider("password");
    openSheet({
      title: "Delete account",
      desc: usesPassword
        ? "This permanently deletes your account and data. This can't be undone. Enter your password to confirm."
        : "This permanently deletes your account and data. This can't be undone. You'll be asked to confirm with Google.",
      submitLabel: "Delete account",
      danger: true,
      fields: usesPassword
        ? [{ id: "password", label: "Password", type: "password", placeholder: "Your password", autocomplete: "current-password" }]
        : [],
      onSubmit: function (v) {
        if (usesPassword && !v.password) throw new Error("Enter your password.");
        var uid = currentUser.uid;
        return reauth(usesPassword ? v.password : "").then(function () {
          return db.ref("users").child(uid).remove().catch(function () {});
        }).then(function () {
          return currentUser.delete();
        }).then(function () {
          location.replace("/");
        });
      }
    });
  }

  function linkGoogle() {
    if (linking || hasProvider("google.com")) return;
    linking = true;
    currentUser.linkWithPopup(new firebase.auth.GoogleAuthProvider()).then(function () {
      return currentUser.reload();
    }).then(function () {
      render();
      showToast("Google account linked");
    }).catch(function (err) {
      showToast(errorMessage(err));
    }).then(function () {
      linking = false;
    });
  }

  sheetForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sheetBusy || !sheetCfg) return;
    clearSheetError();

    var values = {};
    Array.prototype.forEach.call(sheetFields.querySelectorAll("input"), function (input) {
      values[input.id.slice(2)] = input.value;
    });

    setSheetBusy(true);

    var result;
    try {
      result = Promise.resolve(sheetCfg.onSubmit(values));
    } catch (err) {
      result = Promise.reject(err);
    }

    result.then(function () {
      setSheetBusy(false);
      closeSheet();
    }).catch(function (err) {
      setSheetBusy(false);
      showSheetError(err && err.code ? errorMessage(err) : ((err && err.message) || "Something went wrong. Please try again."));
    });
  });

  sheetCancel.addEventListener("click", closeSheet);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeSheet();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeSheet();
  });

  nameRow.addEventListener("click", editName);
  phoneRow.addEventListener("click", editPhone);
  passRow.addEventListener("click", createPassword);
  googleRow.addEventListener("click", linkGoogle);
  changePassRow.addEventListener("click", changePassword);
  deleteRow.addEventListener("click", deleteAccount);

  backBtn.addEventListener("click", function (e) {
    if (document.referrer && document.referrer.indexOf(location.hostname) !== -1 && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  auth.onAuthStateChanged(function (user) {
    if (!user || currentUser) return;
    currentUser = user;
    render();
    db.ref("users").child(user.uid).once("value").then(function (snap) {
      profile = snap.val() || {};
      render();
    }).catch(function () {});
  });
})();