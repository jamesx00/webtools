const dropzone         = document.getElementById('dropzone');
const fileInput        = document.getElementById('fileInput');
const resultEl         = document.getElementById('result');
const fileInfoTable    = document.getElementById('fileInfoTable');
const exifStatus       = document.getElementById('exifStatus');
const exifTable        = document.getElementById('exifTable');
const gpsLine          = document.getElementById('gpsLine');
const downloadStripped = document.getElementById('downloadStripped');

let currentImage = null;
let currentFile = null;

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', e => {
  if (!dropzone.contains(e.relatedTarget)) {
    dropzone.classList.remove('dragover');
  }
});
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
  fileInput.value = '';
});

// ─── File handling ───────────────────────────────────────────────────────────

async function handleFile(file) {
  currentFile = file;
  currentImage = null;
  downloadStripped.hidden = true;
  resultEl.hidden = false;

  const dims = await loadImageDimensions(file);
  if (dims) {
    currentImage = dims.image;
    downloadStripped.hidden = false;
  }
  renderFileInfo(file, dims);

  let tags = null;
  try {
    const buffer = await file.arrayBuffer();
    tags = parseExif(buffer);
  } catch {
    tags = null;
  }

  renderExif(tags);
}

function loadImageDimensions(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight, image: img });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function renderFileInfo(file, dims) {
  fileInfoTable.innerHTML = '';
  addRow(fileInfoTable, 'Name', file.name);
  addRow(fileInfoTable, 'Size', formatBytes(file.size));
  addRow(fileInfoTable, 'Type', file.type || 'Unknown');
  if (dims) addRow(fileInfoTable, 'Dimensions', `${dims.width} × ${dims.height} px`);
}

