
const admin = require("firebase-admin");

const WINDOW_MS = 15 * 60 * 1000;
const SECTIONS = ["A", "B"];
const SAFE_KEY = /^[^\/.#$\[\]\x00-\x1F\x7F]+$/;

const DATABASE_URL =
  "https://darbarhigh-4c642-default-rtdb.firebaseio.com";

function initializeFirebase() {
  if (admin.apps.length) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing");
  }

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
    databaseURL: DATABASE_URL,
  });
}

function parseSections(raw) {
  const text = String(raw || "").trim().toUpperCase();
  const matches = text.match(/(?<![A-Z])[A-Z](?![A-Z])/g) || [];

  return [...new Set(matches.filter(s => SECTIONS.includes(s)))];
}

function targetSections(privacy) {
  const value = String(privacy || "").trim();

  if (!value.toLowerCase().startsWith("section")) {
    return [];
  }

  return parseSections(value.substring("section".length));
}

async function claim(path) {
  const result = await admin
    .database()
    .ref(path)
    .transaction(current => current ? undefined : true);

  return result.committed;
}

async function release(path) {
  await admin.database().ref(path).remove();
}

async function sendOnce(path, topic, data) {
  const claimed = await claim(path);

  if (!claimed) {
    return "duplicate";
  }

  try {
    await admin.messaging().send({
      topic,
      data,
      android: {
        priority: "high",
      },
    });

    return "sent";
  } catch (error) {
    // Allow retry if Firebase rejected the notification.
    await release(path);
    throw error;
  }
}

function isRecent(createdAt) {
  const timestamp = Number(createdAt);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return false;
  }

  return Date.now() - timestamp <= WINDOW_MS;
}

async function handlePost(uid, postId) {
  const db = admin.database();

  const snapshot = await db.ref("posts/" + postId).get();
  const post = snapshot.val();

  if (!post) {
    return { status: 404, body: { error: "post not found" } };
  }

  if (String(post.authorUid) !== String(uid)) {
    return { status: 403, body: { error: "forbidden" } };
  }

  if (!isRecent(post.createdAt)) {
    return {
      status: 200,
      body: { skipped: "old" },
    };
  }

  const authorSnapshot = await db.ref("users/" + uid).get();
  const author = authorSnapshot.val() || {};

  const data = {
    type: "post",
    postId: String(postId),
    authorUid: String(uid),
    authorName: String(author.fullName || "Someone"),
    authorPhotoUrl: String(author.profileImageUrl || ""),
  };

  const privacy = String(post.privacy || "everyone")
    .trim()
    .toLowerCase();

  let topics;

  if (!privacy.startsWith("section")) {
    topics = ["posts_all"];
  } else {
    let sections = targetSections(post.privacy);

    if (sections.length === 0) {
      sections = parseSections(author.section);
    }

    topics = sections.map(section => "section_" + section);
  }

  if (topics.length === 0) {
    return {
      status: 200,
      body: { skipped: "no valid sections" },
    };
  }

  const results = await Promise.all(
    topics.map(async topic => {
      const path = "notified/posts/" + postId + "/" + topic;

      return {
        topic,
        result: await sendOnce(path, topic, data),
      };
    })
  );

  return {
    status: 200,
    body: {
      sent: results
        .filter(item => item.result === "sent")
        .map(item => item.topic),
      skipped: results
        .filter(item => item.result === "duplicate")
        .map(item => item.topic),
    },
  };
}

async function handleNote(subjectKey, unitId, noteId) {
  const db = admin.database();

  const path =
    "units/" +
    subjectKey +
    "/" +
    unitId +
    "/notes/" +
    noteId;

  const snapshot = await db.ref(path).get();
  const note = snapshot.val();

  if (!note) {
    return {
      status: 404,
      body: { error: "note not found" },
    };
  }

  if (!isRecent(note.createdAt)) {
    return {
      status: 200,
      body: { skipped: "old" },
    };
  }

  const data = {
    type: "note",
    subject: String(subjectKey),
    noteId: String(note.id || noteId),
    title: String(note.title || ""),
  };

  const notificationPath =
    "notified/notes/" +
    subjectKey +
    "/" +
    unitId +
    "/" +
    noteId +
    "/notes";

  const result = await sendOnce(
    notificationPath,
    "notes",
    data
  );

  return {
    status: 200,
    body: result === "sent"
      ? { sent: ["notes"] }
      : { skipped: "duplicate" },
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "method not allowed",
    });
  }

  try {
    initializeFirebase();

    const header = req.headers.authorization || "";
    const idToken = header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : "";

    if (!idToken) {
      return res.status(401).json({
        error: "missing token",
      });
    }

    let decoded;

    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      return res.status(401).json({
        error: "invalid authentication token",
      });
    }

    let body;

    try {
      body = typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};
    } catch (error) {
      return res.status(400).json({
        error: "invalid JSON",
      });
    }

    let result;

    if (
      body.type === "post" &&
      SAFE_KEY.test(String(body.postId || ""))
    ) {
      result = await handlePost(
        decoded.uid,
        String(body.postId)
      );
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
    } else {
      return res.status(400).json({
        error: "bad request",
      });
    }

    return res.status(result.status).json(result.body);

  } catch (error) {
    console.error("Durbar notification error:", error);

    return res.status(500).json({
      error: "notification server error",
    });
  }
};
