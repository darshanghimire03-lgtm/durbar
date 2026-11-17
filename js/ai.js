const API = 'https://durbar-ai.vercel.app';
const PROFILE_URL = 'https://durbar-plus2.vercel.app/durbar/user/';
const IMGBB_URL = 'https://api.imgbb.com/1/upload';
const IMGBB_KEY = '0575ff9da4246868dc605e19b912df98';
const BADGES = {
  professor: 'https://res.cloudinary.com/ddgpgkjpz/image/upload/v1780672320/fwxew1kh1vqpti1hzljq.png',
  captain: 'https://res.cloudinary.com/ddgpgkjpz/image/upload/v1780672320/fwxew1kh1vqpti1hzljq.png',
  moderator: 'https://res.cloudinary.com/ddgpgkjpz/image/upload/v1780672312/bzk2ytyq1md3os2giyuy.png'
};
const AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#1E3A8A" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
);
const MAX_IMG = 3;
const MAX_CHATS = 50;
const HISTORY = 12;
const THINKING = 'Thinking…';
const UPLOADING = 'Uploading photos…';
const WORKING = 'Working on it…';
const GENERIC_ERROR = "Couldn't reach Durbar AI. Check your connection and try again.";
const UPLOAD_ERROR = "Couldn't upload the photo. Check your connection and try again.";
const STREAM_ERROR = 'Something went wrong. Please try again.';
const ITEM = /^([ \t]*)([-*+•]|\d{1,9}[.)])[ \t]+(.*)$/;
const RULE = /^([-*_])(\s*\1){2,}$/;
const TABLE_SEP = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

const $ = s => document.querySelector(s);
const read = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v == null ? d : v;
  } catch (e) {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = n => '<svg class="i"><use href="#i-' + n + '"/></svg>';
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
const fmt = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const scrollEl = $('#scroll');
const list = $('#list');
const empty = $('#empty');
const greetEl = $('#greet');
const bar = $('#bar');
const q = $('#q');
const send = $('#send');
const mic = $('#mic');
const plus = $('#plus');
const chip = $('#chip');
const strip = $('#strip');
const fileInput = $('#file');
const drawer = $('#drawer');
const scrim = $('#scrim');
const hist = $('#hist');
const histEmpty = $('#histEmpty');
const lb = $('#lb');
const lbImg = $('#lbImg');
const lbDl = $('#lbDl');
const toastEl = $('#toast');

let sessions = read('durbar_ai_chats', []).sort((a, b) => b.updatedAt - a.updatedAt);
let cur = null;
let msgs = [];
let models = [];
let modelId = read('durbar_ai_model', null);
let modelsLoading = false;
let profile = Object.assign({ fullName: '', role: 'student', classLevel: '', section: '' }, read('durbar_ai_user', {}));
let pending = [];
let sending = false;
let ctrl = null;
let stick = true;
let buf = '';
let status = THINKING;
let lastPush = 0;
let pushTimer = null;
let toastTimer = null;

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2200);
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

function inline(src) {
  const codes = [];
  let s = esc(src).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return '\u0000' + (codes.length - 1) + '\u0000';
  });
  s = s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<b>$1$2</b>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, '$1<i>$2</i>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[i] + '</code>');
}

function cells(row) {
  const s = row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return s.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
}

