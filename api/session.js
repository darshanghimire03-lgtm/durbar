const { MAX_AGE, setCookie, exchange } = require("./_auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const origin = req.headers.origin;
  if (origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch (e) {
      host = "";
    }
    if (host !== req.headers.host) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
  }

  if (req.method === "DELETE") {
    setCookie(res, req, "", 0);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, DELETE");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (String(req.headers["content-type"] || "").indexOf("application/json") === -1) {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const token = body && typeof body.refreshToken === "string" ? body.refreshToken : "";
  if (!token || token.length > 4096) {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const session = await exchange(token);
  if (!session) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }

  setCookie(res, req, session.refreshToken, MAX_AGE);
  res.status(200).json({ ok: true });
};