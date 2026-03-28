# Image Compression Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side image compression tool (JPEG/PNG input, optional WebP output) with quality slider, max width input, batch upload, per-file stats, and zip download.

**Architecture:** Three static files — `index.html`, `style.css`, `app.js` — with no build step. `browser-image-compression` handles compression via web worker; `JSZip` handles batch zip download. All state lives in a plain JS array in `app.js`.

**Tech Stack:** Vanilla HTML/CSS/JS, browser-image-compression 2.x (CDN), JSZip 3.x (CDN)

---

### Task 1: HTML skeleton

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html` with full markup**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Image Compressor</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <header class="header">
      <h1>Image Compressor</h1>
      <p class="subtitle">Compress JPEG &amp; PNG files in your browser. Nothing is uploaded.</p>
    </header>

    <section class="dropzone" id="dropzone" role="button" tabindex="0" aria-label="Drop images here or click to browse">
      <div class="dropzone__inner">
        <svg class="dropzone__icon" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p class="dropzone__text">Drop images here or <span class="dropzone__browse">browse</span></p>
        <p class="dropzone__hint">JPEG and PNG supported</p>
      </div>
      <input type="file" id="fileInput" accept="image/jpeg,image/png" multiple hidden />
    </section>

    <section class="controls" id="controls">
      <div class="control-group">
        <label for="quality" class="control-label">
          Quality
          <span class="control-value" id="qualityValue">80</span>
        </label>
        <input type="range" id="quality" min="1" max="100" value="80" class="slider" />
      </div>
      <div class="control-group">
        <label for="maxWidth" class="control-label">Max width (px)</label>
        <input type="number" id="maxWidth" min="1" placeholder="No limit" class="number-input" />
      </div>
      <div class="control-group control-group--inline">
        <label for="convertWebp" class="control-label">Convert to WebP</label>
        <input type="checkbox" id="convertWebp" class="toggle" />
      </div>
    </section>

    <section class="queue" id="queue" hidden>
      <div class="queue__list" id="queueList"></div>
      <div class="queue__actions">
        <button class="btn btn--secondary" id="clearAll">Clear all</button>
        <button class="btn btn--primary" id="downloadAll">Download all as ZIP</button>
      </div>
    </section>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `index.html` in a browser. Should show header, drop zone, controls, and no queue section (it's hidden). No JS errors in console.

- [ ] **Step 3: Commit**

```bash
git init
git add index.html
git commit -m "feat: add HTML skeleton"
```

---

### Task 2: CSS styling

**Files:**
- Create: `style.css`

- [ ] **Step 1: Create `style.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0f0f11;
  --surface: #1a1a1f;
  --surface2: #242429;
  --border: #2e2e36;
  --accent: #6c63ff;
  --accent-hover: #7d75ff;
  --text: #e8e8f0;
  --text-muted: #888896;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --radius: 12px;
  --radius-sm: 6px;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
}

.app {
  max-width: 860px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

/* Header */
.header { text-align: center; margin-bottom: 40px; }
.header h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
.subtitle { color: var(--text-muted); margin-top: 8px; }

/* Drop zone */
.dropzone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 56px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  outline: none;
}
.dropzone:hover, .dropzone:focus { border-color: var(--accent); background: var(--surface2); }
.dropzone.dragover { border-color: var(--accent); background: var(--surface2); }
.dropzone__icon { color: var(--text-muted); margin: 0 auto 16px; display: block; }
.dropzone__text { font-size: 1rem; color: var(--text); }
.dropzone__browse { color: var(--accent); text-decoration: underline; }
.dropzone__hint { color: var(--text-muted); font-size: 12px; margin-top: 6px; }

/* Controls */
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 28px;
  padding: 20px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  align-items: center;
}

.control-group { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 140px; }
.control-group--inline { flex-direction: row; align-items: center; gap: 12px; flex: 0; min-width: unset; }

.control-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-value {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 20px;
  font-weight: 700;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: background 0.15s;
}
.slider::-webkit-slider-thumb:hover { background: var(--accent-hover); }
.slider::-moz-range-thumb {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  cursor: pointer;
}

.number-input {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 14px;
  padding: 8px 12px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;
}
.number-input:focus { border-color: var(--accent); }
.number-input::placeholder { color: var(--text-muted); }

