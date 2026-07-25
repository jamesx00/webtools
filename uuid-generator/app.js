const quantityEl  = document.getElementById('quantity');
const uppercaseEl = document.getElementById('uppercase');
const hyphensEl   = document.getElementById('hyphens');
const generateBtn = document.getElementById('generateBtn');
const outputEl    = document.getElementById('output');
const copyAllBtn  = document.getElementById('copyAllBtn');
const uuidListEl  = document.getElementById('uuidList');

const MAX_QUANTITY = 1000;

function randomUuidV4() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

function formatUuid(uuid, { uppercase, hyphens }) {
  const value = hyphens ? uuid : uuid.replace(/-/g, '');
  return uppercase ? value.toUpperCase() : value;
}

let currentUuids = [];

function generate() {
  const quantity = Math.min(MAX_QUANTITY, Math.max(1, parseInt(quantityEl.value, 10) || 1));
  quantityEl.value = quantity;

  const options = { uppercase: uppercaseEl.checked, hyphens: hyphensEl.checked };
  currentUuids = Array.from({ length: quantity }, () => formatUuid(randomUuidV4(), options));
  render();
}

function render() {
  outputEl.value = currentUuids.join('\n');

  uuidListEl.textContent = '';
  currentUuids.forEach((uuid) => {
    const li = document.createElement('li');
    li.className = 'uuid-row';

    const value = document.createElement('span');
    value.className = 'uuid-row__value';
    value.textContent = uuid;

    const copyRowBtn = document.createElement('button');
    copyRowBtn.className = 'btn btn--secondary btn--sm';
    copyRowBtn.textContent = 'Copy';
    copyRowBtn.addEventListener('click', () => copyText(uuid, copyRowBtn));

    li.appendChild(value);
    li.appendChild(copyRowBtn);
    uuidListEl.appendChild(li);
  });
}

async function copyText(text, btn) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1200);
}

generateBtn.addEventListener('click', generate);
copyAllBtn.addEventListener('click', () => copyText(outputEl.value, copyAllBtn));

generate();
