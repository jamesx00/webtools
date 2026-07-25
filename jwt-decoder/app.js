const inputEl        = document.getElementById('input');
const errorEl         = document.getElementById('error');
const resultEl        = document.getElementById('result');
const headerOutputEl  = document.getElementById('headerOutput');
const payloadOutputEl = document.getElementById('payloadOutput');
const signatureOutputEl = document.getElementById('signatureOutput');
const claimsFieldEl   = document.getElementById('claimsField');
const claimsInfoEl    = document.getElementById('claimsInfo');

const TIME_CLAIMS = ['exp', 'iat', 'nbf'];

function base64UrlDecode(segment) {
  let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = base64.length % 4;
  if (padLength === 2) base64 += '==';
  else if (padLength === 3) base64 += '=';
  else if (padLength !== 0) throw new Error('Invalid base64url segment');

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function decodeSegment(segment) {
  return JSON.parse(base64UrlDecode(segment));
}

function formatClaim(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  let line = `${name}: ${value} → ${date.toUTCString()}`;
  if (name === 'exp') {
    line += date.getTime() < Date.now() ? ' (expired)' : ' (valid)';
  }
  return line;
}

function renderClaims(payload) {
  claimsInfoEl.textContent = '';
  let count = 0;
  TIME_CLAIMS.forEach((name) => {
    if (!(name in payload)) return;
    const line = formatClaim(name, payload[name]);
    if (!line) return;
    const p = document.createElement('p');
    p.className = 'claim-line';
    p.textContent = line;
    claimsInfoEl.appendChild(p);
    count += 1;
  });
  claimsFieldEl.hidden = count === 0;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

function decodeToken() {
  hideError();
  const token = inputEl.value.trim();

  if (!token) {
    resultEl.hidden = true;
    return;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    resultEl.hidden = true;
    showError('A JWT needs three dot-separated segments: header.payload.signature');
    return;
  }

  const [headerSeg, payloadSeg, signatureSeg] = parts;
  if (!headerSeg || !payloadSeg || !signatureSeg) {
    resultEl.hidden = true;
    showError('One or more segments are empty');
    return;
  }

  let header;
  let payload;
  try {
    header = decodeSegment(headerSeg);
  } catch {
    resultEl.hidden = true;
    showError('Could not decode the header — invalid base64url or JSON');
    return;
  }
  try {
    payload = decodeSegment(payloadSeg);
  } catch {
    resultEl.hidden = true;
    showError('Could not decode the payload — invalid base64url or JSON');
    return;
  }

  headerOutputEl.textContent = JSON.stringify(header, null, 2);
  payloadOutputEl.textContent = JSON.stringify(payload, null, 2);
  signatureOutputEl.textContent = signatureSeg;
  renderClaims(payload && typeof payload === 'object' ? payload : {});
  resultEl.hidden = false;
}

let debounceTimer;
inputEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(decodeToken, 150);
});

document.querySelectorAll('[data-copy-target]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const target = document.getElementById(btn.dataset.copyTarget);
    if (!target || !target.textContent) return;
    await navigator.clipboard.writeText(target.textContent);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1200);
  });
});