.toggle {
  -webkit-appearance: none;
  appearance: none;
  width: 40px; height: 22px;
  background: var(--border);
  border-radius: 11px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle::after {
  content: '';
  position: absolute;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  top: 3px; left: 3px;
  transition: left 0.2s;
}
.toggle:checked { background: var(--accent); }
.toggle:checked::after { left: 21px; }

/* Queue */
.queue { margin-top: 32px; }
.queue__list { display: flex; flex-direction: column; gap: 12px; }
.queue__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

/* Card */
.card {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.15s;
}
.card--error { border-color: var(--error); }
.card--warning { border-color: var(--warning); }

.card__thumb {
  width: 64px; height: 64px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--surface2);
  display: block;
}
.card__thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.card__info { min-width: 0; }
.card__name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}
.card__meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.card__size { color: var(--text-muted); font-size: 13px; }
.card__arrow { color: var(--text-muted); }
.card__size--new { color: var(--text); font-size: 13px; font-weight: 600; }
.card__savings {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}
.card__savings--good { background: rgba(34,197,94,0.15); color: var(--success); }
.card__savings--warn { background: rgba(245,158,11,0.15); color: var(--warning); }
.card__status { font-size: 13px; color: var(--text-muted); }
.card__error { font-size: 13px; color: var(--error); }

.card__actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }

