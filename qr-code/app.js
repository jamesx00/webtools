import QRCode from 'qrcode';

const textEl        = document.getElementById('text');
const sizeEl         = document.getElementById('size');
const sizeValueEl    = document.getElementById('sizeValue');
const ecLevelEl      = document.getElementById('ecLevel');
const previewEmptyEl = document.getElementById('previewEmpty');
const canvas         = document.getElementById('canvas');
const downloadBtn    = document.getElementById('downloadBtn');

let debounceTimer = null;

function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 150);
}

textEl.addEventListener('input', scheduleRender);
ecLevelEl.addEventListener('change', render);
sizeEl.addEventListener('input', () => {
  sizeValueEl.textContent = sizeEl.value;
  scheduleRender();
});

async function render() {
  const value = textEl.value.trim();

  if (!value) {
    canvas.hidden = true;
    previewEmptyEl.hidden = false;
    downloadBtn.disabled = true;
    return;
  }

  try {
    await QRCode.toCanvas(canvas, value, {
      width: parseInt(sizeEl.value, 10),
      errorCorrectionLevel: ecLevelEl.value,
      margin: 2,
      color: { dark: '#111111', light: '#ffffff' },
    });
    canvas.hidden = false;
    previewEmptyEl.hidden = true;
    downloadBtn.disabled = false;
  } catch {
    canvas.hidden = true;
    previewEmptyEl.hidden = false;
    previewEmptyEl.textContent = 'Could not generate a QR code for this input';
    downloadBtn.disabled = true;
  }
}

downloadBtn.addEventListener('click', () => {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qrcode.png';
  a.click();
});
