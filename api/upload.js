const IMGBB_URL = "https://api.imgbb.com/1/upload";
const LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const MAX_BASE64_LENGTH = 4000000;

async function verifyUser(token) {
  const key = process.env.FIREBASE_API_KEY;
  if (!key || !token) return false;
  try {
    const res = await fetch(LOOKUP_URL + "?key=" + encodeURIComponent(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!(data && data.users && data.users.length);
  } catch (e) {
    return false;
  }
}

function toHttps(url) {
  return String(url || "").replace(/^http:\/\//i, "https://");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).send(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    res.status(500).send(JSON.stringify({ error: "Server is missing IMGBB_API_KEY" }));
    return;
  }

  const header = String(req.headers.authorization || "");
  const token = header.indexOf("Bearer ") === 0 ? header.slice(7).trim() : "";
  const allowed = await verifyUser(token);
  if (!allowed) {
    res.status(401).send(JSON.stringify({ error: "Please log in again" }));
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const image = body && typeof body.image === "string" ? body.image.trim() : "";

  if (!image || image.length > MAX_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    res.status(400).send(JSON.stringify({ error: "Invalid or too large image" }));
    return;
  }

  try {
    const upstream = await fetch(IMGBB_URL + "?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image: image }).toString()
    });
    const data = await upstream.json().catch(function () { return null; });
    const url = data && data.data ? toHttps(data.data.url || data.data.display_url) : "";

    if (!upstream.ok || !url) {
      const message = data && data.error && data.error.message ? data.error.message : "Image host rejected the upload";
      res.status(502).send(JSON.stringify({ error: message }));
      return;
    }

    res.status(200).send(JSON.stringify({ url: url }));
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: "Could not reach image host" }));
  }
};