function md(src) {
  const L = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let para = [];
  let indents = [];

  const flush = () => {
    if (para.length) {
      out.push('<p>' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
      para = [];
    }
  };

  while (i < L.length) {
    const raw = L[i].replace(/\s+$/, '');
    const t = raw.trim();

    if (!t) {
      flush();
      indents = [];
      i++;
      continue;
    }

    let m = t.match(/^(`{3,}|~{3,})\s*([^\s`]*)/);
    if (m) {
      flush();
      indents = [];
      const body = [];
      i++;
      while (i < L.length && !L[i].trim().startsWith(m[1])) body.push(L[i++]);
      i++;
      out.push(
        '<div class="code"><div class="ch"><span>' + esc(m[2] || 'code') +
        '</span><button type="button" class="cp">Copy</button></div><pre><code>' +
        esc(body.join('\n')) + '</code></pre></div>'
      );
      continue;
    }

    m = t.match(/^(#{1,6})\s+(.*?)(?:\s+#+)?$/);
    if (m && m[2]) {
      flush();
      indents = [];
      out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>');
      i++;
      continue;
    }

    if (RULE.test(t)) {
      flush();
      indents = [];
      out.push('<hr>');
      i++;
      continue;
    }

    const next = (L[i + 1] || '').trim();
    if (t.includes('|') && next.includes('|') && TABLE_SEP.test(next)) {
      flush();
      indents = [];
      const head = cells(t);
      const align = cells(next).map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'));
      const rows = [];
      i += 2;
      while (i < L.length && L[i].trim() && L[i].includes('|')) rows.push(cells(L[i++]));
      const tr = (tag, r) =>
        '<tr>' + head.map((_, k) => '<' + tag + ' style="text-align:' + (align[k] || 'left') + '">' + inline(r[k] || '') + '</' + tag + '>').join('') + '</tr>';
      out.push('<div class="tw"><table>' + tr('th', head) + rows.map(r => tr('td', r)).join('') + '</table></div>');
      continue;
    }

    if (t[0] === '>') {
      flush();
      indents = [];
      const quoted = [];
      while (i < L.length && L[i].trim()[0] === '>') {
        quoted.push(L[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + inline(quoted.join('\n')).replace(/\n/g, '<br>') + '</blockquote>');
      continue;
    }

    const im = raw.match(ITEM);
    if (im) {
      flush();
      const width = im[1].replace(/\t/g, '    ').length;
      while (indents.length && width < indents[indents.length - 1]) indents.pop();
      if (!indents.length || width > indents[indents.length - 1]) indents.push(width);
      const depth = Math.min(indents.length - 1, 3);
      let marker = /\d/.test(im[2][0]) ? im[2] : ['•', '◦', '▪', '▪'][depth];
      let body = im[3];
      const task = body.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        marker = task[1] === ' ' ? '☐' : '☑';
        body = task[2];
      }
      const after = /^<div class="li/.test(out[out.length - 1] || '');
      out.push(
        '<div class="li' + (after ? '' : ' first') + '" style="margin-left:' + (4 + depth * 18) + 'px"><span class="mk">' +
        esc(marker) + '</span><span>' + inline(body) + '</span></div>'
      );
      i++;
      continue;
    }

    indents = [];
    para.push(t);
    i++;
  }

  flush();
  return out.join('');
}

function stripImages(text) {
  return text.includes('![') ? text.replace(/!\[[^\]]*\]\([^)]*(\)|$)/g, '').replace(/\n{3,}/g, '\n\n') : text;
}

function splitSources(text) {
  const re = /^[ \t>#*_-]*sources?[ \t]*[:：]?[ \t*_]*(?=$|https?:\/\/|\[)/gim;
  let last = null;
  let m;
  while ((m = re.exec(text))) last = m;
  if (!last) return { body: text, sources: [] };
  const tail = text.slice(last.index + last[0].length);
  const map = new Map();
  for (const x of tail.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const u = x[2].replace(/[.,;]+$/, '');
    if (!map.has(u)) map.set(u, { url: u, title: x[1] });
  }
  for (const x of tail.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
    const u = x[0].replace(/[.,;]+$/, '');
    if (!map.has(u)) map.set(u, { url: u, title: '' });
  }
  const sources = [...map.values()];
  if (!sources.length && tail.trim()) return { body: text, sources: [] };
  return { body: text.slice(0, last.index).replace(/\s+$/, ''), sources };
}

function imagesHtml(urls) {
  if (!urls || !urls.length) return '';
  return '<div class="imgs">' + urls.map((u, i) => '<button type="button" data-img="' + i + '"><img src="' + esc(u) + '" alt="Photo"></button>').join('') + '</div>';
}

function sourcesHtml(sources) {
  if (!sources || !sources.length) return '';
  const shown = sources.slice(0, 5).map(s => {
    const h = host(s.url);
    const face = h
      ? '<img src="https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(h) + '" alt="" onerror="this.remove()">'
      : icon('web');
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + esc(h || 'Source') + '">' + face + '</a>';
  }).join('');
  const extra = sources.length - 5;
  return '<div class="src">' + shown + (extra > 0 ? '<span>+' + extra + '</span>' : '') + '</div>';
}

function cardHtml(p) {
  const role = p.role ? p.role[0].toUpperCase() + p.role.slice(1) : '';
  const badge = p.verified ? BADGES[(p.role || '').toLowerCase()] : '';
  const detail = p.subject
    ? 'Subject: ' + p.subject
    : p.classLevel && p.section
      ? 'Class ' + p.classLevel + ' • Section ' + p.section
      : p.classLevel
        ? 'Class ' + p.classLevel
        : '';
  return '<div class="pc"><div class="pr">' +
    '<img class="pp" src="' + esc(p.photoUrl || AVATAR) + '" alt="" onerror="this.onerror=null;this.src=AVATAR">' +
    '<div class="pi"><div class="pn"><span>' + esc(p.name) + '</span>' + (badge ? '<img src="' + esc(badge) + '" alt="Verified">' : '') + '</div>' +
    (role ? '<div class="role">' + esc(role) + '</div>' : '') +
    (detail ? '<div class="pd">' + esc(detail) + '</div>' : '') +
    '</div></div>' +
    (p.uid ? '<a class="vp" href="' + PROFILE_URL + encodeURIComponent(p.uid) + '" target="_blank" rel="noopener">View profile</a>' : '') +
    '</div>';
}

function node(m) {
  const d = document.createElement('div');
  d.className = 'm ' + (m.isUser ? 'u' : 'b');
  if (m.isUser) {
    d.innerHTML = imagesHtml(m.images) + (m.text ? '<div class="bub">' + esc(m.text) + '</div>' : '');
  } else {
    const waiting = m.isTyping && !m.text;
    d.innerHTML =
      (waiting ? '<div class="status">' + esc(m.status || THINKING) + '</div>' : '') +
      (m.text ? '<div class="md">' + md(m.text) + '</div>' : '') +
      (m.people && m.people.length ? '<div class="cards">' + m.people.map(cardHtml).join('') + '</div>' : '') +
      imagesHtml(m.images) +
      sourcesHtml(m.sources);
  }
  return d;
}

function typingIndex() {
  return msgs.map(x => x.isTyping).lastIndexOf(true);
}

function scrollEnd() {
  scrollEl.scrollTop = scrollEl.scrollHeight;
}

function greet() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = profile.fullName.trim().split(/\s+/)[0];
  greetEl.textContent = first ? g + ', ' + first : g;
}

function syncEmpty() {
  empty.hidden = msgs.length > 0;
  if (!msgs.length) greet();
}

function renderAll() {
  list.innerHTML = '';
  msgs.forEach(m => list.appendChild(node(m)));
  syncEmpty();
}

function refresh(m) {
  const i = msgs.indexOf(m);
  if (i >= 0 && list.children[i]) list.replaceChild(node(m), list.children[i]);
}

function push() {
  lastPush = performance.now();
  const i = typingIndex();
  if (i < 0) return;
  const s = splitSources(stripImages(buf));
  msgs[i] = Object.assign({}, msgs[i], { text: s.body, status, sources: s.sources });
  list.replaceChild(node(msgs[i]), list.children[i]);
  if (stick) scrollEnd();
}

function schedule() {
  const wait = 40 - (performance.now() - lastPush);
  if (wait <= 0) {
    clearTimeout(pushTimer);
    pushTimer = null;
    push();
  } else if (!pushTimer) {
    pushTimer = setTimeout(() => {
      pushTimer = null;
      push();
    }, wait);
  }
}

function cancelPush() {
  clearTimeout(pushTimer);
  pushTimer = null;
}

function finish(text, people, inHistory, images) {
  const s = splitSources(stripImages(text));
  const m = { text: s.body, isUser: false, isTyping: false, inHistory, people, sources: s.sources, images, status: '' };
  const i = typingIndex();
  if (i < 0) {
    msgs.push(m);
    list.appendChild(node(m));
  } else {
    msgs[i] = m;
    list.replaceChild(node(m), list.children[i]);
  }
}

function removeTyping() {
  const i = typingIndex();
  if (i >= 0) {
    msgs.splice(i, 1);
    list.children[i].remove();
  }
  syncEmpty();
}

function history() {
  return msgs.filter(m => m.inHistory && !m.isTyping && m.text).slice(-HISTORY);
}

const clean = m => ({
  text: m.text,
  isUser: m.isUser,
  inHistory: m.inHistory,
  people: m.people || [],
  sources: m.sources || [],
  images: (m.images || []).filter(u => /^https?:/.test(u))
});

function persist() {
  const snap = msgs.filter(m => !m.isTyping).map(clean);
  const first = snap.find(m => m.isUser);
  if (!first) return;
  if (!cur) {
    const label = first.text || 'Photo';
    cur = { id: uid(), title: label.length > 40 ? label.slice(0, 40) + '…' : label, updatedAt: Date.now(), messages: snap };
    sessions.push(cur);
  }
  cur.messages = snap;
  cur.updatedAt = Date.now();
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  while (sessions.length > MAX_CHATS) sessions.pop();
  write('durbar_ai_chats', sessions);
  renderHistory();
}

function renderHistory() {
  hist.innerHTML = sessions.map(s =>
    '<div class="hi' + (cur && cur.id === s.id ? ' on' : '') + '" data-id="' + esc(s.id) + '">' +
    '<div><b>' + esc(s.title || 'New chat') + '</b><small>' + fmt(s.updatedAt) + '</small></div>' +
    '<button type="button" data-del="' + esc(s.id) + '" aria-label="Delete chat">' + icon('trash') + '</button></div>'
  ).join('');
  histEmpty.hidden = sessions.length > 0;
}

function openDrawer() {
  renderHistory();
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  scrim.hidden = false;
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  scrim.hidden = true;
}

function openSession(id) {
  if (sending) return toast('Please wait for the reply');
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  cur = s;
  msgs = s.messages.map(m => Object.assign({ isTyping: false, status: '' }, m));
  renderAll();
  scrollEnd();
  closeDrawer();
  renderHistory();
}

function deleteSession(id) {
  if (sending && cur && cur.id === id) return toast('Please wait for the reply');
  sessions = sessions.filter(s => s.id !== id);
  if (cur && cur.id === id) {
    cur = null;
    msgs = [];
    renderAll();
  }
  write('durbar_ai_chats', sessions);
  renderHistory();
}

function newChat() {
  if (sending) return toast('Please wait for the reply');
  cur = null;
  msgs = [];
  renderAll();
  renderHistory();
  closeDrawer();
}

function grow() {
  q.style.height = 'auto';
  q.style.height = Math.min(q.scrollHeight, 140) + 'px';
}

function setSend(name, label, dim) {
  send.innerHTML = icon(name);
  send.setAttribute('aria-label', label);
  send.classList.toggle('dim', dim);
}

function actions() {
  const blank = !q.value.trim() && !pending.length;
  const focused = bar.matches(':focus-within');
  bar.classList.toggle('sending', sending);
  if (sending) setSend('stop', 'Stop', false);
  else if (focused) setSend('send', 'Send', blank);
  else if (blank) setSend('mic', 'Voice input', false);
  else setSend('send', 'Send', false);
}

function setSending(v) {
  sending = v;
  actions();
}

function updateChip() {
  const m = models.find(x => x.id === modelId);
  chip.textContent = (m ? m.label : 'Durbar Ai') + ' ▾';
}

function saveModel() {
  if (modelId) write('durbar_ai_model', modelId);
}

function adopt(id) {
  if (id && id !== modelId && models.some(m => m.id === id)) {
    modelId = id;
    saveModel();
    updateChip();
  }
}

async function loadModels(openAfter) {
  if (modelsLoading) return;
  modelsLoading = true;
  try {
    const r = await fetch(API + '/models');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    models = (j.models || []).filter(m => m && m.id).map(m => ({
      id: m.id,
      label: m.label || m.id,
      provider: m.provider || '',
      description: m.description || ''
    }));
    modelId = models.some(m => m.id === modelId)
      ? modelId
      : models.some(m => m.id === j.default)
        ? j.default
        : models[0] ? models[0].id : null;
    saveModel();
  } catch (e) {
    if (openAfter) toast("Couldn't load models. Check your connection.");
  } finally {
    modelsLoading = false;
    updateChip();
  }
  if (openAfter && models.length) showPicker();
}

function showPicker() {
  ModelsSheet.open({
    models,
    selectedId: modelId,
    onSelect: m => {
      modelId = m.id;
      saveModel();
      updateChip();
    }
  });
}

function openModelSelector() {
  if (models.length) showPicker();
  else if (modelsLoading) toast('Loading models…');
  else loadModels(true);
}

function addFiles(files) {
  const picked = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!picked.length) return;
  let added = 0;
  for (const f of picked) {
    if (pending.length >= MAX_IMG) break;
    pending.push({ file: f, url: URL.createObjectURL(f) });
    added++;
  }
  if (added < picked.length) toast('Up to ' + MAX_IMG + ' photos per message');
  renderStrip();
}

