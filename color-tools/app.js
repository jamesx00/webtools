// ─── Color parsing / formatting ────────────────────────────────────────────

function clamp255(n) { return Math.min(255, Math.max(0, Math.round(n))); }

function hexToRgb(hex) {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(c => clamp255(c).toString(16).padStart(2, '0')).join('');
}

function parseRgbString(str) {
  const m = str.trim().match(/^rgba?\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)?$/i);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map(Number);
  if ([r, g, b].some(v => v > 255)) return null;
  return { r, g, b };
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360 / 360;
  s /= 100; l /= 100;
  if (s === 0) {
    const v = clamp255(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: clamp255(hue2rgb(h + 1 / 3) * 255),
    g: clamp255(hue2rgb(h) * 255),
    b: clamp255(hue2rgb(h - 1 / 3) * 255),
  };
}

function parseHslString(str) {
  const m = str.trim().match(/^hsla?\(?\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*(?:,\s*[\d.]+\s*)?\)?$/i);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

function parseColor(str) {
  return hexToRgb(str) || parseRgbString(str) || (parseHslString(str) && hslToRgb(parseHslString(str)));
}

// ─── Converter panel ────────────────────────────────────────────────────────

const colorPicker    = document.getElementById('colorPicker');
const hexInput        = document.getElementById('hexInput');
const rgbInput        = document.getElementById('rgbInput');
const hslInput        = document.getElementById('hslInput');
const converterError  = document.getElementById('converterError');

function applyRgb(rgb, { skip } = {}) {
  const hex = rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  if (skip !== hexInput) hexInput.value = hex;
  if (skip !== rgbInput) rgbInput.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  if (skip !== hslInput) hslInput.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  colorPicker.value = hex;
  colorPicker.parentElement.style.background = hex;
  converterError.hidden = true;
}

colorPicker.addEventListener('input', () => applyRgb(hexToRgb(colorPicker.value)));

hexInput.addEventListener('input', () => {
  const rgb = hexToRgb(hexInput.value);
  if (rgb) applyRgb(rgb, { skip: hexInput });
  else showConverterError();
});
rgbInput.addEventListener('input', () => {
  const rgb = parseRgbString(rgbInput.value);
  if (rgb) applyRgb(rgb, { skip: rgbInput });
  else showConverterError();
});
hslInput.addEventListener('input', () => {
  const hsl = parseHslString(hslInput.value);
  if (hsl) applyRgb(hslToRgb(hsl), { skip: hslInput });
  else showConverterError();
});

function showConverterError() {
  converterError.textContent = 'Could not parse that color value';
  converterError.hidden = false;
}

// ─── Contrast checker ───────────────────────────────────────────────────────

const fgPicker  = document.getElementById('fgPicker');
const fgInput   = document.getElementById('fgInput');
const bgPicker  = document.getElementById('bgPicker');
const bgInput   = document.getElementById('bgInput');
const preview   = document.getElementById('contrastPreview');
const ratioEl   = document.getElementById('ratioValue');
const badgeAA        = document.getElementById('badgeAA');
const badgeAALarge   = document.getElementById('badgeAALarge');
const badgeAAA       = document.getElementById('badgeAAA');
const badgeAAALarge  = document.getElementById('badgeAAALarge');

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function setBadge(el, pass) {
  el.classList.toggle('badge--pass', pass);
  el.classList.toggle('badge--fail', !pass);
  el.textContent = `${el.dataset.label} ${pass ? 'Pass' : 'Fail'}`;
}

[badgeAA, badgeAALarge, badgeAAA, badgeAAALarge].forEach(el => {
  el.dataset.label = el.textContent;
});

function updateContrast() {
  const fg = parseColor(fgInput.value);
  const bg = parseColor(bgInput.value);
  if (!fg || !bg) return;

  const fgHex = rgbToHex(fg);
  const bgHex = rgbToHex(bg);
  fgPicker.value = fgHex;
  bgPicker.value = bgHex;
  fgPicker.parentElement.style.background = fgHex;
  bgPicker.parentElement.style.background = bgHex;

  preview.style.background = bgHex;
  preview.style.color = fgHex;

  const ratio = contrastRatio(fg, bg);
  ratioEl.textContent = ratio.toFixed(2);

  setBadge(badgeAA, ratio >= 4.5);
  setBadge(badgeAALarge, ratio >= 3);
  setBadge(badgeAAA, ratio >= 7);
  setBadge(badgeAAALarge, ratio >= 4.5);
}

fgPicker.addEventListener('input', () => { fgInput.value = fgPicker.value; updateContrast(); });
bgPicker.addEventListener('input', () => { bgInput.value = bgPicker.value; updateContrast(); });
fgInput.addEventListener('input', updateContrast);
bgInput.addEventListener('input', updateContrast);

updateContrast();
