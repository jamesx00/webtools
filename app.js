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

// ─── Preview modal ────────────────────────────────────────────────────────────

const previewModal    = document.getElementById('previewModal');
const previewBackdrop = previewModal.querySelector('.preview-modal__backdrop');
const previewImages   = previewModal.querySelector('.preview-modal__images');
const previewOriginal = previewModal.querySelector('.preview-modal__original');
const previewCompressed = previewModal.querySelector('.preview-modal__compressed');
const previewHandle   = previewModal.querySelector('.preview-modal__handle');
const previewStats    = previewModal.querySelector('.preview-modal__stats');

let previewUrls = [];
let dragging = false;

function openModal(entry) {
  if (!entry.compressedBlob) return;
  const origUrl = URL.createObjectURL(entry.originalFile);
  const compUrl = URL.createObjectURL(entry.compressedBlob);
  previewUrls = [origUrl, compUrl];

  previewOriginal.src   = origUrl;
  previewCompressed.src = compUrl;
  previewImages.style.setProperty('--split', '50');

  const filenameMap = uniqueFilenames(state.files);
  previewStats.textContent =
    `${filenameMap[entry.id]}  ·  ${formatBytes(entry.originalSize)} → ${formatBytes(entry.compressedSize)}`;

  previewModal.hidden = false;
}

function closeModal() {
  previewModal.hidden = true;
  dragging = false;
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  previewOriginal.src   = '';
  previewCompressed.src = '';
}

previewBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !previewModal.hidden) closeModal();
});

// ─── Slider drag ─────────────────────────────────────────────────────────────

function setSplit(clientX) {
  const rect = previewImages.getBoundingClientRect();
  const val = Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100));
  previewImages.style.setProperty('--split', String(val));
}

previewHandle.addEventListener('mousedown', e => {
  e.preventDefault();
  dragging = true;
});
document.addEventListener('mousemove', e => {
  if (dragging) setSplit(e.clientX);
});
document.addEventListener('mouseup', () => { dragging = false; });

previewHandle.addEventListener('touchstart', e => {
  e.preventDefault();
  dragging = true;
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (dragging) setSplit(e.touches[0].clientX);
}, { passive: true });
document.addEventListener('touchend', () => { dragging = false; });
document.addEventListener('touchcancel', () => { dragging = false; });

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
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => openModal(entry));
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
