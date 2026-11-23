import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const DB = "https://darbarhigh-4c642-default-rtdb.firebaseio.com";
const WIDTH = 1200;
const HEIGHT = 630;
const FONT_LATIN = "https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-normal.woff";
const FONT_DEVANAGARI = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-devanagari@latest/devanagari-700-normal.woff";
const fontCache = {};

function str(value) {
  return typeof value === "string" ? value : "";
}

function shorten(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "\u2026" : clean;
}

async function loadValue(path) {
  try {
    const res = await fetch(DB + "/" + path + ".json");
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function loadFont(url) {
  if (!fontCache[url]) {
    fontCache[url] = fetch(url)
      .then(function (res) { return res.ok ? res.arrayBuffer() : null; })
      .catch(function () { return null; });
  }
  return fontCache[url];
}

async function getFonts(text) {
  const fonts = [];
  const latin = await loadFont(FONT_LATIN);
  if (latin) fonts.push({ name: "Roboto", data: latin, weight: 700, style: "normal" });
  if (/[\u0900-\u097F]/.test(text)) {
    const deva = await loadFont(FONT_DEVANAGARI);
    if (deva) fonts.push({ name: "Noto Sans Devanagari", data: deva, weight: 700, style: "normal" });
  }
  return fonts;
}

function wrapLines(text, perLine, maxLines) {
  const lines = [];
  const paragraphs = String(text || "").replace(/\r/g, "").split("\n");
  for (let i = 0; i < paragraphs.length; i++) {
    const words = paragraphs[i].trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }
    let line = "";
    for (let w = 0; w < words.length; w++) {
      let word = words[w];
      while (word.length > perLine) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(word.slice(0, perLine));
        word = word.slice(perLine);
      }
      if (!line) {
        line = word;
      } else if ((line + " " + word).length <= perLine) {
        line = line + " " + word;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (lines.length <= maxLines) return lines;
  const cut = lines.slice(0, maxLines);
  let last = cut[maxLines - 1].replace(/\s+$/, "");
  if (last.length >= perLine) last = last.slice(0, perLine - 1);
  cut[maxLines - 1] = last + "\u2026";
  return cut;
}

async function avatarData(url) {
  if (!/^https?:\/\//i.test(url || "")) return "";
  let src = url;
  if (src.indexOf("res.cloudinary.com") !== -1 && src.indexOf("/image/upload/") !== -1) {
    src = src.replace("/image/upload/", "/image/upload/w_200,h_200,c_fill,g_face,f_jpg/");
  }
  try {
    const res = await fetch(src);
    if (!res.ok) return "";
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (type !== "image/jpeg" && type !== "image/png") return "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > 3000000) return "";
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return "data:" + type + ";base64," + btoa(binary);
  } catch (e) {
    return "";
  }
}

async function loadCard(id) {
  const empty = { name: "Durbar", photo: "", text: "Open this post in the Durbar app" };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return empty;
  const key = encodeURIComponent(id);
  const post = await Promise.all([
    loadValue("posts/" + key + "/authorUid"),
    loadValue("posts/" + key + "/text"),
    loadValue("posts/" + key + "/privacy")
  ]);
  const authorUid = str(post[0]);
  const text = str(post[1]);
  const privacy = String(post[2] == null || post[2] === "" ? "everyone" : post[2]).trim().toLowerCase();
  if (!authorUid && !text) return empty;

  let name = "";
  let photo = "";
  if (authorUid && /^[A-Za-z0-9_-]{1,128}$/.test(authorUid)) {
    const uKey = encodeURIComponent(authorUid);
    const user = await Promise.all([
      loadValue("users/" + uKey + "/fullName"),
      loadValue("users/" + uKey + "/profileImageUrl")
    ]);
    name = str(user[0]);
    photo = str(user[1]);
  }

  if (privacy !== "everyone") {
    return { name: name || "Durbar User", photo: photo, text: "Open this post in the Durbar app" };
  }
  return { name: name || "Durbar User", photo: photo, text: text };
}

function node(type, style, children, extra) {
  return { type: type, props: Object.assign({ style: style, children: children }, extra || {}) };
}

function buildCard(card, avatar) {
  const lines = wrapLines(card.text, 40, 7);
  const initial = (card.name || "D").charAt(0).toUpperCase();

  const avatarNode = avatar
    ? node("img", { width: 96, height: 96, borderRadius: 48, objectFit: "cover" }, undefined, { src: avatar, width: 96, height: 96 })
    : node("div", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 96,
        height: 96,
        borderRadius: 48,
        background: "#1e4b7a",
        color: "#ffffff",
        fontSize: 44,
        fontWeight: 700
      }, initial);

  const header = node("div", { display: "flex", alignItems: "center" }, [
    avatarNode,
    node("div", { display: "flex", marginLeft: 28, fontSize: 40, fontWeight: 700, color: "#1c1e21" }, shorten(card.name, 30))
  ]);

  const body = node("div", {
    display: "flex",
    marginTop: 44,
    height: 380,
    overflow: "hidden",
    fontSize: 42,
    fontWeight: 700,
    lineHeight: 1.3,
    color: "#1c1e21",
    whiteSpace: "pre-wrap"
  }, lines.join("\n"));

  return node("div", {
    display: "flex",
    flexDirection: "column",
    width: WIDTH,
    height: HEIGHT,
    padding: "52px 70px",
    background: "#ffffff",
    fontFamily: "Roboto, Noto Sans Devanagari"
  }, [header, body]);
}

export default async function handler(request) {
  const url = new URL(request.url);
  try {
    const id = (url.searchParams.get("id") || "").trim();
    const card = await loadCard(id);
    const results = await Promise.all([avatarData(card.photo), getFonts(card.text + card.name)]);
    const options = {
      width: WIDTH,
      height: HEIGHT,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" }
    };
    if (results[1].length) options.fonts = results[1];
    return new ImageResponse(buildCard(card, results[0]), options);
  } catch (e) {
    return new Response(null, { status: 302, headers: { Location: url.origin + "/favicon.png" } });
  }
}