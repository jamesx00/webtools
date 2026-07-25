const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?';
const AMBIGUOUS = new Set('il1Lo0O');

const WORDLIST = [
  'apple', 'river', 'cloud', 'stone', 'tiger', 'eagle', 'forest', 'garden', 'castle', 'bridge',
  'candle', 'dragon', 'feather', 'harbor', 'island', 'jungle', 'kitten', 'lantern', 'meadow', 'ocean',
  'planet', 'rabbit', 'sunset', 'temple', 'valley', 'willow', 'yellow', 'anchor', 'breeze', 'canyon',
  'desert', 'falcon', 'iceberg', 'kingdom', 'lagoon', 'marble', 'pebble', 'ribbon', 'saddle', 'thunder',
  'velvet', 'walnut', 'blossom', 'cabin', 'dolphin', 'flame', 'grove', 'hollow', 'ivory', 'jewel',
  'koala', 'lemon', 'mango', 'nectar', 'orbit', 'panda', 'quilt', 'raven', 'silver', 'tulip',
  'violet', 'whisper', 'amber', 'basil', 'cedar', 'dune', 'ember', 'fable', 'granite', 'harvest',
  'indigo', 'jubilee', 'kayak', 'lily', 'maple', 'noodle', 'olive', 'penny', 'quokka', 'ridge',
  'summit', 'toast', 'umber', 'violin', 'walrus', 'xenon', 'yonder', 'zebra', 'acorn', 'badge',
  'copper', 'daisy', 'sapling', 'ferry', 'gable', 'honey', 'inlet', 'jacket', 'kettle', 'lemur',
  'mint', 'nugget', 'onyx', 'puzzle', 'quartz', 'raccoon', 'sable', 'timber', 'unity', 'vapor',
  'wander', 'yolk', 'zenith', 'blanket', 'candy', 'drizzle', 'engine', 'frost', 'gravel', 'hammer',
  'igloo', 'jigsaw', 'kernel', 'ladder', 'muffin', 'nickel', 'orchid', 'pickle', 'quiet', 'ripple',
  'sailor', 'trumpet', 'canvas', 'vessel', 'wagon', 'yarn', 'zeppelin', 'basket', 'chimney', 'domino',
  'ellipse', 'fiddle', 'gadget', 'hazel', 'jelly', 'kilo', 'lobster', 'mosaic', 'napkin', 'oyster',
  'pillow', 'wallaby', 'rocket', 'sponge', 'trolley', 'utopia', 'wildcat', 'winter', 'yodel', 'zipper',
  'almond', 'biscuit', 'cactus', 'diamond', 'emerald', 'firefly', 'giraffe', 'hedgehog', 'iris', 'juniper',
  'ketchup', 'lighthouse', 'magnet', 'noble', 'orange', 'parrot', 'cinnamon', 'rooster', 'saffron', 'turtle',
  'urchin', 'volcano', 'wombat', 'yeoman', 'zircon', 'balloon', 'compass', 'stingray', 'cinder', 'flannel',
  'gazelle', 'hummus', 'icicle', 'jester', 'kiosk', 'ladybug', 'marbles', 'nimbus', 'opossum', 'pumpkin',
  'quiver', 'rainbow', 'seashell', 'trinket', 'ukulele', 'vintage', 'whistle', 'xylophone', 'yacht', 'zodiac',
];

const el = (id) => document.getElementById(id);

const tabsEl = el('tabs');
const passwordPanel = el('passwordPanel');
const passphrasePanel = el('passphrasePanel');

const pwLength = el('pwLength');
const pwLengthNumber = el('pwLengthNumber');
const optUpper = el('optUpper');
const optLower = el('optLower');
const optDigits = el('optDigits');
const optSymbols = el('optSymbols');
const optExcludeAmbiguous = el('optExcludeAmbiguous');
const pwGenerate = el('pwGenerate');
const pwOutput = el('pwOutput');
const pwCopy = el('pwCopy');
const pwError = el('pwError');
const pwStrength = el('pwStrength');
const pwBadge = el('pwBadge');
const pwBits = el('pwBits');

