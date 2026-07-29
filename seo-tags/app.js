const inputEl   = document.getElementById('input');
const baseUrlEl = document.getElementById('baseUrl');
const sampleBtn = document.getElementById('sampleBtn');
const copyBtn   = document.getElementById('copyBtn');
const emptyEl   = document.getElementById('empty');
const resultEl  = document.getElementById('result');
const checksEl  = document.getElementById('checks');
const tagsEl    = document.getElementById('tags');

const el = (id) => document.getElementById(id);

const LIMITS = {
  title: { min: 30, max: 60 },
  description: { min: 70, max: 160 },
};

const SAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Client-side Web Tools — compress, convert, decode in your browser</title>
  <meta name="description" content="A collection of small, fast web tools that run entirely in your browser. Compress images, decode JWTs, format JSON and more — nothing is ever uploaded.">
  <link rel="canonical" href="https://example.com/">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Webtools">
  <meta property="og:title" content="Client-side Web Tools">
  <meta property="og:description" content="Compress images, decode JWTs, format JSON and more — all in your browser.">
  <meta property="og:url" content="https://example.com/">
  <meta property="og:image" content="https://example.com/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@example">
  <meta name="twitter:title" content="Client-side Web Tools">
  <meta name="twitter:description" content="Compress images, decode JWTs, format JSON and more.">
  <meta name="twitter:image" content="https://example.com/og.png">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Webtools","url":"https://example.com/"}</script>
