(function () {
  var FETCH_LIMIT = 150;
  var POST_LIMIT = 40;
  var LOAD_TIMEOUT_MS = 12000;
  var POST_TEMPLATE_URL = "/html/item_post.html";
  var PROFILE_URL = "/html/profile.html";

  var feed = document.getElementById("feed");
  var topBar = document.getElementById("topBar");
  var searchInput = document.getElementById("searchInput");
  var greetingEl = document.getElementById("greeting");
  var meAvatar = document.getElementById("meAvatar");

  var allPosts = [];
  var cards = {};
  var lastSig = "";
  var currentUid = "";
  var viewerSections = [];
  var postTemplate = null;
  var templatePromise = null;
  var userCache = {};
  var feedRef = null;
  var feedToken = 0;
  var feedReady = false;
  var loadTimer = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(ms) {
    if (!ms || typeof ms !== "number") return "";
    var d = new Date(ms);
    return d.toLocaleDateString("en-US", { month: "long" }) + " " + String(d.getDate()).padStart(2, "0");
  }

  function sectionsOf(value) {
    return String(value || "").split(",").map(function (s) {
      return s.replace(/^section/i, "").trim().toUpperCase();
    }).filter(Boolean);
  }

  function parsePrivacy(raw) {
    var s = String(raw === undefined || raw === null || raw === "" ? "everyone" : raw).trim().toLowerCase();
    if (s === "everyone") return { all: true, label: "" };
    var m = s.match(/^section\s*([a-z])$/);
    if (m) {
      var letter = m[1].toUpperCase();
      return { all: false, section: letter, label: "Section " + letter };
    }
    return null;
  }

  function canView(post) {
    if (post.authorUid && post.authorUid === currentUid) return true;
    var p = parsePrivacy(post.privacy);
    if (!p) return false;
    if (p.all) return true;
    return viewerSections.indexOf(p.section) !== -1;
  }

  function likeInfo(likes, uid) {
    if (likes && typeof likes === "object") {
      var keys = Object.keys(likes).filter(function (k) { return !!likes[k]; });
      return { count: keys.length, liked: !!uid && keys.indexOf(uid) !== -1 };
    }
    if (typeof likes === "number") return { count: likes, liked: false };
    return { count: 0, liked: false };
  }

  function photosOf(v) {
    var out = [];
    var raw = v.photos;
    if (Array.isArray(raw)) {
      out = raw;
    } else if (raw && typeof raw === "object") {
      out = Object.keys(raw).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return raw[k]; });
    }
    out = out.filter(function (u) { return typeof u === "string" && /^https?:\/\//i.test(u); });
    if (!out.length && typeof v.imageUrl === "string" && v.imageUrl) out = [v.imageUrl];
    return out;
  }

  function linkify(container, text) {
    var pattern = /(https?:\/\/[^\s]+)/g;
    var last = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) {
        container.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      var a = document.createElement("a");
      a.href = match[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = match[1];
      container.appendChild(a);
      last = match.index + match[1].length;
    }
    if (last < text.length) {
      container.appendChild(document.createTextNode(text.slice(last)));
    }
  }

  function loadTemplate() {
    if (postTemplate) return Promise.resolve(postTemplate);
    if (templatePromise) return templatePromise;
    templatePromise = fetch(POST_TEMPLATE_URL).then(function (res) {
      if (!res.ok) throw new Error("template");
      return res.text();
    }).then(function (html) {
      var holder = document.createElement("template");
      holder.innerHTML = html.trim();
      var node = holder.content.firstElementChild;
      if (!node) throw new Error("template");
      postTemplate = node;
      return postTemplate;
    }).catch(function (err) {
      templatePromise = null;
      throw err;
    });
    return templatePromise;
  }

  function loadUser(uid) {
    if (!uid) return Promise.resolve({});
    if (!userCache[uid]) {
      userCache[uid] = db.ref("users").child(uid).once("value").then(function (snap) {
        var u = snap.val() || {};
        return {
          name: typeof u.fullName === "string" ? u.fullName : "",
          photo: typeof u.profileImageUrl === "string" ? u.profileImageUrl : "",
          role: typeof u.role === "string" ? u.role : ""
        };
      }).catch(function () {
        delete userCache[uid];
        return {};
      });
    }
    return userCache[uid];
  }

  function openProfile(uid) {
    if (!uid) return;
    if (uid === currentUid) {
      location.href = PROFILE_URL;
      return;
    }
    location.href = PROFILE_URL + "?uid=" + encodeURIComponent(uid);
  }

  function makeProfileTarget(node, uid) {
    node.classList.add("linked");
    node.setAttribute("role", "link");
    node.setAttribute("tabindex", "0");
    node.addEventListener("click", function () {
      openProfile(uid);
    });
    node.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProfile(uid);
      }
    });
  }

  function applyLike(btn, liked, count) {
    btn.classList.toggle("on", liked);
    btn.setAttribute("aria-pressed", liked ? "true" : "false");
    btn.querySelector(".count").textContent = String(count);
  }

  function toggleLike(postId, btn) {
    if (!currentUid || btn.disabled) return;
    var was = btn.classList.contains("on");
    var count = parseInt(btn.querySelector(".count").textContent, 10) || 0;
    applyLike(btn, !was, Math.max(0, count + (was ? -1 : 1)));
    btn.disabled = true;
    var ref = db.ref("posts").child(postId).child("likes").child(currentUid);
    var op = was ? ref.remove() : ref.set(true);
    op.catch(function () {
      applyLike(btn, was, count);
    }).then(function () {
      btn.disabled = false;
    });
  }

  function buildPhotos(card, photos) {
    var box = card.querySelector(".post-photos");
    if (!box) return;
    if (!photos.length) {
      box.remove();
      return;
    }
    var shown = photos.slice(0, 4);
    box.className = "post-photos n" + shown.length;
    shown.forEach(function (url, i) {
      var cell = el("div", "ph");
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () {
        cell.hidden = true;
      };
      img.src = url;
      cell.appendChild(img);
      if (i === 3 && photos.length > 4) {
        cell.appendChild(el("span", "ph-more", "+" + (photos.length - 4)));
      }
      cell.addEventListener("click", function () {
        window.open(url, "_blank", "noopener");
      });
      box.appendChild(cell);
    });
    box.hidden = false;
  }

  function buildPost(post) {
    var role = (post.authorRole || "").toLowerCase();
    var name = post.authorName || "Durbar User";
    var privacy = parsePrivacy(post.privacy);
    var dateLabel = formatDate(post.createdAt);
    var dateText = dateLabel;
    if (privacy && privacy.label) dateText = dateLabel ? dateLabel + " \u00b7 " + privacy.label : privacy.label;

    var card = postTemplate.cloneNode(true);

    var avatarBox = card.querySelector(".avatar");
    var whoBox = card.querySelector(".who");
    var avatarImg = card.querySelector(".avatar-img");
    var avatarInitial = card.querySelector(".avatar-initial");
    avatarInitial.textContent = name.charAt(0).toUpperCase();
    if (post.authorPhoto) {
      avatarImg.alt = name;
      avatarImg.onerror = function () {
        avatarImg.hidden = true;
        avatarInitial.hidden = false;
      };
      avatarImg.src = post.authorPhoto;
      avatarImg.hidden = false;
    } else {
      avatarInitial.hidden = false;
    }

    if (post.authorUid) {
      makeProfileTarget(avatarBox, post.authorUid);
      makeProfileTarget(whoBox, post.authorUid);
    }

    card.querySelector(".name").textContent = name;
    card.querySelector(".badge").classList.toggle("grey", role === "moderator");

    var roleEl = card.querySelector(".role");
    var dotEl = card.querySelector(".dot");
    var dateEl = card.querySelector(".date");
    if (role) {
      roleEl.textContent = role;
      roleEl.hidden = false;
    }
    if (dateText) {
      dateEl.textContent = dateText;
      dateEl.hidden = false;
    }
    dotEl.hidden = !(role && dateText);

    var body = card.querySelector(".post-text");
    var seeMore = card.querySelector(".see-more");
    if (post.text) {
      linkify(body, post.text);
      body.hidden = false;
      seeMore.addEventListener("click", function () {
        var collapsed = body.classList.toggle("clamped");
        seeMore.textContent = collapsed ? "See more" : "See less";
      });
      card._body = body;
      card._seeMore = seeMore;
    } else {
      seeMore.remove();
    }

    buildPhotos(card, post.photos);

    var info = likeInfo(post.likes, currentUid);
    var likeBtn = card.querySelector(".action.like");
    applyLike(likeBtn, info.liked, info.count);
    likeBtn.addEventListener("click", function () {
      toggleLike(post.id, likeBtn);
    });

    var commentCount = card.querySelector(".action.comment .count");
    if (commentCount) commentCount.textContent = String(post.commentCount);

    card.querySelector(".action.share").addEventListener("click", function () {
      var url = location.origin + "/post/" + encodeURIComponent(post.id);
      if (navigator.share) {
        navigator.share({ title: name + " on Durbar", url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).catch(function () {});
      }
    });

    card.querySelector(".action.comment").addEventListener("click", function () {
      location.href = "/html/comment.html?postId=" + encodeURIComponent(post.id);
    });

    return card;
  }

  function showState(message, withRetry) {
    feed.textContent = "";
    var box = el("div", "state");
    box.appendChild(el("div", "", message));
    if (withRetry) {
      var btn = el("button", "retry-btn", "Retry");
      btn.type = "button";
      btn.addEventListener("click", function () {
        loadFeed();
      });
      box.appendChild(btn);
    }
    feed.appendChild(box);
  }

  function showSkeletons() {
    feed.textContent = "";
    feed.appendChild(el("div", "skeleton"));
    feed.appendChild(el("div", "skeleton"));
  }

  function sigOf(p) {
    return [p.id, p.privacy, p.text, p.photos.join(","), p.authorName, p.authorPhoto, p.authorRole].join("|");
  }

  function filteredList() {
    var query = searchInput.value.trim().toLowerCase();
    if (!query) return allPosts;
    return allPosts.filter(function (p) {
      return (p.text || "").toLowerCase().indexOf(query) !== -1 ||
             (p.authorName || "").toLowerCase().indexOf(query) !== -1 ||
             (p.authorRole || "").toLowerCase().indexOf(query) !== -1;
    });
  }

  function patchCards(list) {
    list.forEach(function (p) {
      var card = cards[p.id];
      if (!card) return;
      var info = likeInfo(p.likes, currentUid);
      applyLike(card.querySelector(".action.like"), info.liked, info.count);
      var cc = card.querySelector(".action.comment .count");
      if (cc) cc.textContent = String(p.commentCount);
    });
  }

  function renderList(list) {
    feed.textContent = "";
    cards = {};
    var built = list.map(function (p) {
      var card = buildPost(p);
      cards[p.id] = card;
      return card;
    });
    built.forEach(function (card) {
      feed.appendChild(card);
    });
    requestAnimationFrame(function () {
      built.forEach(function (card) {
        if (card._body && card._body.scrollHeight > card._body.clientHeight + 2) {
          card._seeMore.classList.add("visible");
        }
      });
    });
  }

  function apply() {
    if (!feedReady) return;
    var list = filteredList();
    if (!list.length) {
      lastSig = "";
      cards = {};
      showState(searchInput.value.trim() ? "No matching posts." : "No posts yet.", false);
      return;
    }
    var sig = list.map(sigOf).join("\n");
    if (sig === lastSig) {
      patchCards(list);
      return;
    }
    lastSig = sig;
    renderList(list);
  }

  function normalizePost(id, v, u) {
    return {
      id: id,
      authorUid: typeof v.authorUid === "string" ? v.authorUid : "",
      authorName: u.name || (typeof v.authorName === "string" ? v.authorName : ""),
      authorPhoto: u.photo || (typeof v.authorPhoto === "string" ? v.authorPhoto : ""),
      authorRole: (typeof v.authorRole === "string" && v.authorRole) || u.role || "",
      createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
      text: typeof v.text === "string" ? v.text : "",
      photos: photosOf(v),
      privacy: typeof v.privacy === "string" ? v.privacy : "",
      likes: v.likes !== undefined ? v.likes : v.likeCount,
      commentCount: v.comments && typeof v.comments === "object" ? Object.keys(v.comments).length : 0
    };
  }

  function onFeed(snap) {
    var token = ++feedToken;
    var raw = [];
    snap.forEach(function (child) {
      var v = child.val();
      if (v && typeof v === "object") raw.push({ id: child.key, v: v });
    });

    var visible = raw.filter(function (r) {
      return canView({
        authorUid: typeof r.v.authorUid === "string" ? r.v.authorUid : "",
        privacy: typeof r.v.privacy === "string" ? r.v.privacy : ""
      });
    });

    visible.sort(function (a, b) {
      return (b.v.createdAt || 0) - (a.v.createdAt || 0);
    });
    visible = visible.slice(0, POST_LIMIT);

    var uids = [];
    visible.forEach(function (r) {
      var uid = r.v.authorUid;
      if (typeof uid === "string" && uid && uids.indexOf(uid) === -1) uids.push(uid);
    });

    Promise.all([loadTemplate(), Promise.all(uids.map(loadUser))]).then(function () {
      if (token !== feedToken) return;
      allPosts = visible.map(function (r) {
        return normalizePost(r.id, r.v, userCache[r.v.authorUid] ? {} : {});
      });
      return Promise.all(visible.map(function (r) {
        return loadUser(r.v.authorUid);
      })).then(function (users) {
        if (token !== feedToken) return;
        allPosts = visible.map(function (r, i) {
          return normalizePost(r.id, r.v, users[i] || {});
        });
        feedReady = true;
        clearTimeout(loadTimer);
        apply();
      });
    }).catch(function (err) {
      if (token !== feedToken) return;
      clearTimeout(loadTimer);
      console.error("Posts failed to render", err);
      showState("Couldn't load posts.", true);
    });
  }

  function loadFeed() {
    if (feedRef) {
      feedRef.off("value", onFeed);
      feedRef = null;
    }
    feedReady = false;
    lastSig = "";
    cards = {};
    feedToken++;
    showSkeletons();
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      if (!feedReady) showState("Couldn't load posts. Check your connection.", true);
    }, LOAD_TIMEOUT_MS);
    feedRef = db.ref("posts").limitToLast(FETCH_LIMIT);
    feedRef.on("value", onFeed, function (err) {
      clearTimeout(loadTimer);
      var code = err && (err.code || err.message) ? " (" + (err.code || err.message) + ")" : "";
      console.error("Posts failed to load", err);
      showState("Couldn't load posts" + code + ".", true);
    });
  }

  function loadProfile(user) {
    var fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "");
    greetingEl.textContent = fallbackName ? "Hi! " + fallbackName.split(" ")[0] : "Hi!";
    if (user.photoURL) meAvatar.src = user.photoURL;

    return db.ref("users").child(user.uid).once("value").then(function (snap) {
      var u = snap.val() || {};
      viewerSections = sectionsOf(u.section);
      if (typeof u.fullName === "string" && u.fullName.trim()) {
        greetingEl.textContent = "Hi! " + u.fullName.trim().split(" ")[0];
      }
      if (typeof u.profileImageUrl === "string" && u.profileImageUrl) {
        meAvatar.src = u.profileImageUrl;
      }
    }).catch(function () {
      viewerSections = [];
    });
  }

  document.getElementById("searchOpen").addEventListener("click", function () {
    topBar.classList.add("searching");
    searchInput.focus();
  });

  document.getElementById("searchClose").addEventListener("click", function () {
    topBar.classList.remove("searching");
    searchInput.value = "";
    apply();
  });

  searchInput.addEventListener("input", function () {
    apply();
  });

  window.Tabs = window.Tabs || {};
  window.Tabs.home = {
    start: function (user) {
      currentUid = user.uid;
      showSkeletons();
      loadProfile(user).then(loadFeed);
    }
  };
})();