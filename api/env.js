const BUNDLE = String.raw`
const firebaseConfig = {};
Object.keys(APP_ENV).forEach(function (key) {
  if (APP_ENV[key]) firebaseConfig[key] = APP_ENV[key];
});

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

const SUBJECTS = ["Economic", "Account", "Computer Science", "English", "Nepali"];

const IS_AUTH_PAGE = /^\/((index(\.html)?)|login\/?|signup\/?)?$/.test(location.pathname) || /(^|\/)reset-password(\/(index\.html)?)?$/.test(location.pathname);

if (!IS_AUTH_PAGE) {
  document.documentElement.style.visibility = "hidden";
  auth.onAuthStateChanged(function (user) {
    if (user) {
      document.documentElement.style.visibility = "";
      return;
    }
    const here = location.pathname + location.search + location.hash;
    location.replace("/?next=" + encodeURIComponent(here));
  });
}

function logout() {
  return auth.signOut().then(function () {
    location.replace("/");
  });
}

function sanitizeKey(rawKey) {
  return rawKey
    .replaceAll(".", "_")
    .replaceAll("#", "_")
    .replaceAll("$", "_")
    .replaceAll("[", "_")
    .replaceAll("]", "_");
}

function unitsRef(subjectKey) {
  return db.ref("units").child(sanitizeKey(subjectKey));
}

function notesRef(subjectKey, unitId) {
  return db.ref("units").child(sanitizeKey(subjectKey)).child(unitId).child("notes");
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}
`;

function readEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  return {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || (projectId ? projectId + ".firebaseapp.com" : ""),
    databaseURL: String(process.env.FIREBASE_DATABASE_URL || "").replace(/\/+$/, ""),
    projectId: projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  };
}

module.exports = function handler(req, res) {
  const env = readEnv();
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");

  const missing = [];
  if (!env.apiKey) missing.push("FIREBASE_API_KEY");
  if (!env.databaseURL) missing.push("FIREBASE_DATABASE_URL");
  if (!env.projectId) missing.push("FIREBASE_PROJECT_ID");

  if (missing.length) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).send("console.error(" + JSON.stringify("Missing Firebase environment variables: " + missing.join(", ")) + ");");
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

  const json = JSON.stringify(env).replace(/</g, "\\u003c");
  let out = "window.APP_ENV=" + json + ";";
  if (String((req.query && req.query.bundle) || "") === "1") {
    out += "\n" + BUNDLE;
  }

  res.status(200).send(out);
};