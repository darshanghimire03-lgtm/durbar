const {
  MAX_AGE, setCookie, readCookie, exchange, lookup, loadProfile
} = require("./_auth");

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.method === "GET";
  try {
    return new URL(origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Cookie");

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!sameOrigin(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const isPost = req.method === "POST";
  const token = readCookie(req);

  let session = null;
  if (token) {
    try {
      session = await exchange(token);
    } catch (e) {
      session = null;
    }
  }

  if (!session) {
    if (isPost) {
      res.status(401).json({ error: "no_session" });
    } else {
      res.status(200).json({ loggedIn: false });
    }
    return;
  }

  setCookie(res, req, session.refreshToken, MAX_AGE);

  if (isPost) {
    let acc = null;
    try {
      acc = await lookup(session.idToken);
    } catch (e) {
      acc = null;
    }
    if (!acc) {
      res.status(401).json({ error: "no_session" });
      return;
    }
    res.status(200).json({
      uid: session.uid,
      idToken: session.idToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      account: {
        email: acc.email || "",
        emailVerified: !!acc.emailVerified,
        displayName: acc.displayName || "",
        photoUrl: acc.photoUrl || "",
        phoneNumber: acc.phoneNumber || "",
        createdAt: acc.createdAt || "",
        lastLoginAt: acc.lastLoginAt || "",
        providers: (acc.providerUserInfo || []).map(function (p) {
          return {
            providerId: p.providerId || "",
            rawId: p.rawId || "",
            displayName: p.displayName || "",
            email: p.email || "",
            photoUrl: p.photoUrl || "",
            phoneNumber: p.phoneNumber || ""
          };
        })
      }
    });
    return;
  }

  const profile = await loadProfile(session);
  res.status(200).json({
    loggedIn: true,
    name: profile.name,
    email: profile.email,
    photo: profile.photo
  });
};