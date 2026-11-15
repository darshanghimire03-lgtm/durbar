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

    var SHEET_URL = "layout/auth-sheet.html";
    var EYE_OFF = "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z";
    var EYE_ON = "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z";

    var sheet = null;
    var sheetPromise = null;
    var finishing = false;
    var photoBase64 = "";
    var photoBlobUrl = "";
    var nextUrl = readNext();

    function readNext() {
      var raw = new URLSearchParams(location.search).get("next") || "";
      if (!/^\/[A-Za-z0-9_\-\/.]*([?#][^\s]*)?$/.test(raw)) return "";
      if (raw.indexOf("//") !== -1 || raw.indexOf("..") !== -1) return "";
      if (/^\/(index\.html)?([?#].*)?$/.test(raw)) return "";
      return raw;
    }

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

    function resizeToBase64(file, maxSide) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1] || "");
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error("Could not read image"));
        };
        img.src = url;
      });
    }

    function messageFor(code) {
      switch (code) {
        case "auth/invalid-email":
          return "Please enter a valid email address.";
        case "auth/user-disabled":
          return "This account has been disabled.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
          return "Incorrect email or password.";
        case "auth/too-many-requests":
          return "Too many attempts. Please try again later.";
        case "auth/network-request-failed":
          return "Network error. Check your connection and try again.";
        default:
          return "Login failed. Please try again.";
      }
    }

    function uploadPhoto(user) {
      return user.getIdToken().then(function (token) {
        return fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          },
          body: JSON.stringify({ image: photoBase64 })
        });
      }).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok || !data || !data.url) {
            throw new Error((data && data.error) || "Upload failed");
          }
          return data.url;
        });
      }).then(function (url) {
        return db.ref("users").child(user.uid).update({ profileImageUrl: url });
      });
    }

    function wireSheet(root) {
      var form = root.querySelector("#asForm");
      var emailInput = root.querySelector("#asEmail");
      var passwordInput = root.querySelector("#asPassword");
      var emailField = root.querySelector("#asEmailField");
      var passwordField = root.querySelector("#asPasswordField");
      var errorBox = root.querySelector("#asError");
      var loginBtn = root.querySelector("#asLoginBtn");
      var loginLabel = root.querySelector("#asLoginLabel");
      var eyeBtn = root.querySelector("#asEye");
      var eyePath = root.querySelector("#asEyePath");
      var avatarBtn = root.querySelector("#asAvatar");
      var avatarCircle = root.querySelector("#asAvatarCircle");
      var avatarPreview = root.querySelector("#asAvatarPreview");
      var photoInput = root.querySelector("#asPhotoInput");
      var hint = root.querySelector("#asHint");

      function showError(message) {
        errorBox.textContent = message;
        errorBox.classList.add("visible");
      }

      function clearError() {
        errorBox.textContent = "";
        errorBox.classList.remove("visible");
        emailField.classList.remove("invalid");
        passwordField.classList.remove("invalid");
      }

      function setLoading(isLoading, label) {
        loginBtn.disabled = isLoading;
        avatarBtn.disabled = isLoading;
        loginBtn.classList.toggle("loading", isLoading);
        loginLabel.textContent = isLoading ? (label || "Signing in...") : "Login";
      }

      function complete(user) {
        finishing = false;
        if (nextUrl) {
          location.replace(nextUrl);
          return;
        }
        hideSheet();
        startApp(user);
      }

      function finishLogin(user) {
        if (!photoBase64) {
          complete(user);
          return;
        }
        setLoading(true, "Uploading photo...");
        uploadPhoto(user).then(function () {
          complete(user);
        }).catch(function () {
          setLoading(false);
          showError("Logged in, but the photo upload failed. You can change it later from your profile.");
          setTimeout(function () {
            complete(user);
          }, 2000);
        });
      }

      eyeBtn.addEventListener("click", function () {
        var showing = passwordInput.type === "text";
        passwordInput.type = showing ? "password" : "text";
        eyePath.setAttribute("d", showing ? EYE_OFF : EYE_ON);
        eyeBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        passwordInput.focus();
      });

      avatarBtn.addEventListener("click", function () {
        photoInput.click();
      });

      photoInput.addEventListener("change", function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) return;
        clearError();

        if (!/^image\//.test(file.type)) {
          showError("Please choose an image file.");
          photoInput.value = "";
          return;
        }

        if (file.size > 15 * 1024 * 1024) {
          showError("Image is too large. Choose one under 15 MB.");
          photoInput.value = "";
          return;
        }

        resizeToBase64(file, 640).then(function (base64) {
          if (!base64) throw new Error("Empty image");
          photoBase64 = base64;
          if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
          photoBlobUrl = URL.createObjectURL(file);
          avatarPreview.src = photoBlobUrl;
          avatarCircle.classList.add("has-photo");
          hint.textContent = "Photo selected. It will upload after you log in.";
        }).catch(function () {
          photoBase64 = "";
          showError("Could not read that image. Try another one.");
        });
      });

      emailInput.addEventListener("input", clearError);
      passwordInput.addEventListener("input", clearError);

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        clearError();

        var email = emailInput.value.trim();
        var password = passwordInput.value;

        if (!email) {
          emailField.classList.add("invalid");
          showError("Please enter your email address.");
          emailInput.focus();
          return;
        }

        if (!password) {
          passwordField.classList.add("invalid");
          showError("Please enter your password.");
          passwordInput.focus();
          return;
        }

        setLoading(true);
        finishing = !!photoBase64;

        auth.signInWithEmailAndPassword(email, password).then(function (cred) {
          finishLogin(cred.user);
        }, function (err) {
          finishing = false;
          setLoading(false);
          emailField.classList.add("invalid");
          passwordField.classList.add("invalid");
          showError(messageFor(err && err.code));
        });
      });
    }

    function loadSheet() {
      if (sheet) return Promise.resolve(sheet);
      if (sheetPromise) return sheetPromise;
      sheetPromise = fetch(SHEET_URL).then(function (res) {
        if (!res.ok) throw new Error("sheet");
        return res.text();
      }).then(function (html) {
        var holder = document.createElement("template");
        holder.innerHTML = html.trim();
        var root = holder.content;
        wireSheet(root);
        var overlay = root.querySelector("#authSheet");
        document.body.appendChild(root);
        sheet = overlay;
        return sheet;
      }).catch(function (err) {
        sheetPromise = null;
        throw err;
      });
      return sheetPromise;
    }

    function showSheet() {
      loadSheet().then(function (overlay) {
        if (auth.currentUser) return;
        overlay.hidden = false;
        document.body.style.overflow = "hidden";
      }).catch(function () {
        setTimeout(showSheet, 2000);
      });
    }

    function hideSheet() {
      if (sheet) sheet.hidden = true;
      document.body.style.overflow = "";
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        if (started) {
          location.reload();
          return;
        }
        showSheet();
        return;
      }
      if (finishing) return;
      if (nextUrl) {
        location.replace(nextUrl);
        return;
      }
      hideSheet();
      startApp(user);
    });
  }
})();