const ppWordCount = el('ppWordCount');
const ppWordCountNumber = el('ppWordCountNumber');
const ppSeparator = el('ppSeparator');
const ppCapitalize = el('ppCapitalize');
const ppGenerate = el('ppGenerate');
const ppOutput = el('ppOutput');
const ppCopy = el('ppCopy');
const ppStrength = el('ppStrength');
const ppBadge = el('ppBadge');
const ppBits = el('ppBits');

function secureRandomInt(maxExclusive) {
  const range = maxExclusive >>> 0;
  const limit = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % range;
}

function pickChar(charset) {
  return charset[secureRandomInt(charset.length)];
}

function pickWord() {
  return WORDLIST[secureRandomInt(WORDLIST.length)];
}

function setMode(mode) {
  [...tabsEl.children].forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('tab--active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  passwordPanel.hidden = mode !== 'password';
  passphrasePanel.hidden = mode !== 'passphrase';
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) setMode(tab.dataset.mode);
});

function strengthInfo(bits) {
  if (bits < 40) return { label: 'Weak', cls: 'badge--weak' };
  if (bits < 60) return { label: 'Fair', cls: 'badge--fair' };
  if (bits < 80) return { label: 'Strong', cls: 'badge--strong' };
  return { label: 'Very strong', cls: 'badge--very-strong' };
}

function showStrength(badgeEl, bitsEl, containerEl, bits) {
  const info = strengthInfo(bits);
  badgeEl.textContent = info.label;
  badgeEl.className = `badge ${info.cls}`;
  bitsEl.textContent = `~${Math.round(bits)} bits of entropy`;
  containerEl.hidden = false;
}

function showError(msgEl, message) {
  msgEl.textContent = message;
  msgEl.hidden = false;
}

function hideError(msgEl) {
  msgEl.hidden = true;
}

function syncPair(range, number) {
  range.addEventListener('input', () => { number.value = range.value; });
  number.addEventListener('input', () => { range.value = number.value; });
  number.addEventListener('change', () => { number.value = range.value; });
}

syncPair(pwLength, pwLengthNumber);
syncPair(ppWordCount, ppWordCountNumber);

function buildCharset() {
  let set = '';
  if (optUpper.checked) set += UPPER;
  if (optLower.checked) set += LOWER;
  if (optDigits.checked) set += DIGITS;
  if (optSymbols.checked) set += SYMBOLS;
  if (optExcludeAmbiguous.checked) {
    set = [...set].filter((c) => !AMBIGUOUS.has(c)).join('');
  }
  return set;
}

function generatePassword() {
  hideError(pwError);
  const charset = buildCharset();
  if (!charset) {
    pwOutput.value = '';
    pwStrength.hidden = true;
    showError(pwError, 'Select at least one character type.');
    return;
  }
  const length = Number(pwLength.value);
  let password = '';
  for (let i = 0; i < length; i++) password += pickChar(charset);
  pwOutput.value = password;
  const bits = length * Math.log2(charset.length);
  showStrength(pwBadge, pwBits, pwStrength, bits);
}

function generatePassphrase() {
  const wordCount = Number(ppWordCount.value);
  const separator = ppSeparator.value;
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    const word = pickWord();
    words.push(ppCapitalize.checked ? word[0].toUpperCase() + word.slice(1) : word);
  }
  ppOutput.value = words.join(separator);
  const bits = wordCount * Math.log2(WORDLIST.length);
  showStrength(ppBadge, ppBits, ppStrength, bits);
}

async function copyOutput(outputEl, buttonEl) {
  if (!outputEl.value) return;
  await navigator.clipboard.writeText(outputEl.value);
  const original = buttonEl.textContent;
  buttonEl.textContent = 'Copied!';
  setTimeout(() => { buttonEl.textContent = original; }, 1200);
}

pwGenerate.addEventListener('click', generatePassword);
ppGenerate.addEventListener('click', generatePassphrase);
pwCopy.addEventListener('click', () => copyOutput(pwOutput, pwCopy));
ppCopy.addEventListener('click', () => copyOutput(ppOutput, ppCopy));

setMode('password');
generatePassword();
generatePassphrase();