</head>
<body></body>
</html>`;

/* ---------- parsing ---------- */

function resolveUrl(value, base) {
  if (!value) return value;
  try {
    return new URL(value, base || undefined).href;
  } catch {
    return value;
  }
}

function parse(html, base) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const metas = [];
  const og = {};
  const twitter = {};
  const named = {};

  for (const tag of doc.querySelectorAll('meta')) {
    const name = tag.getAttribute('name') || tag.getAttribute('property') || tag.getAttribute('http-equiv');
    const content = tag.getAttribute('content') ?? '';
    if (tag.hasAttribute('charset')) {
      metas.push({ key: 'charset', value: tag.getAttribute('charset') });
      named.charset = tag.getAttribute('charset');
      continue;
    }
    if (!name) continue;
    const key = name.toLowerCase();
    metas.push({ key, value: content });
    if (key.startsWith('og:') || key.startsWith('article:') || key.startsWith('product:')) og[key] = content;
    else if (key.startsWith('twitter:')) twitter[key] = content;
    else named[key] = content;
  }

  const links = [...doc.querySelectorAll('link[rel]')].map((tag) => ({
    rel: tag.getAttribute('rel').toLowerCase(),
    href: resolveUrl(tag.getAttribute('href'), base),
    hreflang: tag.getAttribute('hreflang'),
  }));

  const jsonLd = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = script.textContent.trim();
    if (!raw) continue;
    try {
      jsonLd.push({ ok: true, text: JSON.stringify(JSON.parse(raw), null, 2) });
    } catch (err) {
      jsonLd.push({ ok: false, text: raw, error: err.message });
    }
  }

  const headings = [...doc.querySelectorAll('h1')].map((h) => h.textContent.trim()).filter(Boolean);
  const images = [...doc.querySelectorAll('img')];

  return {
    title: doc.querySelector('title')?.textContent.trim() ?? '',
    lang: doc.documentElement.getAttribute('lang') || '',
    metas,
    og,
    twitter,
    named,
    links,
    jsonLd,
    headings,
    imageCount: images.length,
    imagesMissingAlt: images.filter((img) => !img.getAttribute('alt')).length,
    canonical: links.find((l) => l.rel.split(/\s+/).includes('canonical'))?.href ?? '',
    hreflang: links.filter((l) => l.rel.split(/\s+/).includes('alternate') && l.hreflang),
  };
}

/* ---------- checks ---------- */

function lengthCheck(label, value, { min, max }) {
  if (!value) return { level: 'fail', label, detail: 'Missing.' };
  const n = value.length;
  const detail = `${n} characters — "${value}"`;
  if (n < min) return { level: 'warn', label, detail: `Short (${n} chars, aim for ${min}–${max}). "${value}"` };
  if (n > max) return { level: 'warn', label, detail: `Long (${n} chars, may be truncated above ${max}). "${value}"` };
  return { level: 'ok', label, detail };
}

function buildChecks(data, base) {
  const checks = [];
  const { og, twitter, named } = data;

  checks.push(lengthCheck('Title', data.title, LIMITS.title));
  checks.push(lengthCheck('Meta description', named.description || '', LIMITS.description));

  checks.push(data.canonical
    ? { level: 'ok', label: 'Canonical', detail: data.canonical }
    : { level: 'warn', label: 'Canonical', detail: 'No <link rel="canonical"> — duplicate URLs may compete.' });

  const robots = named.robots || '';
  if (/noindex/i.test(robots)) checks.push({ level: 'fail', label: 'Robots', detail: `noindex present: "${robots}" — this page will not be indexed.` });
  else if (robots) checks.push({ level: 'ok', label: 'Robots', detail: robots });
  else checks.push({ level: 'ok', label: 'Robots', detail: 'No robots meta — defaults to index, follow.' });

  checks.push(named.viewport
    ? { level: 'ok', label: 'Viewport', detail: named.viewport }
    : { level: 'fail', label: 'Viewport', detail: 'Missing — required for mobile-friendliness.' });

  checks.push(named.charset
    ? { level: 'ok', label: 'Charset', detail: named.charset }
    : { level: 'warn', label: 'Charset', detail: 'No <meta charset> found.' });

  checks.push(data.lang
    ? { level: 'ok', label: 'html lang', detail: data.lang }
    : { level: 'warn', label: 'html lang', detail: 'Missing lang attribute on <html>.' });

  // Open Graph
  for (const [key, label] of [['og:title', 'og:title'], ['og:description', 'og:description'], ['og:image', 'og:image'], ['og:url', 'og:url'], ['og:type', 'og:type']]) {
    const required = key !== 'og:type' && key !== 'og:description';
    checks.push(og[key]
      ? { level: 'ok', label, detail: og[key] }
      : { level: required ? 'fail' : 'warn', label, detail: 'Missing — link previews will fall back to page content.' });
  }
  if (og['og:image'] && !/^https?:/i.test(resolveUrl(og['og:image'], base))) {
    checks.push({ level: 'fail', label: 'og:image URL', detail: 'Not an absolute http(s) URL — most crawlers will not resolve it.' });
  }

  // Twitter
  const card = twitter['twitter:card'];
  if (!card) {
    checks.push({ level: 'warn', label: 'twitter:card', detail: 'Missing — X falls back to Open Graph, but summary_large_image is recommended.' });
  } else if (!['summary', 'summary_large_image', 'app', 'player'].includes(card)) {
    checks.push({ level: 'fail', label: 'twitter:card', detail: `Unknown card type "${card}".` });
  } else {
    checks.push({ level: 'ok', label: 'twitter:card', detail: card });
  }
  if (!twitter['twitter:image'] && !og['og:image']) {
    checks.push({ level: 'warn', label: 'twitter:image', detail: 'No twitter:image and no og:image to fall back on.' });
  }
  if (twitter['twitter:site'] && !twitter['twitter:site'].startsWith('@')) {
    checks.push({ level: 'warn', label: 'twitter:site', detail: `Should start with "@" — got "${twitter['twitter:site']}".` });
  }

  // Structured data
  const bad = data.jsonLd.filter((b) => !b.ok);
  if (!data.jsonLd.length) checks.push({ level: 'warn', label: 'JSON-LD', detail: 'No structured data found.' });
  else if (bad.length) checks.push({ level: 'fail', label: 'JSON-LD', detail: `${bad.length} of ${data.jsonLd.length} block(s) failed to parse: ${bad[0].error}` });
  else checks.push({ level: 'ok', label: 'JSON-LD', detail: `${data.jsonLd.length} valid block(s).` });

  // Content
  if (data.headings.length === 1) checks.push({ level: 'ok', label: 'H1', detail: data.headings[0] });
  else if (!data.headings.length) checks.push({ level: 'warn', label: 'H1', detail: 'No <h1> found (may be rendered by JavaScript).' });
  else checks.push({ level: 'warn', label: 'H1', detail: `${data.headings.length} <h1> elements — prefer exactly one.` });

  if (data.imagesMissingAlt) {
    checks.push({ level: 'warn', label: 'Image alt text', detail: `${data.imagesMissingAlt} of ${data.imageCount} <img> without alt.` });
  }

  if (data.hreflang.length) {
    const hasSelf = data.hreflang.some((l) => l.hreflang.toLowerCase() === 'x-default') || data.hreflang.length > 1;
    checks.push({ level: hasSelf ? 'ok' : 'warn', label: 'hreflang', detail: data.hreflang.map((l) => `${l.hreflang} → ${l.href}`).join(', ') });
  }

  return checks;
}

/* ---------- rendering ---------- */

const ICONS = { ok: '✓', warn: '!', fail: '✕' };

function renderChecks(checks) {
  checksEl.textContent = '';
  const order = { fail: 0, warn: 1, ok: 2 };
  for (const check of [...checks].sort((a, b) => order[a.level] - order[b.level])) {
    const row = document.createElement('div');
    row.className = `check check--${check.level}`;
    const icon = document.createElement('span');
    icon.className = 'check__icon';
    icon.textContent = ICONS[check.level];
    const body = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'check__label';
    label.textContent = check.label;
    const detail = document.createElement('div');
    detail.className = 'check__detail';
    detail.textContent = check.detail;
    body.append(label, detail);
    row.append(icon, body);
    checksEl.append(row);
  }
}

function setImage(node, url, fallback) {
  node.textContent = '';
  if (!url) {
    node.textContent = fallback;
    return;
  }
  const img = document.createElement('img');
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => {
    node.textContent = 'Image failed to load';
  });
  img.src = url;
  node.append(img);
}

function renderPreviews(data, base) {
  const { og, twitter, named } = data;
  const pageUrl = data.canonical || og['og:url'] || base || 'https://example.com/page';
  let host = pageUrl;
  try { host = new URL(pageUrl).host + new URL(pageUrl).pathname.replace(/\/$/, ''); } catch {}

  el('serpUrl').textContent = host;
  el('serpTitle').textContent = data.title || '(no title)';
  el('serpDesc').textContent = named.description || '(no meta description — Google will pick text from the page)';

  el('ogSite').textContent = og['og:site_name'] || host;
  el('ogTitle').textContent = og['og:title'] || data.title || '(no title)';
  el('ogDesc').textContent = og['og:description'] || named.description || '';
  setImage(el('ogImage'), resolveUrl(og['og:image'], base), 'No og:image');

  const twImage = twitter['twitter:image'] || og['og:image'];
  el('twTitle').textContent = twitter['twitter:title'] || og['og:title'] || data.title || '(no title)';
  el('twDesc').textContent = twitter['twitter:description'] || og['og:description'] || named.description || '';
  el('twSite').textContent = twitter['twitter:site'] || host;
  setImage(el('twImage'), resolveUrl(twImage, base), 'No twitter:image');
}

function renderTable(title, rows) {
  if (!rows.length) return null;
  const group = document.createElement('div');
  group.className = 'group';
  const heading = document.createElement('div');
  heading.className = 'group__title';
  heading.textContent = title;
  const table = document.createElement('table');
  table.className = 'tag-table';
  for (const [key, value] of rows) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = key;
    const td = document.createElement('td');
    td.textContent = value || '(empty)';
    tr.append(th, td);
    table.append(tr);
  }
  group.append(heading, table);
  return group;
}

function renderTags(data) {
  tagsEl.textContent = '';
  const groups = [
    renderTable('Basic', [
      ['<title>', data.title],
      ['html lang', data.lang],
      ...Object.entries(data.named),
    ]),
    renderTable('Open Graph', Object.entries(data.og)),
    renderTable('Twitter Card', Object.entries(data.twitter)),
    renderTable('Links', data.links.map((l) => [l.hreflang ? `${l.rel} (${l.hreflang})` : l.rel, l.href || ''])),
  ].filter(Boolean);
  tagsEl.append(...groups);

  if (data.jsonLd.length) {
    const group = document.createElement('div');
    group.className = 'group';
    const heading = document.createElement('div');
    heading.className = 'group__title';
    heading.textContent = 'JSON-LD';
    group.append(heading);
    for (const block of data.jsonLd) {
      const pre = document.createElement('pre');
      pre.className = 'jsonld';
      pre.textContent = block.ok ? block.text : `Invalid JSON (${block.error})\n\n${block.text}`;
      group.append(pre);
    }
    tagsEl.append(group);
  }
}

/* ---------- wiring ---------- */

let current = null;

function run() {
  const html = inputEl.value.trim();
  if (!html) {
    current = null;
    resultEl.hidden = true;
    emptyEl.hidden = false;
    return;
  }
  const base = baseUrlEl.value.trim();
  const data = parse(html, base);
  current = data;
  renderChecks(buildChecks(data, base));
  renderPreviews(data, base);
  renderTags(data);
  emptyEl.hidden = true;
  resultEl.hidden = false;
}

let timer;
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(run, 150);
};

inputEl.addEventListener('input', schedule);
baseUrlEl.addEventListener('input', schedule);

sampleBtn.addEventListener('click', () => {
  inputEl.value = SAMPLE;
  baseUrlEl.value = 'https://example.com/';
  run();
});

copyBtn.addEventListener('click', async () => {
  if (!current) return;
  const payload = {
    title: current.title,
    lang: current.lang,
    canonical: current.canonical,
    meta: current.named,
    openGraph: current.og,
    twitter: current.twitter,
    links: current.links,
    jsonLd: current.jsonLd.map((b) => b.text),
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    copyBtn.textContent = 'Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy as JSON'; }, 1200);
  } catch {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => { copyBtn.textContent = 'Copy as JSON'; }, 1200);
  }
});
