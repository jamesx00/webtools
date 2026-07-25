const inputEl    = document.getElementById('input');
const outputEl   = document.getElementById('output');
const errorEl    = document.getElementById('error');
const statusEl   = document.getElementById('status');
const formatBtn  = document.getElementById('formatBtn');
const minifyBtn  = document.getElementById('minifyBtn');
const copyBtn    = document.getElementById('copyBtn');

const STATUS_DEBOUNCE_MS = 200;

function getLineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function describeError(err, text) {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/position (\d+)/);
  if (!match) return message;
  const pos = Number(match[1]);
  if (!Number.isInteger(pos) || pos < 0 || pos > text.length) return message;
  const { line, column } = getLineColumn(text, pos);
  return `${message} (line ${line}, column ${column})`;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind ? `status status--${kind}` : 'status';
}

function updateStatus() {
  const text = inputEl.value;
  if (!text.trim()) {
    setStatus('—', null);
    return;
  }
  try {
    JSON.parse(text);
    setStatus('Valid JSON', 'valid');
  } catch {
    setStatus('Invalid JSON', 'invalid');
  }
}

function runAction(fn, label) {
  hideError();
  const text = inputEl.value;
  try {
    outputEl.value = fn(text);
  } catch (err) {
    outputEl.value = '';
    showError(describeError(err, text) || `Could not ${label.toLowerCase()} this input`);
  }
}

let statusTimer;
inputEl.addEventListener('input', () => {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(updateStatus, STATUS_DEBOUNCE_MS);
});

formatBtn.addEventListener('click', () => {
  runAction((s) => JSON.stringify(JSON.parse(s), null, 2), 'Format');
});

minifyBtn.addEventListener('click', () => {
  runAction((s) => JSON.stringify(JSON.parse(s)), 'Minify');
});

copyBtn.addEventListener('click', async () => {
  if (!outputEl.value) return;
  await navigator.clipboard.writeText(outputEl.value);
  const original = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.textContent = original; }, 1200);
});

updateStatus();
