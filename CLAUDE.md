# webtools

Client-side image compression tool. All processing happens in the browser — nothing is uploaded.

## Stack

- Vanilla JS (ES modules), HTML, CSS — no framework
- Vite for bundling and dev server
- `browser-image-compression` — client-side JPEG/PNG/WebP compression
- `jszip` — ZIP generation for batch download

## Commands

```bash
npm run dev    # dev server with hot reload at localhost:5173
npm run build  # production build → dist/
```

## Key decisions

- **Duplicate filenames**: `uniqueFilenames(entries)` in `app.js` deduplicates output names with a numeric suffix (e.g. `photo.webp`, `photo-1.webp`). Applied to card display, individual downloads, and ZIP.
- **Compression fallback**: if compressed output is larger than the original, the original is used and the card is flagged with a warning.
- **Concurrency**: up to 4 images compress in parallel (`MAX_CONCURRENT = 4`).
- **Supported formats**: JPEG, PNG, WebP.
- **Style**: light mode, white background, blue accent (`#2563eb`).
