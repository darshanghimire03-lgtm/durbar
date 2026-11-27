const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://darbarhigh-4c642-default-rtdb.firebaseio.com",
  });
}

const WINDOW_MS = 15 * 60 * 1000;
const SECTIONS = ["A", "B"];
const SAFE_KEY = /^[^\/.#$\[\]]+$/;
const UPDATE_ALLOWED_EMAIL = (process.env.PUSH_UPDATE_EMAIL || "darshanghimire03@gmail.com").toLowerCase();

function parseSections(raw) {
  const text = String(raw || "").trim().toUpperCase();
  const matches = text.match(/(?<![A-Z])[A-Z](?![A-Z])/g) || [];
  return [...new Set(matches.filter((s) => SECTIONS.includes(s)))];
}

function targetSections(privacy) {
  const trimmed = String(privacy || "").trim();
  if (!trimmed.toLowerCase().startsWith("section")) return [];
  return parseSections(trimmed.substring("section".length));
}

async function claim(key) {
  const result = await admin
    .database()
    .ref("notified/" + key)
    .transaction((current) => (current ? undefined : true));
  return result.committed;
}

function send(topic, data) {
  return admin.messaging().send({
    topic,
    data,
    android: { priority: "high" },
  });
}

async function handlePost(uid, postId) {
  const fs = admin.firestore();
  const snap = await fs.collection("posts").doc(postId).get();
  if (!snap.exists) return { status: 404, body: { error: "post not found" } };
  const post = snap.data();

  if (post.authorUid !== uid) return { status: 403, body: { error: "forbidden" } };
  if (Date.now() - Number(post.createdAt || 0) > WINDOW_MS) {
    return { status: 200, body: { skipped: "old" } };
  }
  if (!(await claim("posts/" + postId))) {
    return { status: 200, body: { skipped: "duplicate" } };
  }

  const authorSnap = await fs.collection("users").doc(uid).get();
  const author = authorSnap.exists ? authorSnap.data() : {};

  const data = {
    type: "post",
    postId: String(postId),
    authorUid: String(uid),
    authorName: String(author.fullName || "Someone"),
    authorPhotoUrl: String(author.profileImageUrl || ""),
  };

  const privacy = String(post.privacy || "everyone").trim().toLowerCase();
  let topics;
  if (!privacy.startsWith("section")) {
    topics = ["posts_all"];
  } else {
    let sections = targetSections(post.privacy);
    if (sections.length === 0) sections = parseSections(author.section);
    topics = sections.map((s) => "section_" + s);
  }

  if (topics.length === 0) return { status: 200, body: { skipped: "no topics" } };

  await Promise.all(topics.map((topic) => send(topic, data)));
  return { status: 200, body: { sent: topics } };
}

async function handleNote(subjectKey, unitId, noteId) {
  const snap = await admin
    .firestore()
    .collection("units")
    .doc(subjectKey)
    .collection("unitItems")
    .doc(unitId)
    .get();
  if (!snap.exists) return { status: 404, body: { error: "unit not found" } };

  const notes = snap.get("notes") || {};
  const note = notes[noteId];
  if (!note) return { status: 404, body: { error: "note not found" } };

  if (Date.now() - Number(note.createdAt || 0) > WINDOW_MS) {
    return { status: 200, body: { skipped: "old" } };
  }
  if (!(await claim("notes/" + subjectKey + "_" + unitId + "_" + noteId))) {
    return { status: 200, body: { skipped: "duplicate" } };
  }

  await send("notes", {
    type: "note",
    subject: String(subjectKey),
    noteId: String(note.id || noteId),
    title: String(note.title || ""),
  });
  return { status: 200, body: { sent: ["notes"] } };
}

async function handleUpdate(decoded) {
  const email = String(decoded.email || "").toLowerCase();
  if (email !== UPDATE_ALLOWED_EMAIL) {
    return { status: 403, body: { error: "forbidden" } };
  }

  const snap = await admin.database().ref("config/app_update").get();
  const update = snap.val();
  if (!update || !update.downloadUrl) {
    return { status: 404, body: { error: "update not found" } };
  }
  if (Date.now() - Number(update.updatedAt || 0) > WINDOW_MS) {
    return { status: 200, body: { skipped: "old" } };
  }
  if (!(await claim("updates/" + String(update.versionCode)))) {
    return { status: 200, body: { skipped: "duplicate" } };
  }

  await send("app_update", {
    type: "update",
    versionName: String(update.versionName || ""),
    versionCode: String(update.versionCode || 0),
    whatsNew: String(update.whatsNew || ""),
  });
  return { status: 200, body: { sent: ["app_update"] } };
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  let decoded;
  try {
    const header = req.headers.authorization || "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!idToken) return res.status(401).json({ error: "missing token" });
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    let result;
    if (body.type === "post" && SAFE_KEY.test(String(body.postId || ""))) {
      result = await handlePost(decoded.uid, String(body.postId));
    } else if (
      body.type === "note" &&
      SAFE_KEY.test(String(body.subjectKey || "")) &&
      SAFE_KEY.test(String(body.unitId || "")) &&
      SAFE_KEY.test(String(body.noteId || ""))
    ) {
      result = await handleNote(
        String(body.subjectKey),
        String(body.unitId),
        String(body.noteId)
      );
    } else if (body.type === "update") {
      result = await handleUpdate(decoded);
    } else {
      result = { status: 400, body: { error: "bad request" } };
    }

    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error("notify error", e);
    return res.status(500).json({ error: "server error", message: String(e && e.message) });
  }
};