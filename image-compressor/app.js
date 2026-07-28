import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  files: [],
  nextId: 0,
};

// FileEntry shape:
// {
//   id: number,
//   originalFile: File,
//   originalSize: number,
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
const qualityEl   = document.getElementById('quality');
const qualityVal  = document.getElementById('qualityValue');
const maxWidthEl  = document.getElementById('maxWidth');
const convertWebp = document.getElementById('convertWebp');
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

qualityEl.addEventListener('input', () => {
  qualityVal.textContent = qualityEl.value;
});
qualityEl.addEventListener('change', recompressAll);
convertWebp.addEventListener('change', recompressAll);
maxWidthEl.addEventListener('change', recompressAll);

function getOptions() {
  const quality = parseInt(qualityEl.value, 10) / 100;
  const mw = parseInt(maxWidthEl.value, 10);
  const webp = convertWebp.checked;
  return {
    initialQuality: quality,
    maxWidthOrHeight: (mw > 0) ? mw : undefined,
    fileType: webp ? 'image/webp' : undefined,
    useWebWorker: true,
  };
}

// ─── Clear all ────────────────────────────────────────────────────────────────

clearAllBtn.addEventListener('click', () => {
  state.files = [];
  renderQueue();
});

// ─── Ingest ───────────────────────────────────────────────────────────────────

const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp'];

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

function recompressAll() {
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
    if (entry.status !== 'pending') continue;
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

  // Thumbnail
  if (entry.status !== 'unsupported') {
    const img = document.createElement('img');
    img.className = 'card__thumb';
    img.alt = entry.originalFile.name;
    const url = URL.createObjectURL(entry.originalFile);
    img.src = url;
    img.onload = () => URL.revokeObjectURL(url);
    if (entry.status === 'done') {
      img.classList.add('card__thumb--clickable');
      img.title = 'Click to compare before / after';
      img.addEventListener('click', () => openCompare(entry));
    }
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
    st.textContent = 'Compressing\u2026';
    meta.appendChild(st);
  } else {
    const origSize = document.createElement('span');
    origSize.className = 'card__size';
    origSize.textContent = formatBytes(entry.originalSize);
    meta.appendChild(origSize);

    const arrow = document.createElement('span');
    arrow.className = 'card__arrow';
    arrow.textContent = '\u2192';
    meta.appendChild(arrow);

    const newSize = document.createElement('span');
    newSize.className = 'card__size--new';
    newSize.textContent = formatBytes(entry.compressedSize);
    meta.appendChild(newSize);

    const savings = document.createElement('span');
    if (entry.usedOriginal) {
      savings.className = 'card__savings card__savings--warn';
      savings.textContent = 'No gain \u2014 using original';
    } else {
      const pct = Math.round((1 - entry.compressedSize / entry.originalSize) * 100);
      savings.className = 'card__savings card__savings--good';
      savings.textContent = `\u2212${pct}%`;
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

// ─── Before/after comparison ─────────────────────────────────────────────────

const compareModal    = document.getElementById('compareModal');
const compareEl       = document.getElementById('compare');
const compareClip     = document.getElementById('compareClip');
const compareHandle   = document.getElementById('compareHandle');
const compareBeforeEl = document.getElementById('compareBefore');
const compareAfterEl  = document.getElementById('compareAfter');
const compareTitle    = document.getElementById('compareTitle');
const compareStats    = document.getElementById('compareStats');
const zoomValueEl     = document.getElementById('zoomValue');

// Object URLs live as long as the modal is open; revoked on close.
let compareUrls = [];

function openCompare(entry) {
  if (entry.status !== 'done' || !entry.compressedBlob) return;

  closeCompare();
  const beforeUrl = URL.createObjectURL(entry.originalFile);
  const afterUrl  = URL.createObjectURL(entry.compressedBlob);
  compareUrls = [beforeUrl, afterUrl];

  compareBeforeEl.src = beforeUrl;
  compareAfterEl.src  = afterUrl;
  compareTitle.textContent = uniqueFilenames(state.files)[entry.id];

  const pct = entry.usedOriginal
    ? 'no gain — using original'
    : `−${Math.round((1 - entry.compressedSize / entry.originalSize) * 100)}%`;
  compareStats.textContent =
    `${formatBytes(entry.originalSize)} → ${formatBytes(entry.compressedSize)} (${pct})`;

  compareModal.hidden = false;
  setZoom(1, null);
  // The original may be larger than the compressed one; size the box to the
  // original's aspect ratio so `object-fit: contain` letterboxes both equally.
  compareBeforeEl.decode?.().catch(() => {}).finally(sizeCompare);
  sizeCompare();
  setComparePosition(50);
}

function sizeCompare() {
  if (compareModal.hidden) return;
  const ratio = (compareBeforeEl.naturalWidth && compareBeforeEl.naturalHeight)
    ? compareBeforeEl.naturalHeight / compareBeforeEl.naturalWidth
    : 0.6;
  // Fill whatever the dialog has left after the header and footer.
  const dialog = compareEl.parentElement;
  const chrome = Array.from(dialog.children)
    .filter(el => el !== compareEl)
    .reduce((sum, el) => sum + el.offsetHeight, 0);
  const available = dialog.clientHeight - chrome;
  const width = compareEl.clientWidth;
  compareEl.style.height = `${Math.max(120, Math.min(width * ratio, available))}px`;
  compareClip.style.setProperty('--compare-w', `${width}px`);
}

function setComparePosition(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  compareClip.style.width = `${clamped}%`;
  compareHandle.style.left = `${clamped}%`;
  compareHandle.setAttribute('aria-valuenow', Math.round(clamped));
}

function positionFromEvent(e) {
  const rect = compareEl.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * 100;
}

// ─── Zoom / pan ──────────────────────────────────────────────────────────────
// Both images carry the identical transform (same box, same `object-fit`, same
// centre origin), so the two halves stay registered at any zoom level.

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const zoomState = { z: 1, ox: 0, oy: 0 };

function applyTransform() {
  const t = `translate(${zoomState.ox}px, ${zoomState.oy}px) scale(${zoomState.z})`;
  compareBeforeEl.style.transform = t;
  compareAfterEl.style.transform = t;
  zoomValueEl.textContent = `${Math.round(zoomState.z * 100)}%`;
  compareEl.classList.toggle('compare--zoomed', zoomState.z > 1);
  compareEl.classList.toggle('compare--pixelated', zoomState.z >= 2);
}

function clampPan() {
  const rect = compareEl.getBoundingClientRect();
  const maxX = Math.max(0, (zoomState.z - 1) * rect.width / 2);
  const maxY = Math.max(0, (zoomState.z - 1) * rect.height / 2);
  zoomState.ox = Math.max(-maxX, Math.min(maxX, zoomState.ox));
  zoomState.oy = Math.max(-maxY, Math.min(maxY, zoomState.oy));
}

// `anchor` is a point in container coordinates that should stay put while the
// scale changes; null anchors on the divider, so zooming keeps whatever the
// line sits on centred under the line.
function setZoom(z, anchor) {
  const rect = compareEl.getBoundingClientRect();
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const point = anchor || {
    x: (parseFloat(compareHandle.style.left) || 50) / 100 * rect.width,
    y: cy,
  };
  zoomState.ox = point.x - cx - (point.x - cx - zoomState.ox) * next / zoomState.z;
  zoomState.oy = point.y - cy - (point.y - cy - zoomState.oy) * next / zoomState.z;
  zoomState.z = next;
  if (next === 1) { zoomState.ox = 0; zoomState.oy = 0; }
  clampPan();
  applyTransform();
}

compareEl.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = compareEl.getBoundingClientRect();
  const factor = Math.exp(-e.deltaY * 0.002);
  setZoom(zoomState.z * factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
}, { passive: false });

document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoomState.z * 1.5, null));
document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoomState.z / 1.5, null));
document.getElementById('zoomReset').addEventListener('click', () => setZoom(1, null));

