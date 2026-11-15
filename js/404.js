(function () {
  var stage = document.getElementById("stage");
  if (!stage) return;

  var sparks = [
    [-160, -40], [160, -40], [-140, 60], [140, 60], [0, -140], [0, 140],
    [-120, -120], [120, -120], [-120, 120], [120, 120], [-180, 0], [180, 0]
  ];

  var twinkles = [
    [10, 15, 0], [80, 20, 0.6], [20, 85, 1.2], [75, 80, 1.8], [50, 5, 0.9], [50, 95, 1.5]
  ];

  sparks.forEach(function (s) {
    var node = document.createElement("div");
    node.className = "spark";
    node.style.setProperty("--tx", s[0] + "px");
    node.style.setProperty("--ty", s[1] + "px");
    stage.appendChild(node);
  });

  twinkles.forEach(function (t) {
    var node = document.createElement("div");
    node.className = "twinkle";
    node.style.top = t[0] + "%";
    node.style.left = t[1] + "%";
    node.style.animationDelay = t[2] + "s";
    stage.appendChild(node);
  });
})();