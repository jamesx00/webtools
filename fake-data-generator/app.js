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

const STATE_CODES = [
  'CA', 'NY', 'TX', 'FL', 'WA', 'IL', 'PA', 'OH', 'GA', 'NC',
];

const COUNTRY_NAMES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany',
  'France', 'Japan', 'Brazil', 'India', 'Mexico',
];

const COMPANY_FRAGMENTS = [
  'Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Wonka', 'Soylent', 'Hooli', 'Massive',
];

const COMPANY_SUFFIXES = [
  'Inc.', 'LLC', 'Group', 'Co.', 'Partners', 'Solutions', 'Industries', 'Corp.', 'Holdings', 'Labs',
];

const JOB_TITLES = [
  'Software Engineer', 'Product Manager', 'Data Analyst', 'Marketing Specialist',
  'Sales Representative', 'Graphic Designer', 'Project Manager', 'Customer Support',
  'HR Coordinator', 'Financial Analyst',
];

const EMAIL_DOMAINS = [
  'example.com', 'mail.com', 'inbox.com', 'workmail.com', 'fastmail.com',
  'protonmail.com', 'zonemail.com', 'coldmail.com', 'skymail.com', 'netpost.com',
];

const FIELDS = [
  { id: 'fullName', label: 'Full Name' },
  { id: 'firstName', label: 'First Name' },
  { id: 'lastName', label: 'Last Name' },
  { id: 'email', label: 'Email' },
  { id: 'username', label: 'Username' },
  { id: 'phone', label: 'Phone' },
  { id: 'street', label: 'Street Address' },
  { id: 'city', label: 'City' },
  { id: 'state', label: 'State' },
  { id: 'zip', label: 'Zip Code' },
  { id: 'country', label: 'Country' },
  { id: 'company', label: 'Company' },
  { id: 'jobTitle', label: 'Job Title' },
  { id: 'dob', label: 'Date of Birth' },
  { id: 'age', label: 'Age' },
  { id: 'ip', label: 'IP Address' },
  { id: 'uuid', label: 'UUID' },
];

const DEFAULT_FIELD_IDS = new Set(['fullName', 'email', 'phone', 'street', 'city', 'company']);

const MAX_FAKE_ROWS = 200;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function generatePerson() {
  const first = randomItem(FIRST_NAMES);
  const last = randomItem(LAST_NAMES);
  const domain = randomItem(EMAIL_DOMAINS);
  const streetNumber = randomInt(1, 99999);
  const dob = randomDate(new Date(1950, 0, 1), new Date(2005, 11, 31));
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear = (now.getMonth() > dob.getMonth())
    || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age--;

  return {
    fullName: `${first} ${last}`,
    firstName: first,
    lastName: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
    username: `${first.toLowerCase()}${last.toLowerCase()}${randomInt(1, 999)}`,
    phone: `(555) ${randomInt(100, 999)}-${String(randomInt(0, 9999)).padStart(4, '0')}`,
    street: `${streetNumber} ${randomItem(STREET_NAMES)} ${randomItem(STREET_SUFFIXES)}`,
    city: randomItem(CITY_NAMES),
    state: randomItem(STATE_CODES),
    zip: String(randomInt(10000, 99999)),
    country: randomItem(COUNTRY_NAMES),
    company: `${randomItem(COMPANY_FRAGMENTS)} ${randomItem(COMPANY_SUFFIXES)}`,
    jobTitle: randomItem(JOB_TITLES),
    dob: formatDate(dob),
    age: String(age),
    ip: `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}`,
    uuid: crypto.randomUUID(),
  };
}

function csvField(value) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowsToCsv(rows, fields) {
  const lines = [fields.map((f) => csvField(f.label)).join(',')];
  rows.forEach((row) => {
    lines.push(fields.map((f) => csvField(row[f.id])).join(','));
  });
  return lines.join('\n');
}

async function flashCopied(btn) {
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1200);
}

const fieldSelectGrid = document.getElementById('fieldSelectGrid');
const fieldsSelectAllBtn = document.getElementById('fieldsSelectAll');
const fieldsSelectNoneBtn = document.getElementById('fieldsSelectNone');
const fakeRowsEl = document.getElementById('fakeRows');
const fakeGenerateBtn = document.getElementById('fakeGenerate');
const fakeCopyCsvBtn = document.getElementById('fakeCopyCsv');
const fakeErrorEl = document.getElementById('fakeError');
const fakeTableHead = document.getElementById('fakeTableHead');
const fakeTableBody = document.getElementById('fakeTableBody');

let currentFakeRows = [];

FIELDS.forEach((field) => {
  const label = document.createElement('label');
  label.className = 'field-checkbox';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = field.id;
  input.checked = DEFAULT_FIELD_IDS.has(field.id);
  label.appendChild(input);
  label.appendChild(document.createTextNode(field.label));
  fieldSelectGrid.appendChild(label);
});

function getSelectedFields() {
  const checked = new Set(
    [...fieldSelectGrid.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value),
  );
  return FIELDS.filter((f) => checked.has(f.id));
}

function setAllFields(checked) {
  fieldSelectGrid.querySelectorAll('input[type="checkbox"]').forEach((el) => { el.checked = checked; });
}

fieldsSelectAllBtn.addEventListener('click', () => setAllFields(true));
fieldsSelectNoneBtn.addEventListener('click', () => setAllFields(false));

function renderFakeTable(rows, fields) {
  fakeTableHead.innerHTML = '';
  const headRow = document.createElement('tr');
  fields.forEach((f) => {
    const th = document.createElement('th');
    th.textContent = f.label;
    headRow.appendChild(th);
  });
  fakeTableHead.appendChild(headRow);

  fakeTableBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    fields.forEach((f) => {
      const td = document.createElement('td');
      td.textContent = row[f.id];
      tr.appendChild(td);
    });
    fakeTableBody.appendChild(tr);
  });
}

fakeGenerateBtn.addEventListener('click', () => {
  const fields = getSelectedFields();
  if (!fields.length) {
    fakeErrorEl.hidden = false;
    return;
  }
  fakeErrorEl.hidden = true;
  const count = Math.max(1, Math.min(parseInt(fakeRowsEl.value, 10) || 1, MAX_FAKE_ROWS));
  currentFakeRows = Array.from({ length: count }, generatePerson);
  renderFakeTable(currentFakeRows, fields);
});

fakeCopyCsvBtn.addEventListener('click', async () => {
  if (!currentFakeRows.length) return;
  await navigator.clipboard.writeText(rowsToCsv(currentFakeRows, getSelectedFields()));
  flashCopied(fakeCopyCsvBtn);
});

fakeGenerateBtn.click();