function renderStrip() {
  strip.innerHTML = pending.map((p, i) =>
    '<div class="th"><div class="c" style="background-image:url(\'' + p.url + '\')"></div>' +
    '<button type="button" data-rm="' + i + '" aria-label="Remove photo">' + icon('close') + '</button></div>'
  ).join('');
  strip.hidden = !pending.length;
  actions();
}

async function prepare(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  let quality = 0.9;
  let blob;
  do {
    blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
    quality -= 0.15;
  } while (blob && blob.size > 3000000 && quality > 0.3);
  if (!blob) throw new Error('image error');
  return blob;
}

async function upload(file, signal) {
  const blob = await prepare(file);
  const fd = new FormData();
  fd.append('image', blob, 'photo.jpg');
  const r = await fetch(IMGBB_URL + '?key=' + IMGBB_KEY, { method: 'POST', body: fd, signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const url = j && j.data && j.data.url;
  if (!url) throw new Error('bad response');
  return url;
}

function buildBody(text, hist, images) {
  const body = {
    message: text,
    history: hist.map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.text }))
  };
  if (images.length) {
    body.image = images[0];
    body.images = images;
  }
  if (profile.fullName || profile.classLevel || profile.section) {
    body.user = { fullName: profile.fullName, role: profile.role, classLevel: profile.classLevel, section: profile.section };
  }
  return body;
}

