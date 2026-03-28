---
title: Image Compression Tool
date: 2026-03-28
status: approved
---

# Image Compression Tool

A client-side image compression tool inspired by compressimage.io. No server-side processing — everything runs in the browser.

## Overview

Single-page HTML/CSS/JS app with no build step and no framework. Three files: `index.html`, `style.css`, `app.js`. Dependencies loaded from CDN: `browser-image-compression` for compression, `JSZip` for batch download.

## Supported Formats

- **Input:** JPEG, PNG
- **Output:** Same format as input, or WebP (user toggle)

## Architecture

No build pipeline. Pure HTML/CSS/JS. Two CDN dependencies:
- `browser-image-compression` — handles JPEG and PNG compression via web worker
- `JSZip` — client-side zip for "Download All"

Files:
```
index.html
style.css
app.js
```

## Components

### Drop Zone
- Accepts drag-and-drop or click-to-browse
- Accepts multiple files at once
- Only JPEG and PNG files accepted

### Controls Bar
- **Quality slider** (1–100) — controls compression level
- **Max width input** — positive integer; images wider than this value are resized down with aspect ratio preserved; blank = no resize
- **Convert to WebP toggle** — checkbox; when checked, output format is WebP regardless of input format

### Image Queue
Each file appears as a card containing:
- Thumbnail preview
- Filename
- Original file size
- Compressed file size
- % size reduction
- Download button (downloads the compressed file)

Compression runs automatically when files are added using the current control values. Re-runs for all current files when quality, max width, or WebP toggle changes.

### Action Bar
- **Download All** — zips all compressed files with JSZip and downloads as a single `.zip`

## Data Flow

1. User drops or selects files
2. Each file added to in-memory array: `{ id, originalFile, originalSize, compressedBlob, compressedSize, status }`
3. Files compressed concurrently (max 4 at a time) via `browser-image-compression` web worker
4. Compressed blob stored in memory; card updated with sizes and % saved
5. Download button creates a temporary object URL and triggers browser download
6. "Download All" passes all blobs to JSZip, generates zip, triggers download
7. On control change (slider, max width, WebP toggle): all files re-compressed with new settings

## Error Handling & Edge Cases

- **Unsupported file type:** Card shown with error message "Unsupported format"; file skipped
- **Compressed > original:** Warning shown on card; original file offered for download instead
- **Invalid max width:** Non-positive or non-integer values silently ignored (no resize applied)
- **Concurrency:** Max 4 files compressed simultaneously to avoid overwhelming the browser

## Testing

Manual testing checklist:
- JPEG compression reduces file size
- PNG compression reduces file size
- WebP toggle converts output format
- Max width resizes wide images (aspect ratio preserved)
- Max width field ignores invalid input
- Batch upload processes all files
- Individual download works per card
- Download All produces a valid zip with all compressed files
- Changing slider re-compresses all current files
- Compressed > original shows warning and downloads original
- Unsupported file type shows error card and is skipped
