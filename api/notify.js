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

const EVENT_TYPES = {
  test: "Test",
  exam: "Exam",
  school_event: "School Event",
  vacation: "Vacation",
};
const EVENT_EDITOR_ROLES = ["professor", "captain"];
const NEPALI_MONTHS = [
  "Baisakh", "Jestha", "Asadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

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

function topicsFor(privacy, author) {
  const normalized = String(privacy || "everyone").trim().toLowerCase();
  if (!normalized.startsWith("section")) return ["posts_all"];
  let sections = targetSections(privacy);
  if (sections.length === 0) sections = parseSections(author.section);
  return sections.map((s) => "section_" + s);
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

function monthName(month) {
  return NEPALI_MONTHS[Number(month) - 1] || "";
}

function formatClock(value) {
  const parts = String(value || "").split(":");
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return String(value || "");
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return twelve + ":" + String(minute).padStart(2, "0") + " " + suffix;
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

  const topics = topicsFor(post.privacy, author);
  if (topics.length === 0) return { status: 200, body: { skipped: "no topics" } };

  await Promise.all(topics.map((topic) => send(topic, data)));
  return { status: 200, body: { sent: topics } };
}

async function handlePoll(uid, pollId) {
  const fs = admin.firestore();
  const snap = await fs.collection("poll").doc(pollId).get();
  if (!snap.exists) return { status: 404, body: { error: "poll not found" } };
  const poll = snap.data();

  if (poll.authorUid !== uid) return { status: 403, body: { error: "forbidden" } };
  if (Date.now() - Number(poll.createdAt || 0) > WINDOW_MS) {
    return { status: 200, body: { skipped: "old" } };
  }
  if (!(await claim("polls/" + pollId))) {
    return { status: 200, body: { skipped: "duplicate" } };
  }

  const authorSnap = await fs.collection("users").doc(uid).get();
  const author = authorSnap.exists ? authorSnap.data() : {};

  const data = {
    type: "poll",
    pollId: String(pollId),
    authorUid: String(uid),
    authorName: String(author.fullName || "Someone"),
    authorPhotoUrl: String(author.profileImageUrl || ""),
    topic: String(poll.topic || "").slice(0, 120),
  };

  const topics = topicsFor(poll.privacy, author);
  if (topics.length === 0) return { status: 200, body: { skipped: "no topics" } };

  await Promise.all(topics.map((topic) => send(topic, data)));
  return { status: 200, body: { sent: topics } };
}

async function handleMessage(uid, chatId, messageId) {
  const fs = admin.firestore();

  const senderSnap = await fs.collection("users").doc(uid).get();
  if (!senderSnap.exists) return { status: 404, body: { error: "user not found" } };
  const sender = senderSnap.data();

  const senderChats = Array.isArray(sender.chats) ? sender.chats : [];
  if (!senderChats.includes(chatId)) return { status: 403, body: { error: "forbidden" } };

  const msgSnap = await admin.database().ref("chats/" + chatId + "/" + messageId).get();
  const msg = msgSnap.val();
  if (!msg) return { status: 404, body: { error: "message not found" } };
  if (msg.senderId !== uid) return { status: 403, body: { error: "forbidden" } };

  if (Date.now() - Number(msg.sentAt || 0) > WINDOW_MS) {
    return { status: 200, body: { skipped: "old" } };
  }
  if (!(await claim("messages/" + chatId + "_" + messageId))) {
    return { status: 200, body: { skipped: "duplicate" } };
  }

  const members = await fs.collection("users").where("chats", "array-contains", chatId).get();
  const recipients = members.docs.filter((d) => d.id !== uid);
  if (recipients.length === 0) return { status: 200, body: { skipped: "no recipient" } };

  let preview = String(msg.text || "").trim();
  if (!preview && msg.imgUrl) preview = "Photo";
  if (preview.length > 200) preview = preview.substring(0, 197) + "...";

  const data = {
    type: "message",
    chatId: String(chatId),
    messageId: String(messageId),
    senderUid: String(uid),
    senderName: String(sender.fullName || "Someone"),
    senderPhotoUrl: String(sender.profileImageUrl || ""),
    text: preview,
    sentAt: String(msg.sentAt || Date.now()),
  };

  let sent = 0;
  for (const doc of recipients) {
    const stored = doc.get("fcmTokens");
    const tokens = (Array.isArray(stored) ? stored : []).filter((t) => typeof t === "string" && t);
    if (tokens.length === 0) continue;

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: Object.assign({}, data, { toUid: doc.id }),
      android: { priority: "high" },
    });
    sent += response.successCount;

    const dead = [];
    response.responses.forEach((r, i) => {
      const code = r.error && r.error.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length > 0) {
      await doc.ref.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead) });
    }
  }

  return { status: 200, body: { sent } };
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
    downloadUrl: String(update.downloadUrl || ""),
  });
  return { status: 200, body: { sent: ["app_update"] } };
}

