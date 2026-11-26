const COOKIE = "durbar_session";
const MAX_AGE = 2592000;

function apiKey() {
  return process.env.FIREBASE_API_KEY || "";
}

function secureRequest(req) {
  return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function setCookie(res, req, value, maxAge) {
  res.setHeader(
    "Set-Cookie",
    COOKIE + "=" + encodeURIComponent(value) +
      "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge +
      (secureRequest(req) ? "; Secure" : "")
  );
}

function readCookie(req) {
  const parts = String(req.headers.cookie || "").split(";");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === COOKIE) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch (e) {
        return "";
      }
    }
  }
  return "";
}

async function exchange(refreshToken) {
  const r = await fetch(
    "https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(apiKey()),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken)
    }
  );
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.id_token || !d.refresh_token) return null;
  return {
    idToken: d.id_token,
    refreshToken: d.refresh_token,
    uid: d.user_id,
    expiresIn: Number(d.expires_in) || 3600
  };
}

async function lookup(idToken) {
  const r = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey()),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: idToken })
    }
  );
  if (!r.ok) return null;
  const d = await r.json();
  return (d.users && d.users[0]) || null;
}

async function loadProfile(session) {
  let name = "";
  let photo = "";
  let email = "";

  try {
    const acc = await lookup(session.idToken);
    if (acc) {
      name = acc.displayName || "";
      photo = acc.photoUrl || "";
      email = acc.email || "";
    }
  } catch (e) {}

  const base = String(process.env.FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");
  if (base) {
    try {
      const r = await fetch(
        base + "/users/" + encodeURIComponent(session.uid) + ".json?auth=" + encodeURIComponent(session.idToken)
      );
      if (r.ok) {
        const u = await r.json();
        if (u) {
          if (typeof u.fullName === "string" && u.fullName.trim()) name = u.fullName.trim();
          if (typeof u.profileImageUrl === "string" && u.profileImageUrl) photo = u.profileImageUrl;
          if (!email && typeof u.email === "string") email = u.email;
        }
      }
    } catch (e) {}
  }

  if (!name && email) name = email.split("@")[0];
  if (!/^https:\/\//i.test(photo)) photo = "";
  return { name: name, email: email, photo: photo };
}

module.exports = {
  MAX_AGE: MAX_AGE,
  setCookie: setCookie,
  readCookie: readCookie,
  exchange: exchange,
  lookup: lookup,
  loadProfile: loadProfile
};