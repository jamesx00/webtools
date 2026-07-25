const patternEl   = document.getElementById('pattern');
const flagsEl     = document.getElementById('flags');
const testTextEl  = document.getElementById('testText');
const errorEl     = document.getElementById('patternError');
const highlightEl = document.getElementById('highlightOutput');
const matchListEl = document.getElementById('matchList');

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

function getMatches(regex, text) {
  const matches = [];
  if (regex.global) {
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push(m);
      if (m[0] === '') regex.lastIndex++;
    }
  } else {
    const m = regex.exec(text);
    if (m) matches.push(m);
  }
  return matches;
}

function renderHighlight(text, matches) {
  if (!matches.length) {
    highlightEl.innerHTML = `<span class="muted">No matches</span>`;
    return;
  }
  let html = '';
  let cursor = 0;
  for (const m of matches) {
    const start = m.index;
    const end = start + m[0].length;
    html += escapeHtml(text.slice(cursor, start));
    html += `<mark class="match-highlight">${escapeHtml(m[0])}</mark>`;
    cursor = end;
  }
  html += escapeHtml(text.slice(cursor));
  highlightEl.innerHTML = html;
}

function renderMatchList(matches) {
  if (!matches.length) {
    matchListEl.innerHTML = `<p class="muted">No matches</p>`;
    return;
  }

  matchListEl.innerHTML = matches.map((m, i) => {
    const groupRows = [];
    for (let g = 1; g < m.length; g++) {
      if (m[g] !== undefined) groupRows.push([`Group ${g}`, m[g]]);
    }
    if (m.groups) {
      for (const [name, value] of Object.entries(m.groups)) {
        if (value !== undefined) groupRows.push([name, value]);
      }
    }

    const groupsHtml = groupRows.length
      ? `<ul class="match-groups">${groupRows.map(([label, value]) =>
          `<li><span class="match-group__label">${escapeHtml(label)}</span><span class="match-group__value">${escapeHtml(value)}</span></li>`
        ).join('')}</ul>`
      : '';

    return `
      <div class="match-item">
        <div class="match-item__head">
          <span class="match-item__index">#${i}</span>
          <span class="match-item__at">at ${m.index}</span>
          <span class="match-item__text">${escapeHtml(m[0])}</span>
        </div>
        ${groupsHtml}
      </div>
    `;
  }).join('');
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

function clearResults() {
  highlightEl.innerHTML = '';
  matchListEl.innerHTML = '';
}

function run() {
  const pattern = patternEl.value;
  const flags = flagsEl.value;
  const text = testTextEl.value;

  if (!pattern) {
    hideError();
    clearResults();
    return;
  }

  let regex;
  try {
    regex = new RegExp(pattern, flags);
  } catch (err) {
    showError(err.message);
    clearResults();
    return;
  }

  hideError();
  const matches = getMatches(regex, text);
  renderHighlight(text, matches);
  renderMatchList(matches);
}

let debounceTimer;
function scheduleRun() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 150);
}

patternEl.addEventListener('input', scheduleRun);
flagsEl.addEventListener('input', scheduleRun);
testTextEl.addEventListener('input', scheduleRun);

run();