function addRow(table, key, value) {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.textContent = key;
  const td = document.createElement('td');
  td.textContent = value;
  tr.append(th, td);
  table.appendChild(tr);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── EXIF rendering ───────────────────────────────────────────────────────────

const DISPLAY_TAGS = [
  { tag: 0x010f, label: 'Make', format: v => String(v).trim() },
  { tag: 0x0110, label: 'Model', format: v => String(v).trim() },
  { tag: 0x0112, label: 'Orientation', format: formatOrientation },
  { tag: 0x0132, label: 'Date/Time', format: v => String(v).trim() },
  { tag: 0x9003, label: 'Date/Time Original', format: v => String(v).trim() },
  { tag: 0x829a, label: 'Exposure Time', format: formatExposureTime },
  { tag: 0x829d, label: 'F-Number', format: formatFNumber },
  { tag: 0x8827, label: 'ISO Speed', format: v => String(v) },
  { tag: 0x920a, label: 'Focal Length', format: formatFocalLength },
];

function renderExif(tags) {
  exifTable.innerHTML = '';
  exifTable.hidden = true;
  exifStatus.hidden = true;
  gpsLine.hidden = true;

  if (!tags) {
    exifStatus.textContent = 'No EXIF data found in this file.';
    exifStatus.hidden = false;
    return;
  }

  let rowCount = 0;
  DISPLAY_TAGS.forEach(({ tag, label, format }) => {
    const raw = tags[tag];
    if (raw === undefined || raw === null || raw === '') return;
    let text;
    try {
      text = format(raw);
    } catch {
      return;
    }
    if (!text) return;
    addRow(exifTable, label, text);
    rowCount++;
  });

  const gps = computeGps(tags);
  if (gps) {
    gpsLine.textContent = `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
    gpsLine.hidden = false;
  }

  if (rowCount === 0 && !gps) {
    exifStatus.textContent = 'No EXIF data found in this file.';
    exifStatus.hidden = false;
    return;
  }

  exifTable.hidden = rowCount === 0;
}

function formatOrientation(v) {
  const labels = {
    1: 'Normal',
    2: 'Mirrored horizontal',
    3: 'Rotated 180°',
    4: 'Mirrored vertical',
    5: 'Mirrored horizontal, rotated 270° CW',
    6: 'Rotated 90° CW',
    7: 'Mirrored horizontal, rotated 90° CW',
    8: 'Rotated 270° CW',
  };
  return labels[v] || `Unknown (${v})`;
}

function toDecimalRational(r) {
  if (r && typeof r === 'object' && 'num' in r) {
    return r.den === 0 ? 0 : r.num / r.den;
  }
  return typeof r === 'number' ? r : 0;
}

function trimNum(n) {
  return Number(n.toFixed(2)).toString();
}

function formatExposureTime(r) {
  const decimal = toDecimalRational(r);
  if (!decimal) return null;
  if (decimal < 1) return `1/${Math.round(1 / decimal)} s`;
  return `${trimNum(decimal)} s`;
}

function formatFNumber(r) {
  const decimal = toDecimalRational(r);
  if (!decimal) return null;
  return `f/${trimNum(decimal)}`;
}

function formatFocalLength(r) {
  const decimal = toDecimalRational(r);
  if (!decimal) return null;
  return `${trimNum(decimal)} mm`;
}

function computeGps(tags) {
  const gps = tags.gps;
  if (!gps) return null;
  const lat = gps[0x0002];
  const latRef = gps[0x0001];
  const lon = gps[0x0004];
  const lonRef = gps[0x0003];
  if (!lat || !lon || !latRef || !lonRef) return null;
  const latDec = dmsToDecimal(lat, latRef);
  const lonDec = dmsToDecimal(lon, lonRef);
  if (latDec === null || lonDec === null) return null;
  return { lat: latDec, lon: lonDec };
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const deg = toDecimalRational(dms[0]);
  const min = toDecimalRational(dms[1]);
  const sec = toDecimalRational(dms[2]);
  let dec = deg + min / 60 + sec / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return dec;
}

// ─── JPEG / EXIF binary parsing ──────────────────────────────────────────────
// Scans JPEG markers for the APP1 "Exif" segment, then walks the embedded
// TIFF structure (IFD0 -> Exif sub-IFD -> GPS IFD) directly over a DataView.

function parseExif(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    offset += 2;

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) break;

    const length = view.getUint16(offset);
    if (length < 2 || offset + length > view.byteLength) break;

    if (marker === 0xe1) {
      const segStart = offset + 2;
      if (
        segStart + 6 <= view.byteLength &&
        view.getUint32(segStart) === 0x45786966 &&
        view.getUint16(segStart + 4) === 0x0000
      ) {
        return parseTiff(view, segStart + 6);
      }
    }

    offset += length;
  }
  return null;
}

const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function parseTiff(view, tiffStart) {
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrderMark = view.getUint16(tiffStart);
  let little;
  if (byteOrderMark === 0x4949) little = true;
  else if (byteOrderMark === 0x4d4d) little = false;
  else return null;

  if (view.getUint16(tiffStart + 2, little) !== 42) return null;

  const ifd0Offset = view.getUint32(tiffStart + 4, little);
  const ifd0 = readIFD(view, tiffStart, tiffStart + ifd0Offset, little);
  if (!ifd0) return null;

  const tags = { ...ifd0.tags };

  if (typeof ifd0.tags[0x8769] === 'number') {
    const exifIFD = readIFD(view, tiffStart, tiffStart + ifd0.tags[0x8769], little);
    if (exifIFD) Object.assign(tags, exifIFD.tags);
  }

  if (typeof ifd0.tags[0x8825] === 'number') {
    const gpsIFD = readIFD(view, tiffStart, tiffStart + ifd0.tags[0x8825], little);
    if (gpsIFD) tags.gps = gpsIFD.tags;
  }

  return tags;
}

function readIFD(view, tiffStart, ifdOffset, little) {
  if (ifdOffset < 0 || ifdOffset + 2 > view.byteLength) return null;
  const numEntries = view.getUint16(ifdOffset, little);
  const tags = {};

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, little);
    const type = view.getUint16(entryOffset + 2, little);
    const count = view.getUint32(entryOffset + 4, little);
    const typeSize = TYPE_SIZES[type];
    if (!typeSize) continue;

    const totalSize = typeSize * count;
    let valueOffset = entryOffset + 8;
    if (totalSize > 4) {
      valueOffset = tiffStart + view.getUint32(entryOffset + 8, little);
    }
    if (valueOffset < 0 || valueOffset + totalSize > view.byteLength) continue;

    tags[tag] = readValue(view, valueOffset, type, count, little);
  }

  return { tags };
}

function readValue(view, offset, type, count, little) {
  switch (type) {
    case 2: {
      let str = '';
      for (let i = 0; i < count; i++) {
        const c = view.getUint8(offset + i);
        if (c === 0) break;
        str += String.fromCharCode(c);
      }
      return str;
    }
    case 1:
    case 7: {
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(view.getUint8(offset + i));
      return count === 1 ? arr[0] : arr;
    }
    case 3: {
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(view.getUint16(offset + i * 2, little));
      return count === 1 ? arr[0] : arr;
    }
    case 4: {
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(view.getUint32(offset + i * 4, little));
      return count === 1 ? arr[0] : arr;
    }
    case 9: {
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(view.getInt32(offset + i * 4, little));
      return count === 1 ? arr[0] : arr;
    }
    case 5: {
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          num: view.getUint32(offset + i * 8, little),
          den: view.getUint32(offset + i * 8 + 4, little),
        });
      }
      return count === 1 ? arr[0] : arr;
    }
    case 10: {
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          num: view.getInt32(offset + i * 8, little),
          den: view.getInt32(offset + i * 8 + 4, little),
        });
      }
      return count === 1 ? arr[0] : arr;
    }
    default:
      return null;
  }
}

// ─── Download stripped copy ──────────────────────────────────────────────────

downloadStripped.addEventListener('click', () => {
  if (!currentImage || !currentFile) return;

  const canvas = document.createElement('canvas');
  canvas.width = currentImage.naturalWidth;
  canvas.height = currentImage.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(currentImage, 0, 0);

  const mime = currentFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
  canvas.toBlob(
    blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = strippedFilename(currentFile.name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    },
    mime,
    0.92
  );
});

function strippedFilename(name) {
  const dot = name.lastIndexOf('.');
  const stem = dot !== -1 ? name.slice(0, dot) : name;
  const ext = dot !== -1 ? name.slice(dot) : '';
  return `${stem}-stripped${ext}`;
}
