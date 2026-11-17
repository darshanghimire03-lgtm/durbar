(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";
  var HEART_PATH = "M12 20.5l-1.2-1.08C6 15.2 3 12.5 3 9a4.6 4.6 0 0 1 4.7-4.7c1.6 0 3.1.8 4.3 2.2 1.2-1.4 2.7-2.2 4.3-2.2A4.6 4.6 0 0 1 21 9c0 3.5-3 6.2-7.8 10.42L12 20.5z";
  var SHORT_OWNER_FIELDS = ["uploaderUid", "uploadedBy", "authorUid", "uid", "userId", "ownerUid", "createdBy"];
  var LOAD_TIMEOUT_MS = 12000;
  var POST_TEMPLATE_URL = "/html/item_post.html";

  var avatarEl = document.getElementById("avatar");
  var nameEl = document.getElementById("name");
  var topTitleEl = document.getElementById("topTitle");
  var roleEl = document.getElementById("role");
  var badgeEl = document.getElementById("badge");
  var contentEl = document.getElementById("content");
  var toastEl = document.getElementById("toast");
  var menuEl = document.getElementById("menu");
  var changeBtn = document.getElementById("changeBtn");
  var changeLabel = document.getElementById("changeLabel");
  var fileInput = document.getElementById("fileInput");
  var tabs = document.querySelectorAll(".tab");
  var ownView = document.getElementById("ownView");
  var otherView = document.getElementById("otherView");
  var menuWrap = document.getElementById("menuWrap");
  var backBtn = document.getElementById("backBtn");
  var oAvatar = document.getElementById("oAvatar");
  var oName = document.getElementById("oName");
  var oRole = document.getElementById("oRole");
  var oBadge = document.getElementById("oBadge");
  var otherFeed = document.getElementById("otherFeed");

  var currentUser = null;
  var displayName = "";
  var activeTab = "posts";
  var cache = { posts: null, shorts: null };
  var otherUid = "";
  var otherInfo = { name: "", role: "", photo: "" };
  var otherPosts = [];
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
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 3000);
  }

  function formatDate(ms) {
    if (!ms || typeof ms !== "number") return "";
    var d = new Date(ms);
    return d.toLocaleDateString("en-US", { month: "long" }) + " " + String(d.getDate()).padStart(2, "0") + ", " + d.getFullYear();
  }

  function formatViews(n) {
    n = n || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
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

  function likeCount(post) {
    var l = post.likes;
    if (l && typeof l === "object") return { count: Object.keys(l).length, liked: !!currentUser && l[currentUser.uid] !== undefined && l[currentUser.uid] !== false };
    if (typeof l === "number") return { count: l, liked: false };
    if (typeof post.likeCount === "number") return { count: post.likeCount, liked: false };
    return { count: 0, liked: false };
  }

  function videoThumb(videoUrl) {
    if (!videoUrl || videoUrl.indexOf("res.cloudinary.com") === -1 || videoUrl.indexOf("/video/upload/") === -1) return "";
    return videoUrl
      .replace("/video/upload/", "/video/upload/so_0,w_400,h_700,c_fill,q_auto,f_jpg/")
      .replace(/\.[a-zA-Z0-9]{2,4}(\?.*)?$/, ".jpg");
  }

  function showState(message, withRetry, onRetry) {
    contentEl.textContent = "";
    var box = el("div", "state");
    box.appendChild(el("div", "", message));
    if (withRetry) {
      var btn = el("button", "retry-btn", "Retry");
      btn.type = "button";
      btn.addEventListener("click", onRetry);
      box.appendChild(btn);
    }
    contentEl.appendChild(box);
  }

  function buildPost(post) {
    var card = el("article", "post");
    var date = formatDate(post.createdAt);
    if (date) card.appendChild(el("div", "post-date", date));

    if (post.text) {
      var body = el("div", "post-text");
      linkify(body, post.text);
      card.appendChild(body);
    }

    if (post.imageUrl) {
      var img = document.createElement("img");
      img.className = "post-image";
      img.loading = "lazy";
      img.alt = "";
      img.src = post.imageUrl;
      img.onerror = function () {
        img.style.display = "none";
      };
      card.appendChild(img);
    }

    var info = likeCount(post);
    var foot = el("div", "post-foot");
    var heart = document.createElementNS(SVG_NS, "svg");
    heart.setAttribute("viewBox", "0 0 24 24");
    if (info.liked) heart.setAttribute("class", "liked");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", HEART_PATH);
    heart.appendChild(p);
    foot.appendChild(heart);
    foot.appendChild(el("span", "", String(info.count)));
    card.appendChild(foot);
    return card;
  }

  function renderPosts(posts) {
    if (!posts.length) {
      showState("No posts yet", false);
      return;
    }
    contentEl.textContent = "";
    var list = el("div", "post-list");
    posts.forEach(function (post) {
      list.appendChild(buildPost(post));
    });
    contentEl.appendChild(list);
  }

  function renderShorts(shorts) {
    if (!shorts.length) {
      showState("No shorts yet", false);
      return;
    }
    contentEl.textContent = "";
    var grid = el("div", "short-grid");
    shorts.forEach(function (s) {
      var a = el("a", "short-tile");
      a.href = "/shorts/?id=" + encodeURIComponent(s.shortId);

      var thumb = videoThumb(s.videoUrl);
      if (thumb) {
        var img = document.createElement("img");
        img.loading = "lazy";
        img.alt = "";
        img.src = thumb;
        a.appendChild(img);
      } else if (s.videoUrl) {
        var video = document.createElement("video");
        video.src = s.videoUrl;
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        a.appendChild(video);
      }

      var meta = el("div", "short-meta");
      meta.appendChild(el("div", "t", s.title || "Untitled"));
      meta.appendChild(el("div", "v", formatViews(s.views) + " views"));
      a.appendChild(meta);
      grid.appendChild(a);
    });
    contentEl.appendChild(grid);
  }

  function withTimeout(promise) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("timeout"));
      }, LOAD_TIMEOUT_MS);
      promise.then(function (v) {
        clearTimeout(timer);
        resolve(v);
      }, function (e) {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  function fetchPosts(uid) {
    return db.ref("posts").orderByChild("authorUid").equalTo(uid).once("value").then(function (snap) {
      var list = [];
      snap.forEach(function (child) {
        var v = child.val();
        if (v && typeof v === "object") {
          var post = {};
          for (var k in v) post[k] = v[k];
          post.id = child.key;
          list.push(post);
        }
      });
      list.sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      return list;
    });
  }

  function fetchShorts(uid) {
    return db.ref("shorts").once("value").then(function (snap) {
      var list = [];
      snap.forEach(function (child) {
        var v = child.val();
        if (!v || typeof v !== "object") return;
        var mine = SHORT_OWNER_FIELDS.some(function (f) {
          return v[f] === uid;
        });
        if (mine) {
          var s = {};
          for (var k in v) s[k] = v[k];
          s.shortId = child.key;
          list.push(s);
        }
      });
      list.sort(function (a, b) {
        return (b.uploadedDate || 0) - (a.uploadedDate || 0);
      });
      return list;
    });
  }

  function loadTab(tab) {
    if (!currentUser) return;
    var uid = currentUser.uid;

    if (cache[tab]) {
      tab === "posts" ? renderPosts(cache[tab]) : renderShorts(cache[tab]);
      return;
    }

    showState("Loading...", false);

    var request = tab === "posts" ? fetchPosts(uid) : fetchShorts(uid);
    withTimeout(request).then(function (list) {
      cache[tab] = list;
      if (activeTab !== tab) return;
      tab === "posts" ? renderPosts(list) : renderShorts(list);
    }).catch(function () {
      if (activeTab !== tab) return;
      showState("Couldn't load " + tab + ".", true, function () {
        loadTab(tab);
      });
    });
  }

  function applyProfile(name, role, photo) {
    displayName = name || "Profile";
    nameEl.textContent = displayName;
    topTitleEl.textContent = displayName;
    document.title = displayName + " · Durbar";

    var roleText = capitalize((role || "").toLowerCase());
    roleEl.textContent = roleText;
    if (roleText) {
      badgeEl.style.display = "";
      badgeEl.setAttribute("class", "badge" + (roleText.toLowerCase() === "moderator" ? "" : " blue"));
    } else {
      badgeEl.style.display = "none";
    }

    if (photo) avatarEl.src = photo;
  }

  function formatShortDate(ms) {
    if (!ms || typeof ms !== "number") return "";
    var d = new Date(ms);
    return d.toLocaleDateString("en-US", { month: "long" }) + " " + String(d.getDate()).padStart(2, "0");
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

  function showFeedState(message, withRetry, onRetry) {
    otherFeed.textContent = "";
    var box = el("div", "state");
    box.appendChild(el("div", "", message));
    if (withRetry) {
      var btn = el("button", "retry-btn", "Retry");
      btn.type = "button";
      btn.addEventListener("click", onRetry);
      box.appendChild(btn);
    }
    otherFeed.appendChild(box);
  }

  function buildFeedPost(post) {
    var role = (otherInfo.role || "").toLowerCase();
    var name = otherInfo.name || "Durbar User";
    var dateLabel = formatShortDate(post.createdAt);

    var card = postTemplate.cloneNode(true);

    var avatarImg = card.querySelector(".avatar-img");
    var avatarInitial = card.querySelector(".avatar-initial");
    avatarInitial.textContent = name.charAt(0).toUpperCase();
    if (otherInfo.photo) {
      avatarImg.alt = name;
      avatarImg.onerror = function () {
        avatarImg.hidden = true;
        avatarInitial.hidden = false;
      };
      avatarImg.src = otherInfo.photo;
      avatarImg.hidden = false;
    } else {
      avatarInitial.hidden = false;
    }

    card.querySelector(".name").textContent = name;
    card.querySelector(".badge").classList.toggle("grey", role === "moderator");

    var roleNode = card.querySelector(".role");
    var dotNode = card.querySelector(".dot");
    var dateNode = card.querySelector(".date");
    if (role) {
      roleNode.textContent = role;
      roleNode.hidden = false;
    }
    if (dateLabel) {
      dateNode.textContent = dateLabel;
      dateNode.hidden = false;
    }
    dotNode.hidden = !(role && dateLabel);

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

    var info = likeCount(post);
    var likeBtn = card.querySelector(".action.like");
    likeBtn.classList.toggle("on", info.liked);
    likeBtn.querySelector(".count").textContent = String(info.count);

    card.querySelector(".action.comment").addEventListener("click", function () {
      location.href = "/html/comment.html?postId=" + encodeURIComponent(post.id);
    });

    card.querySelector(".action.share").addEventListener("click", function () {
      var url = location.origin + "/post/" + encodeURIComponent(post.id);
      if (navigator.share) {
        navigator.share({ title: name + " on Durbar", url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          showToast("Link copied");
        }).catch(function () {});
      }
    });

    return card;
  }

  function renderOtherFeed() {
    if (!otherPosts.length) {
      showFeedState("No posts yet", false);
      return;
    }
    otherFeed.textContent = "";
    var cards = otherPosts.map(buildFeedPost);
    cards.forEach(function (card) {
      otherFeed.appendChild(card);
    });
    requestAnimationFrame(function () {
      cards.forEach(function (card) {
        if (card._body && card._body.scrollHeight > card._body.clientHeight + 2) {
          card._seeMore.classList.add("visible");
        }
      });
    });
  }

  function loadOtherFeed() {
    showFeedState("Loading...", false);
    Promise.all([loadTemplate(), withTimeout(fetchPosts(otherUid))]).then(function (results) {
      otherPosts = results[1];
      renderOtherFeed();
    }).catch(function () {
      showFeedState("Couldn't load posts.", true, loadOtherFeed);
    });
  }

  function applyOther() {
    var name = otherInfo.name || "Durbar User";
    oName.textContent = name;
    topTitleEl.textContent = name;
    document.title = name + " · Durbar";

    var roleText = capitalize((otherInfo.role || "").toLowerCase());
    oRole.textContent = roleText;
    if (roleText) {
      oBadge.style.display = "";
      oBadge.setAttribute("class", "badge" + (roleText.toLowerCase() === "moderator" ? "" : " blue"));
    } else {
      oBadge.style.display = "none";
    }

    if (otherInfo.photo) {
      oAvatar.onerror = function () {
        oAvatar.onerror = null;
        oAvatar.src = "/favicon.png";
      };
      oAvatar.src = otherInfo.photo;
    }
  }

  function startOther(uid) {
    otherUid = uid;
    menuWrap.hidden = true;
    otherView.hidden = false;
    topTitleEl.textContent = "Profile";
    showFeedState("Loading...", false);

    backBtn.addEventListener("click", function (e) {
      if (history.length > 1) {
        e.preventDefault();
        history.back();
      }
    });

    db.ref("users").child(uid).once("value").then(function (snap) {
      var u = snap.val() || {};
      otherInfo = {
        name: typeof u.fullName === "string" ? u.fullName.trim() : "",
        role: typeof u.role === "string" ? u.role : "",
        photo: typeof u.profileImageUrl === "string" ? u.profileImageUrl : ""
      };
    }).catch(function () {}).then(function () {
      applyOther();
      loadOtherFeed();
    });
  }

  function start(user) {
    currentUser = user;
    var targetUid = qs("uid");
    if (targetUid && targetUid !== user.uid) {
      startOther(targetUid);
      return;
    }
    ownView.hidden = false;
    var fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "");
    applyProfile(fallbackName, "", user.photoURL || "");

    db.ref("users").child(user.uid).once("value").then(function (snap) {
      var u = snap.val() || {};
      applyProfile(
        typeof u.fullName === "string" && u.fullName.trim() ? u.fullName.trim() : fallbackName,
        typeof u.role === "string" ? u.role : "",
        typeof u.profileImageUrl === "string" && u.profileImageUrl ? u.profileImageUrl : (user.photoURL || "")
      );
    }).catch(function () {});

    loadTab(activeTab);
  }

  function resizeImage(file, maxSide) {
    var source = window.createImageBitmap
      ? createImageBitmap(file, { imageOrientation: "from-image" })
      : Promise.reject(new Error("unsupported"));

    return source.then(function (bmp) {
      var scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      var w = Math.round(bmp.width * scale);
      var h = Math.round(bmp.height * scale);
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve(blob || file);
        }, "image/jpeg", 0.88);
      });
    }).catch(function () {
      return file;
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = function () {
        reject(new Error("Could not read image"));
      };
      reader.readAsDataURL(blob);
    });
  }

  function uploadToImgbb(blob) {
    return Promise.all([blobToBase64(blob), currentUser.getIdToken()]).then(function (parts) {
      if (!parts[0]) throw new Error("Empty image");
      return fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + parts[1]
        },
        body: JSON.stringify({ image: parts[0] })
      });
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok || !data || !data.url) {
          throw new Error((data && data.error) || "Upload failed");
        }
        return data.url;
      });
    });
  }

  changeBtn.addEventListener("click", function () {
    if (!currentUser) return;
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file || !currentUser) return;

    if (!/^image\//.test(file.type)) {
      showToast("Please choose an image file");
      return;
    }

    changeBtn.disabled = true;
    changeLabel.textContent = "Uploading...";

    resizeImage(file, 640).then(uploadToImgbb).then(function (url) {
      return db.ref("users").child(currentUser.uid).update({ profileImageUrl: url }).then(function () {
        avatarEl.src = url;
        showToast("Profile photo updated");
      });
    }).catch(function (err) {
      showToast("Couldn't update photo: " + (err && err.message ? err.message : "try again"));
    }).then(function () {
      changeBtn.disabled = false;
      changeLabel.textContent = "Change profile";
    });
  });

  document.getElementById("msgBtn").addEventListener("click", function () {
    showToast("Messaging isn't available yet");
  });

  function profileShareUrl(uid) {
    return location.origin + "/durbar/user/" + encodeURIComponent(uid);
  }

  function shareProfile(uid, name) {
    var url = profileShareUrl(uid);
    var title = (name || "Durbar User") + " on Durbar";
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        showToast("Link copied");
      }).catch(function () {});
    }
  }

  document.getElementById("oShareBtn").addEventListener("click", function () {
    shareProfile(otherUid, otherInfo.name);
  });

  document.getElementById("shareBtn").addEventListener("click", function () {
    shareProfile(currentUser.uid, displayName);
  });

  document.getElementById("menuBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    menuEl.classList.toggle("open");
  });

  document.addEventListener("click", function () {
    menuEl.classList.remove("open");
  });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    logout();
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      activeTab = tab.getAttribute("data-tab");
      loadTab(activeTab);
    });
  });

  auth.onAuthStateChanged(function (user) {
    if (user && !currentUser) start(user);
  });

  setTimeout(function () {
    if (!auth.currentUser) {
      location.replace("/?next=" + encodeURIComponent(location.pathname + location.search));
    }
  }, 2500);

})();