/* Spinner */
.spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.btn--primary { background: var(--accent); color: #fff; }
.btn--primary:hover { background: var(--accent-hover); }
.btn--secondary { background: transparent; color: var(--text-muted); border-color: var(--border); }
.btn--secondary:hover { color: var(--text); border-color: var(--text-muted); }
.btn--sm { padding: 6px 12px; font-size: 13px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 2: Verify in browser**

Reload `index.html`. Should show dark-themed app with styled header, drop zone, and controls. Layout looks clean, no broken styles.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add CSS styling"
```

---

### Task 3: App state and file ingestion

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create `app.js` with state and file ingestion**

```js
// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  files: [],          // Array of FileEntry objects (see below)
  nextId: 0,
};

// FileEntry shape:
// {
//   id: number,
//   originalFile: File,
//   originalSize: number,       // bytes
//   compressedBlob: Blob|null,
//   compressedSize: number|null,
//   status: 'pending'|'compressing'|'done'|'error'|'unsupported',
//   errorMessage: string|null,
//   usedOriginal: boolean,      // true when compressed >= original
// }

function createEntry(file) {
  return {
    id: state.nextId++,
    originalFile: file,
    originalSize: file.size,
    compressedBlob: null,
    compressedSize: null,
    status: 'pending',
    errorMessage: null,
    usedOriginal: false,
  };
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('fileInput');
const queueEl     = document.getElementById('queue');
const queueList   = document.getElementById('queueList');
const quality     = document.getElementById('quality');
const qualityVal  = document.getElementById('qualityValue');
const maxWidthEl  = document.getElementById('maxWidth');
const convertWebp = document.getElementById('convertWebp');
const downloadAll = document.getElementById('downloadAll');
const clearAllBtn = document.getElementById('clearAll');

// ─── Drop zone ────────────────────────────────────────────────────────────────

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  ingestFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener('change', () => {
  ingestFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

// ─── Ingest ───────────────────────────────────────────────────────────────────

const SUPPORTED = ['image/jpeg', 'image/png'];

function ingestFiles(files) {
  const entries = files.map(f => {
    const entry = createEntry(f);
    if (!SUPPORTED.includes(f.type)) {
      entry.status = 'unsupported';
      entry.errorMessage = 'Unsupported format';
    }
    return entry;
  });

  state.files.push(...entries);
  renderQueue();

  const toCompress = entries.filter(e => e.status === 'pending');
  if (toCompress.length) compressBatch(toCompress);
}

// ─── Controls ────────────────────────────────────────────────────────────────

quality.addEventListener('input', () => {
  qualityVal.textContent = quality.value;
});

quality.addEventListener('change', recompressAll);
convertWebp.addEventListener('change', recompressAll);
maxWidthEl.addEventListener('change', recompressAll);

function getOptions() {
  const q = parseInt(quality.value, 10) / 100;
  const mw = parseInt(maxWidthEl.value, 10);
  const webp = convertWebp.checked;
  return {
    initialQuality: q,
    maxWidthOrHeight: (mw > 0) ? mw : undefined,
    fileType: webp ? 'image/webp' : undefined,
    useWebWorker: true,
  };
}

function recompressAll() {
  const eligible = state.files.filter(e => e.status === 'done' || e.status === 'error' || e.status === 'pending');
  eligible.forEach(e => {
    e.status = 'pending';
    e.compressedBlob = null;
    e.compressedSize = null;
    e.usedOriginal = false;
    e.errorMessage = null;
  });
  renderQueue();
  if (eligible.length) compressBatch(eligible);
}

// ─── Clear all ───────────────────────────────────────────────────────────────

clearAllBtn.addEventListener('click', () => {
  state.files = [];
  renderQueue();
});

// ─── Queue visibility ────────────────────────────────────────────────────────

function setQueueVisible(visible) {
  queueEl.hidden = !visible;
}
```

- [ ] **Step 2: Verify in browser**

Reload. Open console. Drag in a JPEG/PNG — should not throw errors. `state.files` should be accessible in the console with the entry present.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add app state and file ingestion"
```

---

### Task 4: Compression logic

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Append compression logic to `app.js`**

```js
// ─── Compression ─────────────────────────────────────────────────────────────

const MAX_CONCURRENT = 4;
let activeCount = 0;
const compressionQueue = [];

function compressBatch(entries) {
  entries.forEach(entry => compressionQueue.push(entry));
  drainQueue();
}

function drainQueue() {
  while (activeCount < MAX_CONCURRENT && compressionQueue.length > 0) {
    const entry = compressionQueue.shift();
    if (entry.status !== 'pending') continue; // may have been cleared
    activeCount++;
    entry.status = 'compressing';
    updateCard(entry);
    compressOne(entry).finally(() => {
      activeCount--;
      drainQueue();
    });
  }
}

async function compressOne(entry) {
  const opts = getOptions();
  try {
    const compressed = await imageCompression(entry.originalFile, opts);
    if (compressed.size >= entry.originalSize) {
      // Compressed is larger — use original
      entry.compressedBlob = entry.originalFile;
      entry.compressedSize = entry.originalSize;
      entry.usedOriginal = true;
    } else {
      entry.compressedBlob = compressed;
      entry.compressedSize = compressed.size;
      entry.usedOriginal = false;
    }
    entry.status = 'done';
  } catch (err) {
    entry.status = 'error';
    entry.errorMessage = 'Compression failed';
  }
  updateCard(entry);
}
```

- [ ] **Step 2: Verify in browser**

Drag in images. After a moment cards should update from spinner to showing file sizes. Check console for errors.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add compression logic with concurrency limit"
```

---

### Task 5: Card rendering

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Append rendering logic to `app.js`**

```js
// ─── Rendering ───────────────────────────────────────────────────────────────

function renderQueue() {
  setQueueVisible(state.files.length > 0);
  queueList.innerHTML = '';
  state.files.forEach(entry => {
    const card = buildCard(entry);
    queueList.appendChild(card);
  });
}

function updateCard(entry) {
  const existing = document.getElementById(`card-${entry.id}`);
  const newCard = buildCard(entry);
  if (existing) {
    existing.replaceWith(newCard);
  } else {
    renderQueue();
  }
}

function buildCard(entry) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${entry.id}`;

  if (entry.status === 'unsupported') card.classList.add('card--error');
  if (entry.usedOriginal) card.classList.add('card--warning');

  // Thumbnail
  const thumb = document.createElement('div');
  thumb.className = 'card__thumb card__thumb--placeholder';
  if (entry.status === 'done' || entry.status === 'compressing') {
    const img = document.createElement('img');
    img.className = 'card__thumb';
    img.alt = entry.originalFile.name;
    const url = URL.createObjectURL(entry.originalFile);
    img.src = url;
    img.onload = () => URL.revokeObjectURL(url);
    card.appendChild(img);
  } else {
    thumb.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
    card.appendChild(thumb);
  }

  // Info
  const info = document.createElement('div');
  info.className = 'card__info';

  const name = document.createElement('div');
  name.className = 'card__name';
  name.title = entry.originalFile.name;
  name.textContent = outputFilename(entry);
  info.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'card__meta';

  if (entry.status === 'unsupported') {
    const err = document.createElement('span');
    err.className = 'card__error';
    err.textContent = entry.errorMessage;
    meta.appendChild(err);
  } else if (entry.status === 'compressing' || entry.status === 'pending') {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    meta.appendChild(spinner);
    const st = document.createElement('span');
    st.className = 'card__status';
    st.textContent = 'Compressing…';
    meta.appendChild(st);
  } else if (entry.status === 'error') {
    const err = document.createElement('span');
    err.className = 'card__error';
    err.textContent = entry.errorMessage;
    meta.appendChild(err);
  } else {
    // done
    const origSize = document.createElement('span');
    origSize.className = 'card__size';
    origSize.textContent = formatBytes(entry.originalSize);
    meta.appendChild(origSize);

    const arrow = document.createElement('span');
    arrow.className = 'card__arrow';
    arrow.textContent = '→';
    meta.appendChild(arrow);

    const newSize = document.createElement('span');
    newSize.className = 'card__size--new';
    newSize.textContent = formatBytes(entry.compressedSize);
    meta.appendChild(newSize);

    const savings = document.createElement('span');
    const pct = Math.round((1 - entry.compressedSize / entry.originalSize) * 100);
    if (entry.usedOriginal) {
      savings.className = 'card__savings card__savings--warn';
      savings.textContent = 'No gain — using original';
    } else {
      savings.className = 'card__savings card__savings--good';
      savings.textContent = `−${pct}%`;
    }
    meta.appendChild(savings);
  }

  info.appendChild(meta);
  card.appendChild(info);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'card__actions';

  if (entry.status === 'done') {
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn--primary btn--sm';
    dlBtn.textContent = 'Download';
    dlBtn.addEventListener('click', () => downloadEntry(entry));
    actions.appendChild(dlBtn);
  }

  card.appendChild(actions);
  return card;
}

function outputFilename(entry) {
  const base = entry.originalFile.name.replace(/\.[^.]+$/, '');
  const ext = convertWebp.checked ? 'webp' : entry.originalFile.name.split('.').pop();
  return `${base}.${ext}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
```

- [ ] **Step 2: Verify in browser**

Drag in several images. Cards should appear with thumbnails, original → compressed sizes, and % saved badge. Compressing state should show spinner. Unsupported files should show error. "No gain" warning should appear if compressed is larger.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add card rendering"
```

---

### Task 6: Download logic

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Append download logic to `app.js`**

```js
// ─── Downloads ────────────────────────────────────────────────────────────────

function downloadEntry(entry) {
  const blob = entry.compressedBlob;
  const filename = outputFilename(entry);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

downloadAll.addEventListener('click', async () => {
  const done = state.files.filter(e => e.status === 'done' && e.compressedBlob);
  if (!done.length) return;

  downloadAll.disabled = true;
  downloadAll.textContent = 'Zipping…';

  const zip = new JSZip();
  done.forEach(entry => {
    zip.file(outputFilename(entry), entry.compressedBlob);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'compressed-images.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  downloadAll.disabled = false;
  downloadAll.textContent = 'Download all as ZIP';
});
```

- [ ] **Step 2: Verify in browser**

Click "Download" on a card — file downloads with correct name and format. Click "Download all as ZIP" — downloads a zip containing all compressed files. Verify zip contents are correct.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add individual and batch zip download"
```

---

### Task 7: Final integration check

**Files:**
- No new files

- [ ] **Step 1: Run manual test checklist**

Open `index.html` in browser. Test each scenario:

1. **JPEG compression** — drag in a JPEG, confirm size decreases, download works
2. **PNG compression** — drag in a PNG, confirm size decreases, download works
3. **WebP conversion** — toggle "Convert to WebP", drag in JPEG, confirm downloaded file is `.webp`
4. **Max width** — enter `400` in max width, drag in a wide image, confirm downloaded image is ≤400px wide
5. **Max width invalid input** — enter `-1` or `abc`, drag in image, confirm it compresses without resize
6. **Batch upload** — drag in 5+ images at once, confirm all compress correctly
7. **Quality slider** — move slider to 1, drop images, confirm very small files; move to 100, confirm larger files; confirm re-compress triggers on change
8. **Slider re-compress** — add files, change slider, confirm all cards show spinner then update
9. **Download All ZIP** — confirm zip contains all compressed files with correct names
10. **Unsupported file** — drag in a `.gif`, confirm error card appears
11. **Clear all** — click "Clear all", confirm queue empties
12. **Compressed > original** — if encountered, confirm "No gain — using original" badge appears in amber

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: image compression tool complete"
```
