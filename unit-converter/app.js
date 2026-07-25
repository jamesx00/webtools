const tabsEl      = document.getElementById('tabs');
const fromValueEl = document.getElementById('fromValue');
const fromUnitEl  = document.getElementById('fromUnit');
const toValueEl   = document.getElementById('toValue');
const toUnitEl    = document.getElementById('toUnit');
const swapBtn     = document.getElementById('swapBtn');
const errorEl     = document.getElementById('error');

function toCelsius(value, unit) {
  if (unit === 'C') return value;
  if (unit === 'F') return (value - 32) * 5 / 9;
  return value - 273.15; // K
}

function fromCelsius(value, unit) {
  if (unit === 'C') return value;
  if (unit === 'F') return value * 9 / 5 + 32;
  return value + 273.15; // K
}

function makeLinearCategory(unitDefs) {
  const units = {};
  for (const [id, def] of Object.entries(unitDefs)) units[id] = def.label;
  return {
    units,
    convert(value, from, to) {
      const base = value * unitDefs[from].factor;
      return base / unitDefs[to].factor;
    },
  };
}

const CATEGORIES = {
  length: {
    name: 'Length',
    defaultFrom: 'm',
    defaultTo: 'ft',
    ...makeLinearCategory({
      mm: { label: 'Millimeters (mm)', factor: 0.001 },
      cm: { label: 'Centimeters (cm)', factor: 0.01 },
      m:  { label: 'Meters (m)', factor: 1 },
      km: { label: 'Kilometers (km)', factor: 1000 },
      in: { label: 'Inches (in)', factor: 0.0254 },
      ft: { label: 'Feet (ft)', factor: 0.3048 },
      yd: { label: 'Yards (yd)', factor: 0.9144 },
      mi: { label: 'Miles (mi)', factor: 1609.344 },
    }),
  },
  weight: {
    name: 'Weight / Mass',
    defaultFrom: 'kg',
    defaultTo: 'lb',
    ...makeLinearCategory({
      mg: { label: 'Milligrams (mg)', factor: 0.000001 },
      g:  { label: 'Grams (g)', factor: 0.001 },
      kg: { label: 'Kilograms (kg)', factor: 1 },
      oz: { label: 'Ounces (oz)', factor: 0.0283495 },
      lb: { label: 'Pounds (lb)', factor: 0.45359237 },
      st: { label: 'Stone (st)', factor: 6.35029318 },
      t:  { label: 'Metric Tons (t)', factor: 1000 },
    }),
  },
  temperature: {
    name: 'Temperature',
    defaultFrom: 'C',
    defaultTo: 'F',
    units: {
      C: 'Celsius (°C)',
      F: 'Fahrenheit (°F)',
      K: 'Kelvin (K)',
    },
    convert(value, from, to) {
      return fromCelsius(toCelsius(value, from), to);
    },
  },
  volume: {
    name: 'Volume',
    defaultFrom: 'l',
    defaultTo: 'gal',
    ...makeLinearCategory({
      ml:    { label: 'Milliliters (ml)', factor: 0.001 },
      l:     { label: 'Liters (l)', factor: 1 },
      m3:    { label: 'Cubic Meters (m³)', factor: 1000 },
      gal:   { label: 'Gallons (US gal)', factor: 3.785411784 },
      qt:    { label: 'Quarts (US qt)', factor: 0.946352946 },
      pt:    { label: 'Pints (US pt)', factor: 0.473176473 },
      cup:   { label: 'Cups (US cup)', factor: 0.2365882365 },
      fl_oz: { label: 'Fluid Ounces (US fl oz)', factor: 0.0295735295625 },
    }),
  },
  data: {
    name: 'Data Storage',
    defaultFrom: 'MB',
    defaultTo: 'GB',
    ...makeLinearCategory({
      bit: { label: 'Bits', factor: 0.125 },
      byte: { label: 'Bytes (B)', factor: 1 },
      KB: { label: 'Kilobytes (KB, 1024 B)', factor: 1024 },
      MB: { label: 'Megabytes (MB, 1024 KB)', factor: 1024 ** 2 },
      GB: { label: 'Gigabytes (GB, 1024 MB)', factor: 1024 ** 3 },
      TB: { label: 'Terabytes (TB, 1024 GB)', factor: 1024 ** 4 },
      PB: { label: 'Petabytes (PB, 1024 TB)', factor: 1024 ** 5 },
    }),
  },
};

let currentCategory = 'length';

function formatResult(n) {
  if (!isFinite(n)) return '';
  if (n === 0) return '0';
  let s = n.toPrecision(6);
  if (s.includes('e')) {
    let [mantissa, exp] = s.split('e');
    if (mantissa.includes('.')) mantissa = mantissa.replace(/0+$/, '').replace(/\.$/, '');
    return `${mantissa}e${exp}`;
  }
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function populateUnits(selectEl, units, selected) {
  selectEl.innerHTML = '';
  for (const [id, label] of Object.entries(units)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    selectEl.appendChild(opt);
  }
  selectEl.value = selected;
}

function setCategory(category) {
  currentCategory = category;
  const cat = CATEGORIES[category];

  [...tabsEl.children].forEach(tab => {
    const active = tab.dataset.category === category;
    tab.classList.toggle('tab--active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  populateUnits(fromUnitEl, cat.units, cat.defaultFrom);
  populateUnits(toUnitEl, cat.units, cat.defaultTo);
  fromValueEl.value = '1';
  hideError();
  compute();
}

function compute() {
  hideError();
  const cat = CATEGORIES[currentCategory];
  const raw = fromValueEl.value;

  if (raw.trim() === '') {
    toValueEl.value = '';
    return;
  }

  const value = parseFloat(raw);
  if (!isFinite(value)) {
    toValueEl.value = '';
    showError('Enter a valid number');
    return;
  }

  try {
    const result = cat.convert(value, fromUnitEl.value, toUnitEl.value);
    toValueEl.value = formatResult(result);
  } catch {
    toValueEl.value = '';
    showError('Could not convert this value');
  }
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) setCategory(tab.dataset.category);
});

fromValueEl.addEventListener('input', compute);
fromUnitEl.addEventListener('change', compute);
toUnitEl.addEventListener('change', compute);

swapBtn.addEventListener('click', () => {
  const from = fromUnitEl.value;
  fromUnitEl.value = toUnitEl.value;
  toUnitEl.value = from;
  compute();
});

setCategory('length');
