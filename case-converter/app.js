const inputEl   = document.getElementById('input');
const resultsEl = document.getElementById('results');

function tokenize(str) {
  if (!str) return [];
  const spaced = str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  return spaced ? spaced.split(/\s+/) : [];
}

const lower = (w) => w.toLowerCase();
const upper = (w) => w.toUpperCase();
const capitalize = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

function sentenceCase(tokens) {
  if (!tokens.length) return '';
  const words = tokens.map(lower);
  words[0] = capitalize(words[0]);
  return words.join(' ');
}

const CASES = [
  { id: 'slug', label: 'Slug', run: (raw, tokens) => tokens.map(lower).join('-') },
  { id: 'camel', label: 'camelCase', run: (raw, tokens) => tokens.map((t, i) => (i === 0 ? lower(t) : capitalize(t))).join('') },
  { id: 'pascal', label: 'PascalCase', run: (raw, tokens) => tokens.map(capitalize).join('') },
  { id: 'snake', label: 'snake_case', run: (raw, tokens) => tokens.map(lower).join('_') },
  { id: 'kebab', label: 'kebab-case', run: (raw, tokens) => tokens.map(lower).join('-') },
  { id: 'constant', label: 'CONSTANT_CASE', run: (raw, tokens) => tokens.map(upper).join('_') },
  { id: 'title', label: 'Title Case', run: (raw, tokens) => tokens.map(capitalize).join(' ') },
  { id: 'sentence', label: 'Sentence case', run: (raw, tokens) => sentenceCase(tokens) },
  { id: 'upper', label: 'UPPERCASE', run: (raw) => raw.toUpperCase() },
  { id: 'lower', label: 'lowercase', run: (raw) => raw.toLowerCase() },
];

const rows = CASES.map((c) => {
  const row = document.createElement('div');
  row.className = 'result-row';

  const head = document.createElement('div');
  head.className = 'result-row__head';

  const label = document.createElement('span');
  label.className = 'control-label';
  label.textContent = c.label;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn--secondary btn--sm';
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy';

  head.appendChild(label);
  head.appendChild(copyBtn);

  const output = document.createElement('input');
  output.className = 'textarea result-row__output';
  output.type = 'text';
  output.readOnly = true;

  copyBtn.addEventListener('click', async () => {
    if (!output.value) return;
    await navigator.clipboard.writeText(output.value);
    const original = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = original; }, 1200);
  });

  row.appendChild(head);
  row.appendChild(output);
  resultsEl.appendChild(row);

  return { case: c, output };
});

function render() {
  const raw = inputEl.value;
  const tokens = tokenize(raw);
  rows.forEach(({ case: c, output }) => {
    output.value = raw ? c.run(raw, tokens) : '';
  });
}

inputEl.addEventListener('input', render);

render();
