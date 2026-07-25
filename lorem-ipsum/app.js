const LOREM_WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor
in reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint
occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum`
  .split(/\s+/);

const CLASSIC_OPENER = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin',
];

const STREET_NAMES = [
  'Maple', 'Oak', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lincoln', 'Sunset', 'Highland', 'Willow',
];

const STREET_SUFFIXES = ['St', 'Ave', 'Rd', 'Blvd', 'Ln'];

const CITY_NAMES = [
  'Springfield', 'Fairview', 'Riverside', 'Franklin', 'Greenville', 'Salem', 'Madison',
  'Georgetown', 'Clinton', 'Arlington',
];

const COMPANY_FRAGMENTS = [
  'Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Wonka', 'Soylent', 'Hooli', 'Massive',
];

const COMPANY_SUFFIXES = [
  'Inc.', 'LLC', 'Group', 'Co.', 'Partners', 'Solutions', 'Industries', 'Corp.', 'Holdings', 'Labs',
];

const EMAIL_DOMAINS = [
  'example.com', 'mail.com', 'inbox.com', 'workmail.com', 'fastmail.com',
  'protonmail.com', 'zonemail.com', 'coldmail.com', 'skymail.com', 'netpost.com',
];

const MAX_LOREM_COUNT = 500;
const MAX_FAKE_ROWS = 200;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateWordsMode(count) {
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(i < CLASSIC_OPENER.length ? CLASSIC_OPENER[i] : randomItem(LOREM_WORDS));
  }
  return capitalizeFirst(words.join(' '));
}

function generateSentence(forceClassicStart) {
  const length = randomInt(6, 14);
  const words = [];
  if (forceClassicStart) {
    words.push(...CLASSIC_OPENER);
  }
  while (words.length < length) {
    words.push(randomItem(LOREM_WORDS));
  }
  return `${capitalizeFirst(words.join(' '))}.`;
}

function generateSentencesMode(count) {
  const sentences = [];
  for (let i = 0; i < count; i++) {
    sentences.push(generateSentence(i === 0));
  }
  return sentences.join(' ');
}

function generateParagraph(forceClassicStart) {
  const sentenceCount = randomInt(3, 8);
  const sentences = [];
  for (let i = 0; i < sentenceCount; i++) {
    sentences.push(generateSentence(forceClassicStart && i === 0));
  }
  return sentences.join(' ');
}

function generateParagraphsMode(count) {
  const paragraphs = [];
  for (let i = 0; i < count; i++) {
    paragraphs.push(generateParagraph(i === 0));
  }
  return paragraphs.join('\n\n');
}

function generateLorem(unit, count) {
  const n = Math.max(1, Math.min(count, MAX_LOREM_COUNT));
  if (unit === 'words') return generateWordsMode(n);
  if (unit === 'sentences') return generateSentencesMode(n);
  return generateParagraphsMode(n);
}

function generatePerson() {
  const first = randomItem(FIRST_NAMES);
  const last = randomItem(LAST_NAMES);
  const domain = randomItem(EMAIL_DOMAINS);
  const streetNumber = randomInt(1, 99999);
  return {
    fullName: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
    phone: `(555) ${randomInt(100, 999)}-${String(randomInt(0, 9999)).padStart(4, '0')}`,
    street: `${streetNumber} ${randomItem(STREET_NAMES)} ${randomItem(STREET_SUFFIXES)}`,
    city: randomItem(CITY_NAMES),
    company: `${randomItem(COMPANY_FRAGMENTS)} ${randomItem(COMPANY_SUFFIXES)}`,
  };
}

function csvField(value) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowsToCsv(rows) {
  const header = ['Full Name', 'Email', 'Phone', 'Street Address', 'City', 'Company'];
  const lines = [header.map(csvField).join(',')];
  rows.forEach((row) => {
    lines.push(
      [row.fullName, row.email, row.phone, row.street, row.city, row.company]
        .map(csvField)
        .join(','),
    );
  });
  return lines.join('\n');
}

async function flashCopied(btn) {
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1200);
}

const tabsEl = document.getElementById('tabs');
const loremPanel = document.getElementById('loremPanel');
const fakePanel = document.getElementById('fakePanel');

const loremUnitEl = document.getElementById('loremUnit');
const loremCountEl = document.getElementById('loremCount');
const loremGenerateBtn = document.getElementById('loremGenerate');
const loremOutputEl = document.getElementById('loremOutput');
const loremCopyBtn = document.getElementById('loremCopy');

const fakeRowsEl = document.getElementById('fakeRows');
const fakeGenerateBtn = document.getElementById('fakeGenerate');
const fakeCopyCsvBtn = document.getElementById('fakeCopyCsv');
const fakeTableBody = document.getElementById('fakeTableBody');

let currentFakeRows = [];

function setMode(mode) {
  [...tabsEl.children].forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('tab--active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  loremPanel.hidden = mode !== 'lorem';
  fakePanel.hidden = mode !== 'fake';
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) setMode(tab.dataset.mode);
});

loremGenerateBtn.addEventListener('click', () => {
  const unit = loremUnitEl.value;
  const count = parseInt(loremCountEl.value, 10) || 1;
  loremOutputEl.value = generateLorem(unit, count);
});

loremCopyBtn.addEventListener('click', async () => {
  if (!loremOutputEl.value) return;
  await navigator.clipboard.writeText(loremOutputEl.value);
  flashCopied(loremCopyBtn);
});

function renderFakeTable(rows) {
  fakeTableBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    [row.fullName, row.email, row.phone, row.street, row.city, row.company].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    fakeTableBody.appendChild(tr);
  });
}

fakeGenerateBtn.addEventListener('click', () => {
  const count = Math.max(1, Math.min(parseInt(fakeRowsEl.value, 10) || 1, MAX_FAKE_ROWS));
  currentFakeRows = Array.from({ length: count }, generatePerson);
  renderFakeTable(currentFakeRows);
});

fakeCopyCsvBtn.addEventListener('click', async () => {
  if (!currentFakeRows.length) return;
  await navigator.clipboard.writeText(rowsToCsv(currentFakeRows));
  flashCopied(fakeCopyCsvBtn);
});

loremOutputEl.value = generateLorem(loremUnitEl.value, parseInt(loremCountEl.value, 10));
