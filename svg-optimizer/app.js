const fileInput      = document.getElementById('fileInput');
const inputEl        = document.getElementById('input');
const inputError     = document.getElementById('inputError');
const optimizeBtn    = document.getElementById('optimizeBtn');
const outputEl       = document.getElementById('output');
const copyBtn        = document.getElementById('copyBtn');
const downloadBtn    = document.getElementById('downloadBtn');

const statsEl        = document.getElementById('stats');
const originalSizeEl = document.getElementById('originalSize');
const optimizedSizeEl= document.getElementById('optimizedSize');
const reductionEl    = document.getElementById('reduction');

const originalPreview     = document.getElementById('originalPreview');
const originalPlaceholder = document.getElementById('originalPlaceholder');
const originalPreviewError= document.getElementById('originalPreviewError');

const optimizedPreview     = document.getElementById('optimizedPreview');
const optimizedPlaceholder = document.getElementById('optimizedPlaceholder');
const optimizedPreviewError= document.getElementById('optimizedPreviewError');

let uploadedFileName = '';
const originalUrlState  = { url: null };
const optimizedUrlState = { url: null };

function stripElement(str, tag) {
  const withContent = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
  const selfClosing  = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
  return str.replace(withContent, '').replace(selfClosing, '');
}

function collapseAttrWhitespace(str) {
  return str
    .replace(/="([^"]*)"/g, (m, v) => `="${v.replace(/\s+/g, ' ').trim()}"`)
    .replace(/='([^']*)'/g, (m, v) => `='${v.replace(/\s+/g, ' ').trim()}'`);
}

function optimizeSvg(svg) {
  let out = svg;
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<\?xml[^>]*\?>/gi, '');
  out = out.replace(/<!DOCTYPE[^>]*>/gi, '');
  out = stripElement(out, 'title');
  out = stripElement(out, 'desc');
  out = stripElement(out, 'metadata');
  out = out.replace(/>\s+</g, '><');
  out = collapseAttrWhitespace(out);
  return out.trim();
}

function byteSize(str) {
  return new Blob([str]).size;
}

function formatBytes(n) {
  return `${n.toLocaleString()} B`;
}

function showEl(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function hideEl(el) {
  el.hidden = true;
}

function renderPreview(svgText, imgEl, placeholderEl, errorEl, urlState) {
  if (urlState.url) {
    URL.revokeObjectURL(urlState.url);
    urlState.url = null;
  }
  hideEl(errorEl);
  imgEl.hidden = true;

  if (!svgText.trim()) {
    placeholderEl.hidden = false;
    return;
  }

  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  urlState.url = url;

  imgEl.onload = () => {
    imgEl.hidden = false;
    placeholderEl.hidden = true;
  };
  imgEl.onerror = () => {
    imgEl.hidden = true;
    placeholderEl.hidden = true;
    showEl(errorEl, 'Could not render preview — check that this is valid SVG markup.');
  };
  imgEl.src = url;
}

function downloadFilename() {
  if (uploadedFileName) {
    return uploadedFileName.replace(/\.svg$/i, '') + '-optimized.svg';
  }
  return 'optimized.svg';
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  uploadedFileName = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    inputEl.value = reader.result;
    hideEl(inputError);
  };
  reader.onerror = () => {
    showEl(inputError, 'Could not read this file.');
  };
  reader.readAsText(file);
  fileInput.value = '';
});

optimizeBtn.addEventListener('click', () => {
  hideEl(inputError);
  const raw = inputEl.value;

  if (!raw.trim()) {
    showEl(inputError, 'Paste or upload SVG markup first.');
    outputEl.value = '';
    statsEl.hidden = true;
    renderPreview('', originalPreview, originalPlaceholder, originalPreviewError, originalUrlState);
    renderPreview('', optimizedPreview, optimizedPlaceholder, optimizedPreviewError, optimizedUrlState);
    return;
  }

  const optimized = optimizeSvg(raw);
  outputEl.value = optimized;

  const originalSize = byteSize(raw);
  const optimizedSize = byteSize(optimized);
  const reductionPct = originalSize > 0 ? (1 - optimizedSize / originalSize) * 100 : 0;

  originalSizeEl.textContent = formatBytes(originalSize);
  optimizedSizeEl.textContent = formatBytes(optimizedSize);
  reductionEl.textContent = `${reductionPct.toFixed(1)}%`;
  statsEl.hidden = false;

  renderPreview(raw, originalPreview, originalPlaceholder, originalPreviewError, originalUrlState);
  renderPreview(optimized, optimizedPreview, optimizedPlaceholder, optimizedPreviewError, optimizedUrlState);
});

copyBtn.addEventListener('click', async () => {
  if (!outputEl.value) return;
  await navigator.clipboard.writeText(outputEl.value);
  const original = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.textContent = original; }, 1200);
});

downloadBtn.addEventListener('click', () => {
  if (!outputEl.value) return;
  const blob = new Blob([outputEl.value], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