function parsePeople(cards) {
  if (!cards || cards.type !== 'people' || !Array.isArray(cards.people)) return [];
  return cards.people.map(p => ({
    uid: p.uid || '',
    name: p.name || '',
    role: p.role || '',
    subject: p.subject || '',
    classLevel: p.class_level || '',
    section: p.section || '',
    photoUrl: p.photo_url || '',
    verified: !!p.verified
  }));
}

async function streamChat(body, mid, signal, onEvent) {
  for (const model of [mid, null]) {
    const payload = Object.assign({}, body);
    if (model) payload.model = model;
    const r = await fetch(API + '/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal
    });
    if (!r.ok) {
      let msg = '';
      try {
        msg = (await r.json()).error || '';
      } catch (e) {}
      if (r.status === 400 && model) continue;
      const err = new Error(msg || 'HTTP ' + r.status);
      err.code = r.status;
      throw err;
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let acc = '';
    let fin = false;
    const handle = block => {
      const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).replace(/^ /, '')).join('\n');
      if (!data) return;
      let ev;
      try {
        ev = JSON.parse(data);
      } catch (e) {
        return;
      }
      if (onEvent(ev)) fin = true;
    };
    while (!fin) {
      const chunk = await reader.read();
      if (chunk.done) break;
      acc += dec.decode(chunk.value, { stream: true });
      let k;
      while (!fin && (k = acc.search(/\r?\n\r?\n/)) >= 0) {
        const block = acc.slice(0, k);
        acc = acc.slice(k).replace(/^\r?\n\r?\n/, '');
        handle(block);
      }
    }
    if (!fin && acc.trim()) handle(acc);
    try {
      reader.cancel();
    } catch (e) {}
    if (!fin) throw new Error('Stream ended early');
    return;
  }
}

