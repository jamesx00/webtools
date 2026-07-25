const textA = document.getElementById('textA');
const textB = document.getElementById('textB');
const statsA = document.getElementById('statsA');
const statsB = document.getElementById('statsB');
const diffOutput = document.getElementById('diffOutput');
const compareBtn = document.getElementById('compareBtn');
const swapBtn = document.getElementById('swapBtn');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function countStats(text) {
  const chars = text.length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const lines = text === '' ? 0 : text.split('\n').length;
  return { words, chars, lines };
}

function updateStats(el, statsEl) {
  const { words, chars, lines } = countStats(el.value);
  statsEl.textContent = `${words} words · ${chars} chars · ${lines} lines`;
}

function toLines(text) {
  return text === '' ? [] : text.split('\n');
}

function buildLcsTable(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

function diffLines(a, b) {
  const dp = buildLcsTable(a, b);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', text: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < a.length) {
    ops.push({ type: 'remove', text: a[i] });
    i++;
  }
  while (j < b.length) {
    ops.push({ type: 'add', text: b[j] });
    j++;
  }
  return ops;
}

function markerFor(type) {
  if (type === 'add') return '+';
  if (type === 'remove') return '-';
  return '';
}

function renderDiff(ops) {
  if (ops.length === 0) {
    diffOutput.innerHTML = '<p class="diff-empty">Both texts are empty.</p>';
    return;
  }
  const html = ops
    .map((op) => {
      const marker = markerFor(op.type);
      const text = escapeHtml(op.text);
      return `<div class="diff-line diff-line--${op.type}"><span class="diff-gutter">${marker}</span><span class="diff-text">${text || '&nbsp;'}</span></div>`;
    })
    .join('');
  diffOutput.innerHTML = html;
}

function compare() {
  const aLines = toLines(textA.value);
  const bLines = toLines(textB.value);
  const ops = diffLines(aLines, bLines);
  renderDiff(ops);
}

function swap() {
  const tmp = textA.value;
  textA.value = textB.value;
  textB.value = tmp;
  updateStats(textA, statsA);
  updateStats(textB, statsB);
}

textA.addEventListener('input', () => updateStats(textA, statsA));
textB.addEventListener('input', () => updateStats(textB, statsB));
compareBtn.addEventListener('click', compare);
swapBtn.addEventListener('click', swap);

updateStats(textA, statsA);
updateStats(textB, statsB);
diffOutput.innerHTML = '<p class="diff-empty">Click Compare to see differences.</p>';
