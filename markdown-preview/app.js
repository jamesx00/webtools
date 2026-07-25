const editorEl  = document.getElementById('editor');
const previewEl = document.getElementById('preview');
const copyBtn   = document.getElementById('copyBtn');

const DEFAULT_MARKDOWN = `# Markdown Preview

A **live** preview of _italic_, **bold** text, and \`inline code\`.

## Features

- Headers, lists, and links
- Live preview as you type
- Fenced code blocks

1. First item
2. Second item

> Blockquotes render like this.

Check out [webtools](../) for more tools.

\`\`\`js
function hello() {
  console.log("Hello, Markdown!");
}
\`\`\`
`;

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyEmphasisAndLinks(text) {
  text = text.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = /^javascript:/i.test(url) ? '#' : url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+?)_/g, '<em>$1</em>');

  return text;
}

function inline(text) {
  return text
    .split(/(`[^`]+?`)/g)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length >= 2
        ? `<code>${part.slice(1, -1)}</code>`
        : applyEmphasisAndLinks(part)
    )
    .join('');
}

const RE_FENCE  = /^```/;
const RE_HR     = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_HEADER = /^(#{1,6})\s+(.*)$/;
const RE_QUOTE  = /^&gt;\s?/;
const RE_UL     = /^[-*]\s+/;
const RE_OL     = /^\d+\.\s+/;
const RE_BLANK  = /^\s*$/;

function isBlockStart(line) {
  return (
    RE_BLANK.test(line) ||
    RE_FENCE.test(line) ||
    RE_HR.test(line) ||
    RE_HEADER.test(line) ||
    RE_QUOTE.test(line) ||
    RE_UL.test(line) ||
    RE_OL.test(line)
  );
}

function parseBlocks(escaped) {
  const lines = escaped.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (RE_BLANK.test(line)) {
      i++;
      continue;
    }

    if (RE_FENCE.test(line)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !RE_FENCE.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      html += `<pre><code>${codeLines.join('\n')}</code></pre>\n`;
      continue;
    }

    if (RE_HR.test(line)) {
      html += '<hr>\n';
      i++;
      continue;
    }

    const headerMatch = line.match(RE_HEADER);
    if (headerMatch) {
      const level = headerMatch[1].length;
      html += `<h${level}>${inline(headerMatch[2])}</h${level}>\n`;
      i++;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const quoteLines = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) {
        quoteLines.push(lines[i].replace(RE_QUOTE, ''));
        i++;
      }
      html += `<blockquote><p>${quoteLines.map(inline).join('<br>')}</p></blockquote>\n`;
      continue;
    }

    if (RE_UL.test(line)) {
      const items = [];
      while (i < lines.length && RE_UL.test(lines[i])) {
        items.push(lines[i].replace(RE_UL, ''));
        i++;
      }
      html += `<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>\n`;
      continue;
    }

    if (RE_OL.test(line)) {
      const items = [];
      while (i < lines.length && RE_OL.test(lines[i])) {
        items.push(lines[i].replace(RE_OL, ''));
        i++;
      }
      html += `<ol>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>\n`;
      continue;
    }

    const paraLines = [];
    while (i < lines.length && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    html += `<p>${paraLines.map(inline).join('<br>')}</p>\n`;
  }

  return html;
}

function renderMarkdown(src) {
  return parseBlocks(escapeHtml(src));
}

let debounceTimer = null;
function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 100);
}

function render() {
  previewEl.innerHTML = renderMarkdown(editorEl.value);
}

editorEl.addEventListener('input', scheduleRender);

copyBtn.addEventListener('click', async () => {
  const html = renderMarkdown(editorEl.value);
  await navigator.clipboard.writeText(html);
  const original = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.textContent = original; }, 1200);
});

editorEl.value = DEFAULT_MARKDOWN;
render();