async function sendMessage() {
  const text = q.value.trim();
  const picked = pending.slice();
  if ((!text && !picked.length) || sending) return;

  setSending(true);
  const prior = history();
  const user = { text, isUser: true, inHistory: true, people: [], sources: [], images: picked.map(p => p.url) };
  msgs.push(user);
  list.appendChild(node(user));
  q.value = '';
  grow();
  pending = [];
  renderStrip();
  persist();

  const first = picked.length ? UPLOADING : THINKING;
  const bot = { text: '', isUser: false, isTyping: true, inHistory: false, status: first, people: [], sources: [], images: [] };
  msgs.push(bot);
  list.appendChild(node(bot));
  buf = '';
  status = first;
  lastPush = 0;
  stick = true;
  syncEmpty();
  scrollEnd();

  ctrl = new AbortController();
  let finished = false;
  let stopped = false;
  let failure = null;
  let remote = [];

  try {
    if (picked.length) {
      try {
        remote = await Promise.all(picked.map(p => upload(p.file, ctrl.signal)));
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        failure = UPLOAD_ERROR + (e.message ? '\n\n(' + e.message + ')' : '');
      }
      if (!failure) {
        picked.forEach(p => URL.revokeObjectURL(p.url));
        user.images = remote;
        refresh(user);
        status = THINKING;
        push();
      }
    }

    if (!failure) {
      await streamChat(buildBody(text, prior, remote), modelId, ctrl.signal, ev => {
        switch (ev.type) {
          case 'start':
            adopt(ev.model);
            return false;
          case 'delta':
            if (ev.text) {
              buf += ev.text;
              schedule();
            }
            return false;
          case 'status':
            status = ev.text || WORKING;
            push();
            return false;
          case 'reset':
            buf = '';
            push();
            return false;
          case 'done': {
            adopt(ev.model);
            const people = parsePeople(ev.cards);
            const images = (ev.images || []).map(x => x && x.url).filter(u => u && u.startsWith('http'));
            const finalText = (ev.reply || '').trim() || buf.trim();
            if (finalText || people.length || images.length) {
              cancelPush();
              finished = true;
              finish(finalText, people, true, images);
              return true;
            }
            return false;
          }
          case 'error':
            failure = ev.error || STREAM_ERROR;
            return true;
          default:
            return false;
        }
      });
    }
  } catch (e) {
    if (e.name === 'AbortError') stopped = true;
    else if (e.code === 429) failure = e.message;
  }

  cancelPush();
  if (!finished) {
    const partial = buf.trim();
    if (stopped) {
      if (!partial) {
        user.inHistory = false;
        removeTyping();
      } else {
        finish(partial, [], true, []);
      }
    } else {
      user.inHistory = false;
      const note = failure || GENERIC_ERROR;
      finish(partial ? partial + '\n\n_' + note + '_' : note, [], false, []);
    }
  }
  persist();
  if (stick) scrollEnd();
  ctrl = null;
  setSending(false);
}