async function handleEvent(uid, year, month, eventType, eventId) {
  if (!EVENT_TYPES[eventType]) return { status: 200, body: { skipped: "type" } };

  const fs = admin.firestore();
  const userSnap = await fs.collection("users").doc(uid).get();
  const role = String((userSnap.exists && userSnap.get("role")) || "").trim().toLowerCase();
  if (!EVENT_EDITOR_ROLES.includes(role)) {
    return { status: 403, body: { error: "forbidden" } };
  }

  const snap = await fs.collection("calendar").doc(String(year)).get();
  if (!snap.exists) return { status: 404, body: { error: "calendar not found" } };

  const event = snap.get(new admin.firestore.FieldPath(String(month), eventType, eventId));
  if (!event) return { status: 404, body: { error: "event not found" } };

  if (!(await claim("events/" + year + "_" + month + "_" + eventType + "_" + eventId))) {
    return { status: 200, body: { skipped: "duplicate" } };
  }

  let title = "";
  let dateText = "";
  let timeText = "";

  if (eventType === "test") {
    const subjects = Array.isArray(event.subjects) ? event.subjects.filter(Boolean) : [];
    title = subjects.length ? subjects.join(" · ") + " Test" : "Test";
    dateText = monthName(month) + " " + event.day + ", " + year;
  } else if (eventType === "exam") {
    const subject = String(event.subject || "");
    title = subject ? subject + " Exam" : "Exam";
    dateText = monthName(month) + " " + event.day + ", " + year;
    if (event.startTime) {
      timeText = formatClock(event.startTime) + (event.endTime ? " - " + formatClock(event.endTime) : "");
    }
  } else if (eventType === "school_event") {
    title = String(event.title || "School Event");
    dateText = monthName(month) + " " + event.day + ", " + year;
  } else {
    title = String(event.title || "Vacation");
    const startMonth = Number(event.startMonth || month);
    const endMonth = Number(event.endMonth || startMonth);
    const startDay = event.startDay;
    const endDay = event.endDay || startDay;
    if (startMonth === endMonth && startDay === endDay) {
      dateText = monthName(startMonth) + " " + startDay + ", " + year;
    } else {
      dateText = monthName(startMonth) + " " + startDay + " - " + monthName(endMonth) + " " + endDay + ", " + year;
    }
  }

  let text = dateText;
  if (timeText) text += " • " + timeText;
  const description = String(event.description || "").trim();
  if (description) {
    text += " • " + (description.length > 80 ? description.substring(0, 77) + "..." : description);
  }

  await send("posts_all", {
    type: "event",
    eventType: String(eventType),
    eventId: String(eventId),
    heading: "New " + EVENT_TYPES[eventType],
    title: String(title),
    text: String(text),
    photoUrl: String(event.photoUrl || ""),
  });
  return { status: 200, body: { sent: ["posts_all"] } };
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
    } else if (body.type === "poll" && SAFE_KEY.test(String(body.pollId || ""))) {
      result = await handlePoll(decoded.uid, String(body.pollId));
    } else if (
      body.type === "message" &&
      SAFE_KEY.test(String(body.chatId || "")) &&
      SAFE_KEY.test(String(body.messageId || ""))
    ) {
      result = await handleMessage(decoded.uid, String(body.chatId), String(body.messageId));
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
    } else if (
      body.type === "event" &&
      /^\d{4}$/.test(String(body.year || "")) &&
      /^(1[0-2]|[1-9])$/.test(String(body.month || "")) &&
      SAFE_KEY.test(String(body.eventType || "")) &&
      SAFE_KEY.test(String(body.eventId || ""))
    ) {
      result = await handleEvent(
        decoded.uid,
        String(body.year),
        String(body.month),
        String(body.eventType),
        String(body.eventId)
      );
    } else {
      result = { status: 400, body: { error: "bad request" } };
    }

    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error("notify error", e);
    return res.status(500).json({ error: "server error", message: String(e && e.message) });
  }
};