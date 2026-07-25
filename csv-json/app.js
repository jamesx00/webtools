const tabsEl    = document.getElementById('tabs');
const actionsEl = document.getElementById('actions');
const inputEl   = document.getElementById('input');
const outputEl  = document.getElementById('output');
const errorEl   = document.getElementById('error');
const copyBtn   = document.getElementById('copyBtn');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += char;
        i += 1;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
    } else if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (char === '\r') {
      i += 1;
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }

  if (inQuotes) throw new Error('Unterminated quoted field');

  row.push(field);
  rows.push(row);

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function csvToJson(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('No rows found');

  const headers = rows[0];
  const data = rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });

  return JSON.stringify(data, null, 2);
}

function escapeCsvField(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function jsonToCsv(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of objects');
  if (data.length === 0) return '';

  const headers = [];
  const seen = new Set();
  data.forEach((obj) => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Expected an array of flat objects');
    }
    Object.keys(obj).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    });
  });

  const lines = [headers.map(escapeCsvField).join(',')];
  data.forEach((obj) => {
    lines.push(headers.map((h) => escapeCsvField(obj[h])).join(','));
  });

  return lines.join('\n');
}

const MODES = {
  csv2json: {
    actions: [
      { label: 'Convert to JSON', run: csvToJson },
    ],
  },
  json2csv: {
    actions: [
      { label: 'Convert to CSV', run: jsonToCsv },
    ],
  },
};

let currentMode = 'csv2json';

function setMode(mode) {
  currentMode = mode;
  [...tabsEl.children].forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('tab--active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  renderActions();
  hideError();
  outputEl.value = '';
}

function renderActions() {
  actionsEl.innerHTML = '';
  MODES[currentMode].actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary';
    btn.textContent = action.label;
    btn.addEventListener('click', () => runAction(action));
    actionsEl.appendChild(btn);
  });
}

function runAction(action) {
  hideError();
  try {
    outputEl.value = action.run(inputEl.value);
  } catch (err) {
    outputEl.value = '';
    showError(err instanceof Error ? err.message : `Could not ${action.label.toLowerCase()} this input`);
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
  if (tab) setMode(tab.dataset.mode);
});

copyBtn.addEventListener('click', async () => {
  if (!outputEl.value) return;
  await navigator.clipboard.writeText(outputEl.value);
  const original = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.textContent = original; }, 1200);
});

setMode('csv2json');