function voice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast("Voice input isn't available on this browser");
  const r = new Recognition();
  r.lang = navigator.language || 'en-US';
  r.interimResults = false;
  r.onresult = e => {
    const spoken = e.results[0][0].transcript.trim();
    if (spoken) {
      q.value = q.value.trim() ? q.value.trimEnd() + ' ' + spoken : spoken;
      grow();
      actions();
      q.focus();
    }
  };
  r.onerror = () => toast("Couldn't hear you. Try again.");
  try {
    r.start();
  } catch (e) {}
}

function loadProfile() {
  if (typeof auth === 'undefined' || typeof db === 'undefined') return;
  auth.onAuthStateChanged(user => {
    if (!user) return;
    const fallback = user.displayName || '';
    if (!profile.fullName && fallback) {
      profile.fullName = fallback;
      greet();
    }
    db.ref('users').child(user.uid).once('value').then(snap => {
      const u = snap.val() || {};
      profile = {
        fullName: typeof u.fullName === 'string' && u.fullName.trim() ? u.fullName.trim() : fallback,
        role: typeof u.role === 'string' && u.role ? u.role : 'student',
        classLevel: u.classLevel != null ? String(u.classLevel).trim() : '',
        section: typeof u.section === 'string' ? u.section.trim() : ''
      };
      write('durbar_ai_user', profile);
      greet();
    }).catch(() => {});
  });
}

