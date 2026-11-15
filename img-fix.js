(function () {
  var descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (!descriptor || !descriptor.set) return;

  var PROXY = "https://images.weserv.nl/?url=";
  var FALLBACK = "/favicon.png";

  function fixUrl(value) {
    if (typeof value !== "string") return value;
    var url = value.trim().replace(/^["']+|["']+$/g, "");
    if (url.indexOf("//") === 0) url = "https:" + url;
    if (/^http:\/\//i.test(url)) url = "https://" + url.slice(7);
    return url;
  }

  function isRemote(url) {
    return /^https:\/\//i.test(url) && url.indexOf(location.host) === -1 && url.indexOf(PROXY) !== 0;
  }

  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set: function (value) {
      this.referrerPolicy = "no-referrer";
      this.__imgTry = 0;
      descriptor.set.call(this, fixUrl(value));
    }
  });

  window.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG") return;

    var current = descriptor.get.call(img) || "";
    var tries = img.__imgTry || 0;

    if (tries === 0 && isRemote(current)) {
      img.__imgTry = 1;
      e.stopImmediatePropagation();
      descriptor.set.call(img, PROXY + encodeURIComponent(current));
      return;
    }

    if (tries <= 1 && !img.onerror && /avatar/i.test(img.className + " " + img.id)) {
      img.__imgTry = 2;
      e.stopImmediatePropagation();
      descriptor.set.call(img, FALLBACK);
    }
  }, true);
})();