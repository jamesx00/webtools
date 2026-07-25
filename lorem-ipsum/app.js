const LOREM_WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor
in reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint
occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum`
  .split(/\s+/);

const CLASSIC_OPENER = ['lorem', 'ipsum', 'dolor', 'sit', 'amet'];

const MAX_LOREM_COUNT = 500;

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

async function flashCopied(btn) {
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1200);
}

const loremUnitEl = document.getElementById('loremUnit');
const loremCountEl = document.getElementById('loremCount');
const loremGenerateBtn = document.getElementById('loremGenerate');
const loremOutputEl = document.getElementById('loremOutput');
const loremCopyBtn = document.getElementById('loremCopy');

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

loremOutputEl.value = generateLorem(loremUnitEl.value, parseInt(loremCountEl.value, 10));