function openLightbox(url) {
  lbImg.src = url;
  lbDl.href = url;
  lb.hidden = false;
}

function closeLightbox() {
  lb.hidden = true;
  lbImg.removeAttribute('src');
}

bar.addEventListener('submit', e => {
  e.preventDefault();
  if (sending) {
    if (ctrl) ctrl.abort();
    return;
  }
  if (!q.value.trim() && !pending.length) {
    if (!bar.matches(':focus-within')) voice();
    return;
  }
  sendMessage();
});

bar.addEventListener('mousedown', e => {
  if (document.activeElement === q && e.target.closest('#chip,#mic,#send,#plus')) e.preventDefault();
});
bar.addEventListener('focusin', actions);
bar.addEventListener('focusout', () => setTimeout(actions, 0));

q.addEventListener('input', () => {
  grow();
  actions();
});
q.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(hover:hover)').matches) {
    e.preventDefault();
    bar.requestSubmit();
  }
});
q.addEventListener('paste', e => {
  const files = e.clipboardData && e.clipboardData.files;
  if (files && files.length) {
    e.preventDefault();
    addFiles(files);
  }
});

mic.addEventListener('click', voice);
chip.addEventListener('click', openModelSelector);
plus.addEventListener('click', () => {
  if (pending.length >= MAX_IMG) return toast('You can add up to ' + MAX_IMG + ' photos');
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});
strip.addEventListener('click', e => {
  const b = e.target.closest('[data-rm]');
  if (!b) return;
  const [removed] = pending.splice(Number(b.dataset.rm), 1);
  if (removed) URL.revokeObjectURL(removed.url);
  renderStrip();
});

list.addEventListener('click', e => {
  const copy = e.target.closest('.cp');
  if (copy) {
    const code = copy.closest('.code').querySelector('code').textContent;
    const done = () => {
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => toast("Couldn't copy"));
    return;
  }
  const img = e.target.closest('[data-img]');
  if (img) {
    const i = Array.prototype.indexOf.call(list.children, img.closest('.m'));
    const urls = msgs[i] && msgs[i].images;
    if (urls && urls[Number(img.dataset.img)]) openLightbox(urls[Number(img.dataset.img)]);
  }
});

scrollEl.addEventListener('scroll', () => {
  stick = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 60;
});

$('#menu').addEventListener('click', openDrawer);
$('#newTop').addEventListener('click', newChat);
$('#newSide').addEventListener('click', newChat);
scrim.addEventListener('click', closeDrawer);
hist.addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) return deleteSession(del.dataset.del);
  const row = e.target.closest('.hi');
  if (row) openSession(row.dataset.id);
});

$('#lbClose').addEventListener('click', closeLightbox);
$('#lbShare').addEventListener('click', () => {
  const url = lbImg.src;
  if (navigator.share) navigator.share({ url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied'));
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!lb.hidden) closeLightbox();
  else if (drawer.classList.contains('open')) closeDrawer();
});

renderHistory();
greet();
updateChip();
syncEmpty();
actions();
loadModels(false);
loadProfile();