const tabsEl        = document.getElementById('tabs');
const encodePanel   = document.getElementById('encodePanel');
const decodePanel   = document.getElementById('decodePanel');

const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('fileInput');
const encodeResult  = document.getElementById('encodeResult');
const previewImg    = document.getElementById('previewImg');
const fileNameEl    = document.getElementById('fileName');
const fileDetailEl  = document.getElementById('fileDetail');
const dataUriOutput = document.getElementById('dataUriOutput');
const copyBtn       = document.getElementById('copyBtn');

const base64Input   = document.getElementById('base64Input');
const mimeSelect    = document.getElementById('mimeSelect');
const decodeError   = document.getElementById('decodeError');
const decodeResult  = document.getElementById('decodeResult');
const decodedImg    = document.getElementById('decodedImg');
const downloadBtn   = document.getElementById('downloadBtn');

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

let currentDownloadUri = '';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) setTab(tab.dataset.tab);
});

function setTab(tab) {
  [...tabsEl.children].forEach(el => {
    const active = el.dataset.tab === tab;
    el.classList.toggle('tab--active', active);
    el.setAttribute('aria-selected', String(active));
  });
  encodePanel.hidden = tab !== 'encode';
  decodePanel.hidden = tab !== 'decode';
}

// ─── Tab 1: Image → Base64 ──────────────────────────────────────────────────

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
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
  fileInput.value = '';
});

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUri = reader.result;
    previewImg.src = dataUri;
    fileNameEl.textContent = file.name;
    fileDetailEl.textContent = `${formatBytes(file.size)} • ${file.type || 'unknown type'}`;
    dataUriOutput.value = dataUri;
    encodeResult.hidden = false;
  };
  reader.readAsDataURL(file);
}

copyBtn.addEventListener('click', async () => {
  if (!dataUriOutput.value) return;
  await navigator.clipboard.writeText(dataUriOutput.value);
  const original = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.textContent = original; }, 1200);
});

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Tab 2: Base64 → Image ──────────────────────────────────────────────────

let debounceTimer = null;
base64Input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderDecoded, 150);
});
mimeSelect.addEventListener('change', renderDecoded);

function renderDecoded() {
  hideDecodeError();
  decodeResult.hidden = true;
  decodedImg.removeAttribute('src');
  currentDownloadUri = '';

  const raw = base64Input.value.trim();
  if (!raw) return;

  let dataUri;
  if (raw.startsWith('data:')) {
    dataUri = raw;
  } else {
    const stripped = raw.replace(/\s+/g, '');
    if (!isValidBase64(stripped)) {
      showDecodeError('Not valid base64 text');
      return;
    }
    dataUri = `data:${mimeSelect.value};base64,${stripped}`;
  }

  if (!dataUri.startsWith('data:image/')) {
    showDecodeError('Must be an image data URI (data:image/...) or raw base64');
    return;
  }

  currentDownloadUri = dataUri;
  decodedImg.onerror = () => showDecodeError('Could not load image — check the data is valid');
  decodedImg.onload = () => { decodeResult.hidden = false; };
  decodedImg.src = dataUri;
}

function isValidBase64(str) {
  try {
    atob(str);
    return true;
  } catch {
    return false;
  }
}

downloadBtn.addEventListener('click', () => {
  if (!currentDownloadUri) return;
  const mime = (currentDownloadUri.match(/^data:([^;,]+)/) || [])[1] || mimeSelect.value;
  const ext = EXT_BY_MIME[mime] || 'png';
  const a = document.createElement('a');
  a.href = currentDownloadUri;
  a.download = `image.${ext}`;
  a.click();
});

function showDecodeError(message) {
  decodeError.textContent = message;
  decodeError.hidden = false;
}

function hideDecodeError() {
  decodeError.hidden = true;
}

setTab('encode');
