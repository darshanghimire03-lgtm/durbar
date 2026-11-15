(function () {
  var descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (!descriptor || !descriptor.set) return;

  function fixUrl(value) {
    if (typeof value !== "string") return value;
    var url = value.trim();
    if (url.indexOf("//") === 0) url = "https:" + url;
    if (/^http:\/\/([a-z0-9-]+\.)?(ibb\.co|imgbb\.com)\//i.test(url)) url = "https://" + url.slice(7);
    return url;
  }

  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set: function (value) {
      this.referrerPolicy = "no-referrer";
      descriptor.set.call(this, fixUrl(value));
    }
  });
})();