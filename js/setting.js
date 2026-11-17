(function () {
  var SHARE_TEXT = "Join me on Durbar for notes, posts and shorts made for students.";
  var INVITE_TEXT = "I'm using Durbar to study with my classmates. Join me!";

  var toastEl = document.getElementById("toast");
  var meAvatar = document.getElementById("meAvatar");
  var meName = document.getElementById("meName");
  var meRole = document.getElementById("meRole");
  var backBtn = document.getElementById("backBtn");

  var currentUser = null;

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

  function shareLink(title, text) {
    var url = location.origin;
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text + " " + url).then(function () {
        showToast("Link copied");
      }).catch(function () {
        showToast("Couldn't copy the link");
      });
      return;
    }
    showToast("Sharing isn't supported on this device");
  }

  function loadMe(user) {
    var fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "Profile");
    meName.textContent = fallbackName;
    if (user.photoURL) meAvatar.src = user.photoURL;

    db.ref("users").child(user.uid).once("value").then(function (snap) {
      var u = snap.val() || {};
      if (typeof u.fullName === "string" && u.fullName.trim()) {
        meName.textContent = u.fullName.trim();
      }
      if (typeof u.role === "string") {
        meRole.textContent = capitalize(u.role.toLowerCase());
      }
      if (typeof u.profileImageUrl === "string" && u.profileImageUrl) {
        meAvatar.src = u.profileImageUrl;
      }
    }).catch(function () {});
  }

  document.querySelectorAll("[data-demo]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showToast(btn.getAttribute("data-demo") + " is for demo only");
    });
  });

  document.getElementById("shareRow").addEventListener("click", function () {
    shareLink("Durbar", SHARE_TEXT);
  });

  document.getElementById("inviteRow").addEventListener("click", function () {
    shareLink("Join me on Durbar", INVITE_TEXT);
  });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    if (typeof logout === "function") {
      logout();
    } else {
      auth.signOut().then(function () {
        location.href = "/";
      });
    }
  });

  backBtn.addEventListener("click", function (e) {
    if (document.referrer && document.referrer.indexOf(location.hostname) !== -1 && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  auth.onAuthStateChanged(function (user) {
    if (user && !currentUser) {
      currentUser = user;
      loadMe(user);
    }
  });

  setTimeout(function () {
    if (!auth.currentUser) {
      location.replace("/?next=" + encodeURIComponent(location.pathname));
    }
  }, 2500);
})();