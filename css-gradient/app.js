function hexToRgb(hex) {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function setupCopyButton(btn, getText) {
  btn.addEventListener('click', async () => {
    const text = getText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1200);
  });
}

// ─── Mode tabs (Gradient / Box Shadow) ──────────────────────────────────────

const tabsEl = document.getElementById('tabs');
const panelGradient = document.getElementById('panel-gradient');
const panelShadow = document.getElementById('panel-shadow');

function setMode(mode) {
  [...tabsEl.children].forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('tab--active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  panelGradient.hidden = mode !== 'gradient';
  panelShadow.hidden = mode !== 'shadow';
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) setMode(tab.dataset.mode);
});

// ─── Gradient panel ─────────────────────────────────────────────────────────

const gradientTypeTabs = document.getElementById('gradientTypeTabs');
const angleField = document.getElementById('angleField');
const angleInput = document.getElementById('angleInput');
const angleValue = document.getElementById('angleValue');
const positionField = document.getElementById('positionField');
const positionSelect = document.getElementById('positionSelect');
const stopsList = document.getElementById('stopsList');
const addStopBtn = document.getElementById('addStopBtn');
const gradientPreview = document.getElementById('gradientPreview');
const gradientOutput = document.getElementById('gradientOutput');
const gradientCopyBtn = document.getElementById('gradientCopyBtn');

const MAX_STOPS = 6;
const MIN_STOPS = 2;

let gradientType = 'linear';
let stops = [
  { color: '#2563eb', pos: 0 },
  { color: '#ffffff', pos: 100 },
];

function renderStops() {
  stopsList.innerHTML = '';
  stops.forEach((stop, i) => {
    const row = document.createElement('div');
    row.className = 'stop-row';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'stop-color';
    colorInput.value = stop.color;
    colorInput.addEventListener('input', () => {
      stops[i].color = colorInput.value;
      updateGradient();
    });

    const posInput = document.createElement('input');
    posInput.type = 'number';
    posInput.className = 'text-input stop-position';
    posInput.min = '0';
    posInput.max = '100';
    posInput.value = String(stop.pos);
    posInput.addEventListener('input', () => {
      const v = Math.min(100, Math.max(0, Number(posInput.value) || 0));
      stops[i].pos = v;
      updateGradient();
    });

    const percentLabel = document.createElement('span');
    percentLabel.className = 'stop-percent';
    percentLabel.textContent = '%';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn--secondary btn--sm';
    removeBtn.textContent = 'Remove';
    removeBtn.disabled = stops.length <= MIN_STOPS;
    removeBtn.addEventListener('click', () => {
      if (stops.length <= MIN_STOPS) return;
      stops.splice(i, 1);
      renderStops();
      updateGradient();
    });

    row.append(colorInput, posInput, percentLabel, removeBtn);
    stopsList.appendChild(row);
  });

  addStopBtn.disabled = stops.length >= MAX_STOPS;
}

function buildGradientValue() {
  const stopsStr = stops.map(s => `${s.color} ${s.pos}%`).join(', ');
  return gradientType === 'linear'
    ? `linear-gradient(${angleInput.value}deg, ${stopsStr})`
    : `radial-gradient(circle at ${positionSelect.value}, ${stopsStr})`;
}

function updateGradient() {
  const value = buildGradientValue();
  gradientPreview.style.background = value;
  gradientOutput.value = `background: ${value};`;
}

gradientTypeTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  gradientType = tab.dataset.type;
  [...gradientTypeTabs.children].forEach(t => {
    const active = t === tab;
    t.classList.toggle('tab--active', active);
    t.setAttribute('aria-selected', String(active));
  });
  angleField.hidden = gradientType !== 'linear';
  positionField.hidden = gradientType !== 'radial';
  updateGradient();
});

angleInput.addEventListener('input', () => {
  angleValue.textContent = `${angleInput.value}deg`;
  updateGradient();
});
positionSelect.addEventListener('change', updateGradient);

addStopBtn.addEventListener('click', () => {
  if (stops.length >= MAX_STOPS) return;
  stops.push({ color: '#000000', pos: 50 });
  renderStops();
  updateGradient();
});

setupCopyButton(gradientCopyBtn, () => gradientOutput.value);

// ─── Box shadow panel ───────────────────────────────────────────────────────

const offsetX = document.getElementById('offsetX');
const offsetY = document.getElementById('offsetY');
const blurInput = document.getElementById('blurInput');
const spreadInput = document.getElementById('spreadInput');
const shadowColor = document.getElementById('shadowColor');
const shadowOpacity = document.getElementById('shadowOpacity');
const opacityValue = document.getElementById('opacityValue');
const insetCheckbox = document.getElementById('insetCheckbox');
const shadowPreview = document.getElementById('shadowPreview');
const shadowOutput = document.getElementById('shadowOutput');
const shadowCopyBtn = document.getElementById('shadowCopyBtn');

function buildShadowValue() {
  const rgb = hexToRgb(shadowColor.value) || { r: 0, g: 0, b: 0 };
  const alpha = Math.round(Number(shadowOpacity.value)) / 100;
  const inset = insetCheckbox.checked ? 'inset ' : '';
  return `${inset}${offsetX.value || 0}px ${offsetY.value || 0}px ${blurInput.value || 0}px ${spreadInput.value || 0}px rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function updateShadow() {
  const value = buildShadowValue();
  shadowPreview.style.boxShadow = value;
  shadowOutput.value = `box-shadow: ${value};`;
}

[offsetX, offsetY, blurInput, spreadInput, shadowColor, insetCheckbox].forEach(el => {
  el.addEventListener('input', updateShadow);
});
shadowOpacity.addEventListener('input', () => {
  opacityValue.textContent = `${shadowOpacity.value}%`;
  updateShadow();
});

setupCopyButton(shadowCopyBtn, () => shadowOutput.value);

// ─── Init ───────────────────────────────────────────────────────────────────

renderStops();
updateGradient();
updateShadow();
