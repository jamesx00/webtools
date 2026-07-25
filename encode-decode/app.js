const tabsEl    = document.getElementById('tabs');
const actionsEl = document.getElementById('actions');
const inputEl   = document.getElementById('input');
const outputEl  = document.getElementById('output');
const errorEl   = document.getElementById('error');
const copyBtn   = document.getElementById('copyBtn');

const MODES = {
  base64: {
    actions: [
      { label: 'Encode', run: (s) => btoa(unescape(encodeURIComponent(s))) },
      { label: 'Decode', run: (s) => decodeURIComponent(escape(atob(s))) },
    ],
  },
  url: {
    actions: [
      { label: 'Encode', run: (s) => encodeURIComponent(s) },
      { label: 'Decode', run: (s) => decodeURIComponent(s) },
    ],
  },
  json: {
    actions: [
      { label: 'Format', run: (s) => JSON.stringify(JSON.parse(s), null, 2) },
      { label: 'Minify', run: (s) => JSON.stringify(JSON.parse(s)) },
    ],
  },
};

let currentMode = 'base64';

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
  } catch {
    outputEl.value = '';
    showError(`Could not ${action.label.toLowerCase()} this input`);
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

setMode('base64');
