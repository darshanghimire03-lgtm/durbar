(function () {
  var POST_TEMPLATE_URL = "/html/item_post.html";

  var postId = qs("postId");
  var postBox = document.getElementById("postBox");
  var listEl = document.getElementById("list");
  var input = document.getElementById("commentInput");
  var sendBtn = document.getElementById("sendBtn");
  var composer = document.getElementById("composer");
  var toastEl = document.getElementById("toast");

  var userCache = {};
  var me = null;
  var viewerSections = [];
  var renderToken = 0;
  var stickBottom = false;
  var started = false;
  var hasMine = false;
  var postTemplate = null;
  var templatePromise = null;
  var postCard = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 3000);
  }

  function timeAgo(ts) {
    if (!ts || typeof ts !== "number") return "";
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    if (diff < 2592000) return Math.floor(diff / 604800) + "w ago";
    return new Date(ts).toLocaleDateString();
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
    if (me && post.authorUid && post.authorUid === me.uid) return true;
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

  function showState(message) {
    listEl.textContent = "";
    listEl.appendChild(el("div", "state", message));
  }

  function postRef() {
    return db.ref("posts").child(postId);
  }

  function commentsRef() {
    return postRef().child("comments");
  }

  function loadUser(uid) {
    if (!uid) return Promise.resolve({});
    if (!userCache[uid]) {
      userCache[uid] = db.ref("users").child(uid).once("value").then(function (snap) {
        var u = snap.val() || {};
        return {
          name: typeof u.fullName === "string" ? u.fullName : "",
          photo: typeof u.profileImageUrl === "string" ? u.profileImageUrl : "",
          role: typeof u.role === "string" ? u.role : "",
          section: typeof u.section === "string" ? u.section : ""
        };
      }).catch(function () {
        delete userCache[uid];
        return {};
      });
    }
    return userCache[uid];
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

  function applyLike(btn, liked, count) {
    btn.classList.toggle("on", liked);
    btn.setAttribute("aria-pressed", liked ? "true" : "false");
    btn.querySelector(".count").textContent = String(count);
  }

  function toggleLike(btn) {
    if (!me || btn.disabled) return;
    var was = btn.classList.contains("on");
    var count = parseInt(btn.querySelector(".count").textContent, 10) || 0;
    applyLike(btn, !was, Math.max(0, count + (was ? -1 : 1)));
    btn.disabled = true;
    var ref = postRef().child("likes").child(me.uid);
    var op = was ? ref.remove() : ref.set(true);
    op.catch(function () {
      applyLike(btn, was, count);
      showToast("Couldn't update your like");
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

  function buildPost(post, u) {
    var role = (post.authorRole || u.role || "").toLowerCase();
    var name = u.name || post.authorName || "Durbar User";
    var photo = u.photo || post.authorPhoto || "";
    var privacy = parsePrivacy(post.privacy);
    var dateLabel = formatDate(post.createdAt);
    var dateText = dateLabel;
    if (privacy && privacy.label) dateText = dateLabel ? dateLabel + " \u00b7 " + privacy.label : privacy.label;

    var card = postTemplate.cloneNode(true);

    var avatarImg = card.querySelector(".avatar-img");
    var avatarInitial = card.querySelector(".avatar-initial");
    avatarInitial.textContent = name.charAt(0).toUpperCase();
    if (photo) {
      avatarImg.alt = name;
      avatarImg.onerror = function () {
        avatarImg.hidden = true;
        avatarInitial.hidden = false;
      };
      avatarImg.src = photo;
      avatarImg.hidden = false;
    } else {
      avatarInitial.hidden = false;
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
    card.querySelector(".see-more").remove();
    body.classList.remove("clamped");
    if (post.text) {
      linkify(body, post.text);
      body.hidden = false;
    }

    buildPhotos(card, post.photos);

    var info = likeInfo(post.likes, me ? me.uid : "");
    var likeBtn = card.querySelector(".action.like");
    applyLike(likeBtn, info.liked, info.count);
    likeBtn.addEventListener("click", function () {
      toggleLike(likeBtn);
    });

    var cc = card.querySelector(".action.comment .count");
    if (cc) cc.textContent = String(post.commentCount);

    card.querySelector(".action.comment").addEventListener("click", function () {
      input.focus();
    });

    card.querySelector(".action.share").addEventListener("click", function () {
      var url = location.origin + "/post/" + encodeURIComponent(postId);
      if (navigator.share) {
        navigator.share({ title: name + " on Durbar", url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          showToast("Link copied to clipboard");
        }).catch(function () {});
      }
    });

    return card;
  }

  function normalizePost(v) {
    return {
      authorUid: typeof v.authorUid === "string" ? v.authorUid : "",
      authorName: typeof v.authorName === "string" ? v.authorName : "",
      authorPhoto: typeof v.authorPhoto === "string" ? v.authorPhoto : "",
      authorRole: typeof v.authorRole === "string" ? v.authorRole : "",
      createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
      text: typeof v.text === "string" ? v.text : "",
      photos: photosOf(v),
      privacy: typeof v.privacy === "string" ? v.privacy : "",
      likes: v.likes !== undefined ? v.likes : v.likeCount,
      commentCount: v.comments && typeof v.comments === "object" ? Object.keys(v.comments).length : 0
    };
  }

  function blocked(message) {
    composer.hidden = true;
    postBox.textContent = "";
    showState(message);
  }

  function watchLikes() {
    var btn = postCard.querySelector(".action.like");
    postRef().child("likes").on("value", function (snap) {
      var info = likeInfo(snap.val(), me.uid);
      applyLike(btn, info.liked, info.count);
    });
  }

  function loadPost() {
    return Promise.all([loadTemplate(), postRef().once("value")]).then(function (results) {
      var v = results[1].val();
      if (!v || typeof v !== "object") {
        blocked("Post not found.");
        return false;
      }
      var post = normalizePost(v);
      if (!canView(post)) {
        blocked("This post isn't available to you.");
        return false;
      }
      return loadUser(post.authorUid).then(function (u) {
        postBox.textContent = "";
        postCard = buildPost(post, u);
        postBox.appendChild(postCard);
        watchLikes();
        return true;
      });
    }).catch(function () {
      blocked("Couldn't load this post.");
      return false;
    });
  }

  function setCommentCount(n) {
    if (!postCard) return;
    var cc = postCard.querySelector(".action.comment .count");
    if (cc) cc.textContent = String(n);
  }

  function buildComment(c) {
    var row = el("div", "c-row");

    var avatar = el("div", "c-avatar");
    var initial = el("span", "", c.name.charAt(0).toUpperCase());
    if (c.photo) {
      var img = document.createElement("img");
      img.alt = c.name;
      img.loading = "lazy";
      img.onerror = function () {
        img.remove();
        avatar.appendChild(initial);
      };
      img.src = c.photo;
      avatar.appendChild(img);
    } else {
      avatar.appendChild(initial);
    }
    row.appendChild(avatar);

    var bubble = el("div", "bubble");
    var head = el("div", "c-head");
    head.appendChild(el("span", "c-name", c.name));
    var ago = timeAgo(c.createdAt);
    if (ago) head.appendChild(el("span", "c-time", ago));
    bubble.appendChild(head);
    bubble.appendChild(el("div", "c-text", c.text));

    if (me && c.uid === me.uid) {
      var acts = el("div", "c-acts");

      var edit = el("button", "c-act", "Edit");
      edit.type = "button";
      edit.addEventListener("click", function () {
        input.value = c.text;
        input.focus();
      });
      acts.appendChild(edit);

      var del = el("button", "c-act danger", "Delete");
      del.type = "button";
      del.addEventListener("click", function () {
        del.disabled = true;
        commentsRef().child(c.id).remove().catch(function () {
          del.disabled = false;
          showToast("Couldn't delete your comment");
        });
      });
      acts.appendChild(del);

      bubble.appendChild(acts);
    }

    row.appendChild(bubble);
    return row;
  }

  function render(comments) {
    if (!comments.length) {
      showState("No comments yet. Be the first to comment.");
      return;
    }
    listEl.textContent = "";
    comments.forEach(function (c) {
      listEl.appendChild(buildComment(c));
    });
    if (stickBottom) {
      stickBottom = false;
      listEl.scrollTop = listEl.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    }
  }

  function listen() {
    commentsRef().on("value", function (snap) {
      var token = ++renderToken;
      var list = [];
      var mine = false;
      snap.forEach(function (child) {
        var v = child.val();
        if (v && typeof v === "object") {
          var uid = typeof v.uid === "string" && v.uid ? v.uid : child.key;
          if (me && child.key === me.uid) mine = true;
          list.push({
            id: child.key,
            uid: uid,
            text: typeof v.text === "string" ? v.text : "",
            createdAt: typeof v.createdAt === "number" ? v.createdAt : 0
          });
        }
      });
      list.sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });

      hasMine = mine;
      input.placeholder = mine ? "Update your comment" : "Add a comment";
      setCommentCount(list.length);

      Promise.all(list.map(function (c) {
        return loadUser(c.uid);
      })).then(function (users) {
        if (token !== renderToken) return;
        render(list.map(function (c, i) {
          var u = users[i] || {};
          return {
            id: c.id,
            uid: c.uid,
            name: u.name || "Durbar User",
            photo: u.photo || "",
            text: c.text,
            createdAt: c.createdAt
          };
        }));
      });
    }, function () {
      showState("Couldn't load comments. You may not have permission to view them.");
    });
  }

  function send() {
    var text = input.value.trim();
    if (!text || !me || sendBtn.disabled) return;
    sendBtn.disabled = true;
    stickBottom = true;
    var updating = hasMine;
    commentsRef().child(me.uid).set({
      uid: me.uid,
      text: text,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function () {
      input.value = "";
      if (updating) showToast("Comment updated");
    }).catch(function () {
      stickBottom = false;
      showToast("Couldn't post your comment");
    }).then(function () {
      sendBtn.disabled = false;
    });
  }

  document.getElementById("backBtn").addEventListener("click", function () {
    if (history.length > 1) history.back();
    else location.href = "/";
  });

  sendBtn.addEventListener("click", send);

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });

  function start(user) {
    if (started) return;
    started = true;
    me = user;
    loadUser(user.uid).then(function (u) {
      viewerSections = sectionsOf(u.section);
      return loadPost();
    }).then(function (ok) {
      if (ok) listen();
    });
  }

  if (!postId) {
    composer.hidden = true;
    showState("Post not found.");
  } else {
    auth.onAuthStateChanged(function (user) {
      if (user) start(user);
    });
  }
})();