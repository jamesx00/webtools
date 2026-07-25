const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('fileInput');
const errorMsg      = document.getElementById('errorMsg');
const workspace     = document.getElementById('workspace');
const sourcePreview = document.getElementById('sourcePreview');
const sourceName    = document.getElementById('sourceName');
const sourceDims    = document.getElementById('sourceDims');
const sourceSize    = document.getElementById('sourceSize');
const widthInput    = document.getElementById('widthInput');
const heightInput   = document.getElementById('heightInput');
const lockAspect    = document.getElementById('lockAspect');
const formatSelect  = document.getElementById('formatSelect');
const qualityGroup  = document.getElementById('qualityGroup');
const qualityInput  = document.getElementById('qualityInput');
const qualityValue  = document.getElementById('qualityValue');
const resizeBtn     = document.getElementById('resizeBtn');
const resultEl      = document.getElementById('result');
const resultPreview = document.getElementById('resultPreview');
const resultDims    = document.getElementById('resultDims');
const resultSize    = document.getElementById('resultSize');
const downloadLink  = document.getElementById('downloadLink');

const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const state = {
  file: null,
  naturalWidth: 0,
  naturalHeight: 0,
  sourceUrl: null,
  resultUrl: null,
};

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
  const file = e.dataTransfer.files[0];
  if (file) ingestFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) ingestFile(file);
  fileInput.value = '';
});

// ─── Ingest ───────────────────────────────────────────────────────────────────

function ingestFile(file) {
  if (!SUPPORTED.includes(file.type)) {
    showError('Unsupported file type. Please choose a JPEG, PNG or WebP image.');
    return;
  }
  hideError();

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.file = file;
    state.naturalWidth = img.naturalWidth;
    state.naturalHeight = img.naturalHeight;

    if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
    state.sourceUrl = url;
    sourcePreview.src = url;
    sourceName.textContent = file.name;
    sourceDims.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
    sourceSize.textContent = formatBytes(file.size);

    widthInput.value = img.naturalWidth;
    heightInput.value = img.naturalHeight;

    workspace.hidden = false;
    resultEl.hidden = true;
    if (state.resultUrl) {
      URL.revokeObjectURL(state.resultUrl);
      state.resultUrl = null;
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    showError('Could not read that file as an image.');
  };
  img.src = url;
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}
function hideError() {
  errorMsg.hidden = true;
}

// ─── Dimension controls ─────────────────────────────────────────────────────

widthInput.addEventListener('input', () => {
  if (!lockAspect.checked || !state.naturalWidth) return;
  const w = parseInt(widthInput.value, 10);
  if (!w || w <= 0) return;
  heightInput.value = Math.round(w * (state.naturalHeight / state.naturalWidth));
});

heightInput.addEventListener('input', () => {
  if (!lockAspect.checked || !state.naturalHeight) return;
  const h = parseInt(heightInput.value, 10);
  if (!h || h <= 0) return;
  widthInput.value = Math.round(h * (state.naturalWidth / state.naturalHeight));
});

document.querySelectorAll('.percent-buttons [data-percent]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state.naturalWidth) return;
    const pct = parseInt(btn.dataset.percent, 10) / 100;
    widthInput.value = Math.round(state.naturalWidth * pct);
    heightInput.value = Math.round(state.naturalHeight * pct);
  });
});

// ─── Format / quality ────────────────────────────────────────────────────────

formatSelect.addEventListener('change', () => {
  qualityGroup.hidden = formatSelect.value === 'image/png';
});

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = qualityInput.value;
});

// ─── Resize ──────────────────────────────────────────────────────────────────

resizeBtn.addEventListener('click', () => {
  if (!state.file) return;

  const w = parseInt(widthInput.value, 10);
  const h = parseInt(heightInput.value, 10);
  if (!w || w <= 0 || !h || h <= 0) {
    showError('Enter a valid width and height greater than zero.');
    return;
  }
  hideError();

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourcePreview, 0, 0, w, h);

  const mime = formatSelect.value;
  const quality = mime === 'image/png' ? undefined : parseInt(qualityInput.value, 10) / 100;

  resizeBtn.disabled = true;
  resizeBtn.textContent = 'Resizing…';

  canvas.toBlob(blob => {
    resizeBtn.disabled = false;
    resizeBtn.textContent = 'Resize';

    if (!blob) {
      showError('Resize failed. Try a different format or smaller dimensions.');
      return;
    }

    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    const url = URL.createObjectURL(blob);
    state.resultUrl = url;

    resultPreview.src = url;
    resultDims.textContent = `${w} × ${h}px`;
    resultSize.textContent = formatBytes(blob.size);

    const base = state.file.name.replace(/\.[^.]+$/, '');
    downloadLink.href = url;
    downloadLink.download = `${base}-resized.${EXTENSIONS[mime]}`;

    resultEl.hidden = false;
  }, mime, quality);
});

// ─── Utils ───────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
