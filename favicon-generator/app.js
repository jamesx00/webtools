import JSZip from 'jszip';

const SIZES = [
  { size: 16,  name: 'favicon-16x16.png' },
  { size: 32,  name: 'favicon-32x32.png' },
  { size: 48,  name: 'favicon-48x48.png' },
  { size: 180, name: 'apple-touch-icon-180x180.png' },
  { size: 192, name: 'favicon-192x192.png' },
  { size: 512, name: 'favicon-512x512.png' },
];

const LINK_SNIPPET = `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512x512.png">
`;

const state = {
  generated: [], // { size, name, blob, url }
};

const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('fileInput');
const errorEl      = document.getElementById('error');
const previewEl    = document.getElementById('preview');
const previewGrid  = document.getElementById('previewGrid');
const clearAllBtn  = document.getElementById('clearAll');
const downloadAll  = document.getElementById('downloadAll');

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

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

async function ingestFile(file) {
  clearError();

  if (!file.type.startsWith('image/')) {
    showError('That file doesn’t look like an image. Please drop a JPEG, PNG, WebP, GIF or similar.');
    return;
  }

  resetGenerated();

  let img;
  try {
    img = await loadImage(file);
  } catch {
    showError('Could not read that image. It may be corrupt or an unsupported format.');
    return;
  }

  try {
    state.generated = await generateSizes(img);
  } catch {
    showError('Something went wrong generating favicons from this image.');
    return;
  } finally {
    URL.revokeObjectURL(img.src);
  }

  renderPreview();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
}

// ─── Generation ───────────────────────────────────────────────────────────────

function canvasToPngBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function generateSizes(img) {
  const cropSize = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - cropSize) / 2;
  const sy = (img.naturalHeight - cropSize) / 2;

  const results = [];
  for (const spec of SIZES) {
    const canvas = document.createElement('canvas');
    canvas.width = spec.size;
    canvas.height = spec.size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, spec.size, spec.size);
    const blob = await canvasToPngBlob(canvas);
    results.push({
      size: spec.size,
      name: spec.name,
      blob,
      url: URL.createObjectURL(blob),
    });
  }
  return results;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderPreview() {
  previewGrid.innerHTML = '';
  state.generated.forEach(item => previewGrid.appendChild(buildPreviewCard(item)));
  previewEl.hidden = state.generated.length === 0;
}

function buildPreviewCard(item) {
  const card = document.createElement('div');
  card.className = 'preview-card';

  const img = document.createElement('img');
  img.className = 'preview-card__img';
  img.src = item.url;
  img.alt = `${item.size}×${item.size} favicon preview`;
  img.width = Math.min(item.size, 96);
  img.height = Math.min(item.size, 96);
  card.appendChild(img);

  const dims = document.createElement('div');
  dims.className = 'preview-card__dims';
  dims.textContent = `${item.size}×${item.size}`;
  card.appendChild(dims);

  const name = document.createElement('div');
  name.className = 'preview-card__name';
  name.textContent = item.name;
  card.appendChild(name);

  const dlLink = document.createElement('a');
  dlLink.className = 'btn btn--secondary btn--sm';
  dlLink.href = item.url;
  dlLink.download = item.name;
  dlLink.textContent = 'Download';
  card.appendChild(dlLink);

  return card;
}

// ─── Clear ────────────────────────────────────────────────────────────────────

function resetGenerated() {
  state.generated.forEach(item => URL.revokeObjectURL(item.url));
  state.generated = [];
  renderPreview();
}

clearAllBtn.addEventListener('click', () => {
  resetGenerated();
  clearError();
});

// ─── Download all ─────────────────────────────────────────────────────────────

downloadAll.addEventListener('click', async () => {
  if (!state.generated.length) return;

  downloadAll.disabled = true;
  downloadAll.textContent = 'Zipping…';

  try {
    const zip = new JSZip();
    state.generated.forEach(item => zip.file(item.name, item.blob));
    zip.file('favicon-links.html', LINK_SNIPPET);

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favicons.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    downloadAll.disabled = false;
    downloadAll.textContent = 'Download All (.zip)';
  }
});