// ─── Pointer: divider drag, or pan when zoomed in ────────────────────────────

let drag = null;

compareEl.addEventListener('pointerdown', e => {
  compareEl.setPointerCapture(e.pointerId);
  const onHandle = e.target === compareHandle || compareHandle.contains(e.target);
  // Zoomed in, away from the handle: drag pans. Otherwise it moves the divider.
  const mode = (zoomState.z > 1 && !onHandle) ? 'pan' : 'divider';
  drag = { mode, x: e.clientX, y: e.clientY, moved: false };
  if (mode === 'divider') setComparePosition(positionFromEvent(e));
});

compareEl.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.mode === 'divider') {
    setComparePosition(positionFromEvent(e));
    return;
  }
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
  zoomState.ox += dx;
  zoomState.oy += dy;
  drag.x = e.clientX;
  drag.y = e.clientY;
  clampPan();
  applyTransform();
});

function endDrag(e) {
  if (!drag) return;
  // A click (no pan) while zoomed still moves the divider.
  if (drag.mode === 'pan' && !drag.moved) setComparePosition(positionFromEvent(e));
  drag = null;
  compareEl.releasePointerCapture?.(e.pointerId);
}
compareEl.addEventListener('pointerup', endDrag);
compareEl.addEventListener('pointercancel', () => { drag = null; });

compareHandle.addEventListener('keydown', e => {
  const current = parseFloat(compareHandle.getAttribute('aria-valuenow'));
  const step = e.shiftKey ? 10 : 2;
  if (e.key === 'ArrowLeft') setComparePosition(current - step);
  else if (e.key === 'ArrowRight') setComparePosition(current + step);
  else if (e.key === 'Home') setComparePosition(0);
  else if (e.key === 'End') setComparePosition(100);
  else return;
  e.preventDefault();
});

function closeCompare() {
  compareModal.hidden = true;
  compareUrls.forEach(u => URL.revokeObjectURL(u));
  compareUrls = [];
  compareBeforeEl.removeAttribute('src');
  compareAfterEl.removeAttribute('src');
}

document.getElementById('compareClose').addEventListener('click', closeCompare);
document.getElementById('compareBackdrop').addEventListener('click', closeCompare);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !compareModal.hidden) closeCompare();
});
window.addEventListener('resize', sizeCompare);

function outputFilename(entry) {
  const base = entry.originalFile.name.replace(/\.[^.]+$/, '');
  const ext = convertWebp.checked ? 'webp' : entry.originalFile.name.split('.').pop();
  return `${base}.${ext}`;
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
  downloadAll.textContent = 'Zipping\u2026';

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
    a.download = 'compressed-images.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    downloadAll.disabled = false;
    downloadAll.textContent = 'Download all as ZIP';
  }
});
