# webtools

A homepage linking to small client-side tools. All processing happens in the browser — nothing is uploaded.

## Stack

- Vanilla JS (ES modules), HTML, CSS — no framework
- Vite for bundling and dev server (multi-page — see `vite.config.js`)
- `browser-image-compression` — client-side JPEG/PNG/WebP compression
- `jszip` — ZIP generation for batch download
- `qrcode` — client-side QR code generation

## Commands

```bash
npm run dev    # dev server with hot reload at localhost:5173
npm run build  # production build → dist/
```

## Structure

- `/` — home page (`index.html` + `style.css`) listing all tools as cards.
- `/image-compressor/`, `/qr-code/`, `/encode-decode/`, `/color-tools/`, `/file-hash/`, `/json-formatter/`, `/text-diff/`, `/case-converter/`, `/jwt-decoder/`, `/regex-tester/`, `/cron-parser/`, `/timestamp-converter/`, `/markdown-preview/`, `/csv-json/`, `/lorem-ipsum/`, `/fake-data-generator/`, `/uuid-generator/`, `/image-resizer/`, `/favicon-generator/`, `/svg-optimizer/`, `/image-base64/`, `/exif-viewer/`, `/password-generator/`, `/unit-converter/`, `/css-gradient/` — each a self-contained tool (own `app.js` + `style.css`).
- Each tool is a real folder with its own `index.html`, listed as an entry in `vite.config.js`'s `rollupOptions.input` so `npm run build` emits it. **New tool = new folder + new entry in `vite.config.js`.**
- No shared JS between tools; each tool folder is self-contained, including its own `style.css` (duplicated `:root` variables etc.). Only the variable names/patterns are informally shared by convention. The root `style.css` only styles the home page.

## Key decisions (image-compressor)

- **Duplicate filenames**: `uniqueFilenames(entries)` in `app.js` deduplicates output names with a numeric suffix (e.g. `photo.webp`, `photo-1.webp`). Applied to card display, individual downloads, and ZIP.
- **Compression fallback**: if compressed output is larger than the original, the original is used and the card is flagged with a warning.
- **Concurrency**: up to 4 images compress in parallel (`MAX_CONCURRENT = 4`).
- **Supported formats**: JPEG, PNG, WebP.
- **Style**: light mode, white background, blue accent (`#2563eb`).

## Key decisions (qr-code)

- Uses the `qrcode` npm package's `QRCode.toCanvas` to render directly onto a `<canvas>`, re-rendered on a 150ms debounce as the user types.
- Download exports the canvas via `canvas.toDataURL('image/png')`.

## Key decisions (encode-decode)

- Single page, three modes (Base64 / URL / JSON) switched by tabs; each mode swaps the pair of action buttons rather than routing.
- Base64 encode/decode round-trips UTF-8 via `unescape(encodeURIComponent(...))` / `decodeURIComponent(escape(atob(...)))` so non-ASCII text survives.
- Parse/encode errors are caught per-action and shown inline rather than thrown.

## Key decisions (color-tools)

- Hex/RGB/HSL fields are kept in sync from whichever field was edited last (`applyRgb(rgb, { skip })` avoids clobbering the field the user is actively typing in).
- Contrast checker computes WCAG 2.x relative luminance/contrast ratio directly (no dependency) and shows pass/fail badges for AA/AAA at normal and large text thresholds (4.5:1, 3:1, 7:1, 4.5:1).

## Key decisions (file-hash)

- Computes SHA-1, SHA-256, SHA-384 and SHA-512 in parallel via `crypto.subtle.digest` on the file's `ArrayBuffer` — no hashing library needed (note: Web Crypto has no MD5).
- Reuses the image-compressor's dropzone markup/behavior pattern (click-to-browse, drag state, keyboard-activatable).

## Key decisions (2026-07 batch: json-formatter, text-diff, case-converter, jwt-decoder, regex-tester, cron-parser, timestamp-converter, markdown-preview, csv-json, lorem-ipsum, uuid-generator, image-resizer, favicon-generator, svg-optimizer, image-base64, exif-viewer, password-generator, unit-converter, css-gradient)

All 19 built to the same self-contained-folder convention, no new npm dependencies except reusing the existing `jszip` (favicon-generator) — everything else is vanilla JS/canvas/Web Crypto.

- **XSS-sensitive renders**: text-diff, regex-tester and markdown-preview all inject user-controlled text into `innerHTML` (diff lines, match highlights, rendered markdown) — each escapes `& < > " '` first. markdown-preview specifically escapes the *entire* raw input before running markdown transforms, so raw `<script>`/event-handler injection is structurally impossible.
- **SVG preview safety** (svg-optimizer): untrusted SVG is previewed via `<img src="blob:...">`, never `innerHTML` or an inline `<svg>` — `<img>` doesn't execute embedded `<script>` or event-handler attributes.
- **Randomness**: uuid-generator and password-generator only use `crypto.randomUUID()` / `crypto.getRandomValues()` with rejection sampling (never `Math.random()`) for anything that ends up in a generated secret/ID.
- **EXIF parsing** (exif-viewer): hand-rolled JPEG/TIFF binary parser over `DataView` (APP1 → TIFF IFD0 → Exif sub-IFD tag `0x8769` / GPS IFD tag `0x8825`) — no library.
- **Cron parsing** (cron-parser): supports `*`, lists, ranges, and steps per field; next-run-times are brute-forced minute-by-minute (capped at ~2 years) rather than computed analytically.
- **Favicon ZIP**: uses the existing `jszip` dependency to bundle generated PNG sizes (16–512px) plus a ready-to-paste `<link>` snippet, same generate/download pattern as image-compressor's batch ZIP.
- **Unit conversion**: length/weight/volume/data-storage use factor-to-base-unit tables; temperature is a special case (formulas via a Celsius pivot, not a multiplier). Data storage uses 1024-based multiples.

## Key decisions (fake-data-generator)

- Split out of lorem-ipsum's original "Fake Data" tab into its own tool; lorem-ipsum is now lorem-only.
- Field selection via checkboxes (`FIELDS` array of `{id, label}`) — `generatePerson()` always computes the full superset of fields; selection only filters which columns are rendered/exported, so toggling fields doesn't require regenerating data. Default-checked: Full Name, Email, Phone, Street Address, City, Company (matches the original fixed column set).
- Table headers are rendered dynamically from the selected fields, same for CSV export.
