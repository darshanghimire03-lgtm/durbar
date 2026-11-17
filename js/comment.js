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
  var meName = "";
  var mePhoto = "";
  var renderToken = 0;
  var stickBottom = false;
  var listening = false;
  var postTemplate = null;
  var templatePromise = null;

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

  function likeInfo(post, uid) {
    var l = post.likes;
    if (l && typeof l === "object") {
      var keys = Object.keys(l);
      return {
        count: keys.length,
        liked: !!uid && keys.indexOf(uid) !== -1 && l[uid] !== false
      };
    }
    if (typeof l === "number") return { count: l, liked: false };
    return { count: 0, liked: false };
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

  function commentsRef() {
    return db.ref("posts").child(postId).child("comments");
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

  function buildPost(post, u) {
    var role = (post.authorRole || u.role || "").toLowerCase();
    var name = u.name || post.authorName || "Durbar User";
    var photo = u.photo || post.authorPhoto || "";
    var dateLabel = formatDate(post.createdAt);

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
    if (dateLabel) {
      dateEl.textContent = dateLabel;
      dateEl.hidden = false;
    }
    dotEl.hidden = !(role && dateLabel);

    var body = card.querySelector(".post-text");
    card.querySelector(".see-more").remove();
    body.classList.remove("clamped");
    if (post.text) {
      linkify(body, post.text);
      body.hidden = false;
    }

    var img = card.querySelector(".post-image");
    if (post.imageUrl) {
      img.onerror = function () {
        img.hidden = true;
      };
      img.src = post.imageUrl;
      img.hidden = false;
    } else {
      img.remove();
    }

    var info = likeInfo(post, me ? me.uid : "");
    var likeBtn = card.querySelector(".action.like");
    likeBtn.classList.toggle("on", info.liked);
    likeBtn.querySelector(".count").textContent = String(info.count);

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

  function loadPost() {
    Promise.all([loadTemplate(), db.ref("posts").child(postId).once("value")]).then(function (results) {
      var v = results[1].val();
      if (!v || typeof v !== "object") return;
      var authorUid = typeof v.authorUid === "string" ? v.authorUid : "";
      return loadUser(authorUid).then(function (u) {
        postBox.textContent = "";
        postBox.appendChild(buildPost({
          authorName: typeof v.authorName === "string" ? v.authorName : "",
          authorPhoto: typeof v.authorPhoto === "string" ? v.authorPhoto : "",
          authorRole: typeof v.authorRole === "string" ? v.authorRole : "",
          createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
          text: typeof v.text === "string" ? v.text : "",
          imageUrl: typeof v.imageUrl === "string" ? v.imageUrl : "",
          likes: v.likes !== undefined ? v.likes : v.likeCount
        }, u));
      });
    }).catch(function () {});
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

  function pickString(v, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (typeof v[keys[i]] === "string" && v[keys[i]]) return v[keys[i]];
    }
    return "";
  }

  function listen() {
    commentsRef().on("value", function (snap) {
      var token = ++renderToken;
      var list = [];
      snap.forEach(function (child) {
        var v = child.val();
        if (v && typeof v === "object") {
          list.push({
            id: child.key,
            uid: pickString(v, ["authorUid", "uid", "userId", "authorId"]),
            authorName: pickString(v, ["authorName", "userName", "name"]),
            authorPhoto: pickString(v, ["authorPhoto", "userPhoto", "photoUrl"]),
            text: typeof v.text === "string" ? v.text : "",
            createdAt: typeof v.createdAt === "number" ? v.createdAt : 0
          });
        }
      });
      list.sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });

      Promise.all(list.map(function (c) {
        return loadUser(c.uid);
      })).then(function (users) {
        if (token !== renderToken) return;
        render(list.map(function (c, i) {
          var u = users[i] || {};
          return {
            id: c.id,
            name: u.name || c.authorName || "Durbar User",
            photo: u.photo || c.authorPhoto || "",
            text: c.text,
            createdAt: c.createdAt
          };
        }));
      });
    }, function () {
      showState("Couldn't load comments. You may not have permission to view them.");
    });
  }

  function loadMe(user) {
    meName = user.displayName || (user.email ? user.email.split("@")[0] : "");
    mePhoto = user.photoURL || "";
    loadUser(user.uid).then(function (u) {
      if (u.name) meName = u.name;
      if (u.photo) mePhoto = u.photo;
    });
  }

  function send() {
    var text = input.value.trim();
    if (!text || !me || sendBtn.disabled) return;
    sendBtn.disabled = true;
    stickBottom = true;
    commentsRef().push({
      authorUid: me.uid,
      authorName: meName,
      authorPhoto: mePhoto,
      text: text,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function () {
      input.value = "";
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

  if (!postId) {
    composer.hidden = true;
    showState("Post not found.");
  } else {
    auth.onAuthStateChanged(function (user) {
      if (!user) return;
      me = user;
      loadMe(user);
      if (!listening) {
        listening = true;
        loadPost();
        listen();
      }
    });
  }
})();