const dropzone  = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const resultEl  = document.getElementById('result');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const spinner    = document.getElementById('spinner');
const hashList   = document.getElementById('hashList');

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', e => {
  if (!dropzone.contains(e.relatedTarget)) {
    dropzone.classList.remove('dragover');
  }
});
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) hashFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) hashFile(file);
  fileInput.value = '';
});

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function renderRows() {
  hashList.innerHTML = '';
  ALGORITHMS.forEach(algo => {
    const row = document.createElement('div');
    row.className = 'hash-row';
    row.id = `row-${algo}`;

    const label = document.createElement('span');
    label.className = 'hash-row__label';
    label.textContent = algo;

    const value = document.createElement('code');
    value.className = 'hash-row__value';
    value.id = `value-${algo}`;
    value.textContent = 'Computing…';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn--secondary btn--sm';
    copyBtn.textContent = 'Copy';
    copyBtn.disabled = true;
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(value.textContent);
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = original; }, 1200);
    });

    row.append(label, value, copyBtn);
    hashList.appendChild(row);
  });
}

async function hashFile(file) {
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  resultEl.hidden = false;
  spinner.hidden = false;
  renderRows();

  const buffer = await file.arrayBuffer();

  await Promise.all(ALGORITHMS.map(async algo => {
    const digest = await crypto.subtle.digest(algo, buffer);
    const hex = bufferToHex(digest);
    const valueEl = document.getElementById(`value-${algo}`);
    const row = document.getElementById(`row-${algo}`);
    if (!valueEl || !row) return;
    valueEl.textContent = hex;
    row.querySelector('.btn').disabled = false;
  }));

  spinner.hidden = true;
}
