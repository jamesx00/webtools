const cronInput       = document.getElementById('cronInput');
const errorEl         = document.getElementById('error');
const descriptionField = document.getElementById('descriptionField');
const descriptionEl   = document.getElementById('description');
const runsField       = document.getElementById('runsField');
const runListEl       = document.getElementById('runList');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FIELD_DEFS = [
  { key: 'minute', min: 0, max: 59, label: 'minute', unit: 'minute' },
  { key: 'hour', min: 0, max: 23, label: 'hour', unit: 'hour' },
  { key: 'dom', min: 1, max: 31, label: 'day-of-month', unit: 'day-of-month' },
  { key: 'month', min: 1, max: 12, label: 'month', unit: 'month' },
  { key: 'dow', min: 0, max: 6, label: 'day-of-week', unit: 'day-of-week' },
];

const MAX_SEARCH_MINUTES = 2 * 365 * 24 * 60;

function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function joinWithAnd(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function parseField(fieldStr, min, max) {
  const rawParts = fieldStr.split(',').map(p => p.trim());
  if (rawParts.some(p => p === '')) {
    throw new Error(`empty value in "${fieldStr}"`);
  }

  const values = new Set();
  const parts = [];

  for (const raw of rawParts) {
    let stepStr = null;
    let rangeStr = raw;
    const slashIdx = raw.indexOf('/');
    if (slashIdx !== -1) {
      rangeStr = raw.slice(0, slashIdx);
      stepStr = raw.slice(slashIdx + 1);
    }

    let step = 1;
    if (stepStr !== null) {
      if (!/^\d+$/.test(stepStr)) throw new Error(`invalid step in "${raw}"`);
      step = parseInt(stepStr, 10);
      if (step <= 0) throw new Error(`step must be a positive integer in "${raw}"`);
    }

    let a, b, type;
    if (rangeStr === '*') {
      a = min;
      b = max;
      type = stepStr !== null ? 'starStep' : 'star';
    } else if (rangeStr.includes('-')) {
      const dashIdx = rangeStr.indexOf('-');
      const aStr = rangeStr.slice(0, dashIdx);
      const bStr = rangeStr.slice(dashIdx + 1);
      if (!/^\d+$/.test(aStr) || !/^\d+$/.test(bStr)) throw new Error(`invalid range "${rangeStr}"`);
      a = parseInt(aStr, 10);
      b = parseInt(bStr, 10);
      if (a < min || a > max || b < min || b > max) {
        throw new Error(`value out of range in "${rangeStr}" (expected ${min}-${max})`);
      }
      if (a > b) throw new Error(`range start must not exceed end in "${rangeStr}"`);
      type = stepStr !== null ? 'rangeStep' : 'range';
    } else {
      if (!/^\d+$/.test(rangeStr)) throw new Error(`invalid value "${rangeStr}"`);
      a = parseInt(rangeStr, 10);
      if (a < min || a > max) throw new Error(`value ${a} out of range (expected ${min}-${max})`);
      if (stepStr !== null) {
        b = max;
        type = 'rangeStep';
      } else {
        b = a;
        type = 'single';
      }
    }

    if (type === 'single') {
      values.add(a);
    } else {
      for (let v = a; v <= b; v += step) values.add(v);
    }
    parts.push({ type, a, b, step });
  }

  return { parts, values };
}

function parseCron(expr) {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}`);
  }

  const cron = {};
  FIELD_DEFS.forEach((def, i) => {
    try {
      cron[def.key] = parseField(fields[i], def.min, def.max);
    } catch (err) {
      throw new Error(`${def.label} field: ${err.message}`);
    }
  });
  return cron;
}

function isRestricted(parts) {
  return !(parts.length === 1 && parts[0].type === 'star');
}

function phraseForField(field, unit, valueName) {
  const parts = field.parts;
  if (parts.length === 1) {
    const p = parts[0];
    switch (p.type) {
      case 'star':
        return `every ${unit}`;
      case 'starStep':
        return p.step === 1 ? `every ${unit}` : `every ${ordinal(p.step)} ${unit}`;
      case 'single':
        return `${unit} ${valueName(p.a)}`;
      case 'range':
        return `every ${unit} from ${valueName(p.a)} through ${valueName(p.b)}`;
      case 'rangeStep':
        return p.step === 1
          ? `every ${unit} from ${valueName(p.a)} through ${valueName(p.b)}`
          : `every ${ordinal(p.step)} ${unit} from ${valueName(p.a)} through ${valueName(p.b)}`;
      default:
        return unit;
    }
  }

  const fragments = parts.map(p => {
    switch (p.type) {
      case 'star':
        return `every ${unit}`;
      case 'starStep':
        return p.step === 1 ? `every ${unit}` : `every ${ordinal(p.step)} ${unit}`;
      case 'single':
        return valueName(p.a);
      case 'range':
        return `${valueName(p.a)} through ${valueName(p.b)}`;
      case 'rangeStep':
        return p.step === 1
          ? `${valueName(p.a)} through ${valueName(p.b)}`
          : `${valueName(p.a)} through ${valueName(p.b)} every ${ordinal(p.step)}`;
      default:
        return '';
    }
  });
  return `${unit} ${joinWithAnd(fragments)}`;
}

function describeCron(cron) {
  const minutePhrase = phraseForField(cron.minute, 'minute', v => String(v));
  const hourPhrase = phraseForField(cron.hour, 'hour', v => String(v));
  const domPhrase = phraseForField(cron.dom, 'day-of-month', v => String(v));
  const monthPhrase = phraseForField(cron.month, 'month', v => MONTH_NAMES[v - 1]);
  const dowPhrase = phraseForField(cron.dow, 'day-of-week', v => DOW_NAMES[v]);

  const domRestricted = isRestricted(cron.dom.parts);
  const monthRestricted = isRestricted(cron.month.parts);
  const dowRestricted = isRestricted(cron.dow.parts);

  let desc = `At ${minutePhrase} past ${hourPhrase}`;

  const extra = [];
  if (domRestricted) extra.push(`on ${domPhrase}`);
  if (monthRestricted) extra.push(`in ${monthPhrase}`);
  if (dowRestricted) extra.push(`on ${dowPhrase}`);

  if (extra.length) {
    const soloTrailingDow = extra.length === 1 && dowRestricted && !domRestricted && !monthRestricted;
    desc += (soloTrailingDow ? ' ' : ', ') + extra.join(', ');
  }

  return `${desc}.`;
}

function matchesCron(cron, date) {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1;
  const dow = date.getDay();

  if (!cron.minute.values.has(minute)) return false;
  if (!cron.hour.values.has(hour)) return false;
  if (!cron.month.values.has(month)) return false;

  const domRestricted = isRestricted(cron.dom.parts);
  const dowRestricted = isRestricted(cron.dow.parts);

  if (domRestricted && dowRestricted) {
    return cron.dom.values.has(dom) || cron.dow.values.has(dow);
  }
  if (domRestricted) return cron.dom.values.has(dom);
  if (dowRestricted) return cron.dow.values.has(dow);
  return true;
}

function nextRuns(cron, count) {
  const results = [];
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  // Capped so an impossible expression (e.g. day-of-month 31 in February
  // every year) fails fast instead of looping forever.
  for (let steps = 0; steps < MAX_SEARCH_MINUTES && results.length < count; steps++) {
    if (matchesCron(cron, d)) {
      results.push(new Date(d));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return results;
}

function formatRunTime(date) {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.textContent = '';
  errorEl.hidden = true;
}

function clearResults() {
  descriptionField.hidden = true;
  runsField.hidden = true;
  descriptionEl.textContent = '';
  runListEl.replaceChildren();
}

function renderRuns(runs) {
  runListEl.replaceChildren();
  if (runs.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No matching run times found in the next 2 years.';
    runListEl.appendChild(li);
    return;
  }
  for (const run of runs) {
    const li = document.createElement('li');
    li.textContent = formatRunTime(run);
    runListEl.appendChild(li);
  }
}

function process() {
  const expr = cronInput.value.trim();
  hideError();

  if (expr === '') {
    clearResults();
    return;
  }

  let cron;
  try {
    cron = parseCron(expr);
  } catch (err) {
    clearResults();
    showError(err.message);
    return;
  }

  descriptionEl.textContent = describeCron(cron);
  descriptionField.hidden = false;

  renderRuns(nextRuns(cron, 5));
  runsField.hidden = false;
}

let debounceTimer = null;
cronInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(process, 150);
});
