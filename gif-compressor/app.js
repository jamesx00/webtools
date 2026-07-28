import gifsicle from 'gifsicle-wasm-browser';
import JSZip from 'jszip';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  files: [],
  nextId: 0,
  // Bumped whenever the options change. A run that finishes under an old
  // generation is discarded and requeued, so the visible result always
  // matches the current settings.
  gen: 0,
};

// FileEntry shape:
// {
//   id: number,
//   originalFile: File,
//   originalSize: number,
//   meta: {frameCount, delay}|null,   // parsed from the GIF header
//   compressedBlob: Blob|null,
//   compressedSize: number|null,
//   status: 'pending'|'compressing'|'done'|'error'|'unsupported',
//   errorMessage: string|null,
//   usedOriginal: boolean,
// }

function createEntry(file) {
  return {
    id: state.nextId++,
    originalFile: file,
    originalSize: file.size,
    meta: null,
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
const lossyEl     = document.getElementById('lossy');
const lossyVal    = document.getElementById('lossyValue');
const colorsEl    = document.getElementById('colors');
const maxWidthEl  = document.getElementById('maxWidth');
const frameFromEl = document.getElementById('frameFrom');
const frameToEl   = document.getElementById('frameTo');
const dropFramesEl = document.getElementById('dropFrames');
const optimizeEl  = document.getElementById('optimize');
const downloadAll = document.getElementById('downloadAll');
const clearAllBtn = document.getElementById('clearAll');

// ─── Drop zone ────────────────────────────────────────────────────────────────

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', e => {
  if (!dropzone.contains(e.relatedTarget)) {
    dropzone.classList.remove('dragover');
  }
});
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  ingestFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener('change', () => {
  ingestFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

// ─── Controls ────────────────────────────────────────────────────────────────

lossyEl.addEventListener('input', () => {
  lossyVal.textContent = lossyEl.value;
});
[lossyEl, colorsEl, maxWidthEl, frameFromEl, frameToEl, dropFramesEl, optimizeEl].forEach(el => {
  el.addEventListener('change', recompressAll);
});

// Resolves the user's 1-based "frames from/to" inputs against one GIF's actual
// frame count. Returns 0-based inclusive bounds for gifsicle's `#a-b` syntax.
function frameRange(entry) {
  const total = entry.meta ? entry.meta.frameCount : 0;
  if (!total) return null;
  const rawFrom = parseInt(frameFromEl.value, 10);
  const rawTo   = parseInt(frameToEl.value, 10);
  let from = Number.isFinite(rawFrom) ? rawFrom - 1 : 0;
  let to   = Number.isFinite(rawTo)   ? rawTo   - 1 : total - 1;
  from = Math.min(Math.max(from, 0), total - 1);
  to   = Math.min(Math.max(to, from), total - 1);
  if (from === 0 && to === total - 1) return null; // full range — no trimming
  return { from, to, count: to - from + 1 };
}

// Builds the gifsicle argument list for one entry. `1.gif` is the in-memory
// input name; gifsicle exports everything written to /out.
function buildCommand(entry) {
  const range = frameRange(entry);
  const args = [range ? `1.gif #${range.from}-${range.to}` : '1.gif'];

  // Frame indices for --delete are relative to what the range selection kept.
  const selected = range ? range.count : (entry.meta ? entry.meta.frameCount : 0);

  const keepEvery = parseInt(dropFramesEl.value, 10);
  if (keepEvery > 1 && selected > 1) {
    const drop = [];
    for (let i = 0; i < selected; i++) {
      if (i % keepEvery !== 0) drop.push(`#${i}`);
    }
    if (drop.length) args.push('--delete', ...drop);
    // Frames are removed, not retimed — stretch the delay so the animation
    // still runs at roughly its original speed.
    const delay = entry.meta.delay || 10;
    args.push(`-d${Math.min(delay * keepEvery, 65535)}`);
  }

  args.push(optimizeEl.checked ? '-O3' : '-O1');

  const lossy = parseInt(lossyEl.value, 10);
  if (lossy > 0) args.push(`--lossy=${lossy}`);

  const colors = parseInt(colorsEl.value, 10);
  if (colors > 0) args.push('--colors', String(colors));

  const mw = parseInt(maxWidthEl.value, 10);
  if (mw > 0) args.push('--resize-fit', `${mw}x_`);

  args.push('-o', '/out/out.gif');
  return args.join(' ');
}

// ─── Clear all ────────────────────────────────────────────────────────────────

clearAllBtn.addEventListener('click', () => {
  state.files = [];
  renderQueue();
});

// ─── GIF header parsing ──────────────────────────────────────────────────────

// Walks the GIF block structure to count frames and read the first frame delay
// (in 1/100s). Needed because --delete takes explicit frame indices.
function parseGif(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 13) return null;
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  if (sig !== 'GIF') return null;

  let p = 10;
  const packed = bytes[p];
  p += 3; // packed + background color index + pixel aspect ratio
  if (packed & 0x80) p += 3 * (1 << ((packed & 0x07) + 1)); // global color table

  const skipSubBlocks = () => {
    while (p < bytes.length) {
      const len = bytes[p++];
      if (len === 0) return;
      p += len;
    }
  };

  let frameCount = 0;
  let delay = 0;

  while (p < bytes.length) {
    const marker = bytes[p++];
    if (marker === 0x3b) break; // trailer
    if (marker === 0x21) {
      const label = bytes[p++];
      if (label === 0xf9) {
        const size = bytes[p];
        if (delay === 0 && size >= 4) delay = view.getUint16(p + 2, true);
      }
      skipSubBlocks();
    } else if (marker === 0x2c) {
      frameCount++;
      p += 8; // left, top, width, height
      const lp = bytes[p++];
      if (lp & 0x80) p += 3 * (1 << ((lp & 0x07) + 1)); // local color table
      p++; // LZW minimum code size
      skipSubBlocks();
    } else {
      return frameCount > 0 ? { frameCount, delay } : null;
    }
  }

  return { frameCount, delay };
}

// ─── Ingest ───────────────────────────────────────────────────────────────────

function isGif(file) {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

async function ingestFiles(files) {
  const entries = files.map(f => {
    const entry = createEntry(f);
    if (!isGif(f)) {
      entry.status = 'unsupported';
      entry.errorMessage = 'Not a GIF';
    }
    return entry;
  });

  state.files.push(...entries);
  renderQueue();

  const toCompress = entries.filter(e => e.status === 'pending');
  await Promise.all(toCompress.map(async entry => {
    try {
      entry.meta = parseGif(await entry.originalFile.arrayBuffer());
    } catch {
      entry.meta = null;
    }
  }));
  if (toCompress.length) compressBatch(toCompress);
}

function recompressAll() {
  state.gen++;
  const eligible = state.files.filter(e => e.status !== 'unsupported');
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

// ─── Compression ─────────────────────────────────────────────────────────────

// gifsicle-wasm-browser holds a single wasm instance, so runs must be
// serialized — unlike the image compressor there is no parallel fan-out.
const compressionQueue = [];
let draining = false;

function compressBatch(entries) {
  entries.forEach(entry => {
    if (!compressionQueue.includes(entry)) compressionQueue.push(entry);
  });
  drainQueue();
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    while (compressionQueue.length > 0) {
      const entry = compressionQueue.shift();
      if (entry.status !== 'pending') continue;
      entry.status = 'compressing';
      updateCard(entry);
      await compressOne(entry);
    }
  } finally {
    draining = false;
  }
}

async function compressOne(entry) {
  const gen = state.gen;
  try {
    const out = await gifsicle.run({
      input: [{ file: entry.originalFile, name: '1.gif' }],
      command: [buildCommand(entry)],
    });
    if (gen !== state.gen) { // options changed mid-run — redo with the new ones
      entry.status = 'pending';
      compressBatch([entry]);
      return;
    }
    if (!out || !out.length) throw new Error('no output');
    const compressed = out[0];
    if (compressed.size >= entry.originalSize) {
      entry.compressedBlob = entry.originalFile;
      entry.compressedSize = entry.originalSize;
      entry.usedOriginal = true;
    } else {
      entry.compressedBlob = compressed;
      entry.compressedSize = compressed.size;
      entry.usedOriginal = false;
    }
    entry.status = 'done';
  } catch {
    if (gen !== state.gen) {
      entry.status = 'pending';
      compressBatch([entry]);
      return;
    }
    entry.status = 'error';
    entry.errorMessage = 'Compression failed';
  }
  updateCard(entry);
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderQueue() {
  queueEl.hidden = state.files.length === 0;
  queueList.innerHTML = '';
  state.files.forEach(entry => queueList.appendChild(buildCard(entry)));
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

  if (entry.status === 'unsupported' || entry.status === 'error') {
    card.classList.add('card--error');
  } else if (entry.usedOriginal) {
    card.classList.add('card--warning');
  }

  // Thumbnail — shows the compressed result once available so the user can
  // eyeball the quality loss.
  if (entry.status !== 'unsupported') {
    const img = document.createElement('img');
    img.className = 'card__thumb';
    img.alt = entry.originalFile.name;
    const source = entry.compressedBlob || entry.originalFile;
    const url = URL.createObjectURL(source);
    img.src = url;
    img.onload = () => URL.revokeObjectURL(url);
    card.appendChild(img);
  } else {
    const thumb = document.createElement('div');
    thumb.className = 'card__thumb card__thumb--placeholder';
    thumb.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
    card.appendChild(thumb);
  }

  // Info
  const info = document.createElement('div');
  info.className = 'card__info';

  const name = document.createElement('div');
  name.className = 'card__name';
  name.title = entry.originalFile.name;
  name.textContent = uniqueFilenames(state.files)[entry.id];
  info.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'card__meta';

  if (entry.status === 'unsupported' || entry.status === 'error') {
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
    st.textContent = entry.status === 'pending' ? 'Queued…' : 'Compressing…';
    meta.appendChild(st);
  } else {
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
    if (entry.usedOriginal) {
      savings.className = 'card__savings card__savings--warn';
      savings.textContent = 'No gain — using original';
    } else {
      const pct = Math.round((1 - entry.compressedSize / entry.originalSize) * 100);
      savings.className = 'card__savings card__savings--good';
      savings.textContent = `−${pct}%`;
    }
    meta.appendChild(savings);

    if (entry.meta && entry.meta.frameCount) {
      const frames = document.createElement('span');
      frames.className = 'card__status';
      frames.textContent = `${entry.meta.frameCount} source frame${entry.meta.frameCount === 1 ? '' : 's'}`;
      meta.appendChild(frames);
    }
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

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn--secondary btn--sm';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => {
    state.files = state.files.filter(f => f.id !== entry.id);
    renderQueue();
  });
  actions.appendChild(removeBtn);
  card.appendChild(actions);

  return card;
}

function outputFilename(entry) {
  const base = entry.originalFile.name.replace(/\.[^.]+$/, '');
  return `${base}.gif`;
}

function uniqueFilenames(entries) {
  const seen = {};
  const result = {};
  for (const entry of entries) {
    const base = outputFilename(entry);
    if (!(base in seen)) {
      seen[base] = 0;
      result[entry.id] = base;
    } else {
      seen[base]++;
      const dot = base.lastIndexOf('.');
      const stem = dot !== -1 ? base.slice(0, dot) : base;
      const ext  = dot !== -1 ? base.slice(dot)   : '';
      result[entry.id] = `${stem}-${seen[base]}${ext}`;
    }
  }
  return result;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Downloads ────────────────────────────────────────────────────────────────

function downloadEntry(entry) {
  const url = URL.createObjectURL(entry.compressedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = uniqueFilenames(state.files)[entry.id];
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

downloadAll.addEventListener('click', async () => {
  const done = state.files.filter(e => e.status === 'done' && e.compressedBlob);
  if (!done.length) return;

  downloadAll.disabled = true;
  downloadAll.textContent = 'Zipping…';

  try {
    const zip = new JSZip();
    const filenameMap = uniqueFilenames(state.files);
    done.forEach(entry => zip.file(filenameMap[entry.id], entry.compressedBlob));
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compressed-gifs.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    downloadAll.disabled = false;
    downloadAll.textContent = 'Download all as ZIP';
  }
});
