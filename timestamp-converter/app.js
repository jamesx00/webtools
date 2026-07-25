const PLACEHOLDER = '—';

const nowSeconds = document.getElementById('nowSeconds');
const nowMs = document.getElementById('nowMs');
const nowIso = document.getElementById('nowIso');
const useNowBtn = document.getElementById('useNowBtn');

const unixInput = document.getElementById('unixInput');
const outIso = document.getElementById('outIso');
const outUtc = document.getElementById('outUtc');
const outLocal = document.getElementById('outLocal');
const outRelative = document.getElementById('outRelative');

const dateInput = document.getElementById('dateInput');
const utcCheckbox = document.getElementById('utcCheckbox');
const outUnixSeconds = document.getElementById('outUnixSeconds');
const outUnixMs = document.getElementById('outUnixMs');

function setPlaceholders(elements) {
  elements.forEach((el) => { el.textContent = PLACEHOLDER; });
}

function updateNow() {
  const now = new Date();
  nowSeconds.textContent = String(Math.floor(now.getTime() / 1000));
  nowMs.textContent = String(now.getTime());
  nowIso.textContent = now.toISOString();
}

function relativeTime(targetMs) {
  const diffMs = targetMs - Date.now();
  let diffSec = Math.round(diffMs / 1000);
  if (diffSec === 0) return 'just now';
  const future = diffSec > 0;
  diffSec = Math.abs(diffSec);

  const units = [
    [31536000, 'year'],
    [2592000, 'month'],
    [604800, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];
  for (const [secs, name] of units) {
    if (diffSec >= secs) {
      const val = Math.floor(diffSec / secs);
      const plural = val === 1 ? '' : 's';
      return future ? `in ${val} ${name}${plural}` : `${val} ${name}${plural} ago`;
    }
  }
  return 'just now';
}

function renderUnixToDate() {
  const raw = unixInput.value.trim();
  const outputs = [outIso, outUtc, outLocal, outRelative];
  if (raw === '') {
    setPlaceholders(outputs);
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    setPlaceholders(outputs);
    return;
  }
  // Heuristic: values this large as seconds would land far past year 3000, so treat as ms.
  const isMs = Math.abs(value) > 1e12;
  const ms = isMs ? value : value * 1000;
  const date = new Date(ms);
  if (isNaN(date.getTime())) {
    setPlaceholders(outputs);
    return;
  }
  outIso.textContent = date.toISOString();
  outUtc.textContent = date.toUTCString();
  outLocal.textContent = date.toLocaleString(undefined, { timeZoneName: 'short' });
  outRelative.textContent = relativeTime(ms);
}

function renderDateToUnix() {
  const raw = dateInput.value;
  const outputs = [outUnixSeconds, outUnixMs];
  if (!raw) {
    setPlaceholders(outputs);
    return;
  }
  // datetime-local strings have no timezone; append Z to reinterpret as UTC, otherwise Date parses it as local.
  const date = utcCheckbox.checked ? new Date(`${raw}Z`) : new Date(raw);
  if (isNaN(date.getTime())) {
    setPlaceholders(outputs);
    return;
  }
  outUnixSeconds.textContent = String(Math.floor(date.getTime() / 1000));
  outUnixMs.textContent = String(date.getTime());
}

useNowBtn.addEventListener('click', () => {
  unixInput.value = String(Date.now());
  renderUnixToDate();
});

unixInput.addEventListener('input', renderUnixToDate);
dateInput.addEventListener('input', renderDateToUnix);
utcCheckbox.addEventListener('change', renderDateToUnix);

document.querySelectorAll('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const target = document.getElementById(btn.dataset.target);
    const text = target.textContent;
    if (!text || text === PLACEHOLDER) return;
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1200);
  });
});

updateNow();
setInterval(updateNow, 1000);
renderUnixToDate();
renderDateToUnix();
