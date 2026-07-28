import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';
import JSZip from 'jszip';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  files: [],
  nextId: 0,
  // Bumped whenever the options change. A run that finishes under an old
  // generation is discarded and requeued, so the visible result always
  // matches the current settings. (Same guard as the GIF compressor —
  // encoding is slow enough that options can change mid-run.)
  gen: 0,
};

// FileEntry shape:
// {
//   id, originalFile, originalSize,
//   meta: {width, height, frameCount, duration}|null,  // duration in µs
//   outBlob: Blob|null, outSize: number|null, outExt: 'mp4'|'webm'|null,
//   status: 'pending'|'converting'|'done'|'error'|'unsupported',
//   errorMessage: string|null,
// }

function createEntry(file) {
  return {
    id: state.nextId++,
    originalFile: file,
    originalSize: file.size,
    meta: null,
    outBlob: null,
    outSize: null,
    outExt: null,
    status: 'pending',
    errorMessage: null,
  };
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('fileInput');
const queueEl     = document.getElementById('queue');
const queueList   = document.getElementById('queueList');
const formatEl    = document.getElementById('format');
const qualityEl   = document.getElementById('quality');
const fpsEl       = document.getElementById('fps');
const maxWidthEl  = document.getElementById('maxWidth');
const loopsEl     = document.getElementById('loops');
const downloadAll = document.getElementById('downloadAll');
const clearAllBtn = document.getElementById('clearAll');
const unsupported = document.getElementById('unsupported');

// ─── Capability check ─────────────────────────────────────────────────────────

// ImageDecoder does the GIF demuxing, VideoEncoder the encoding. Without both
// there is no fallback worth shipping, so the tool disables itself outright
// rather than failing per-file.
const SUPPORTED = typeof window.ImageDecoder === 'function' && typeof window.VideoEncoder === 'function';
if (!SUPPORTED) {
  unsupported.hidden = false;
  dropzone.setAttribute('aria-disabled', 'true');
  dropzone.classList.add('dropzone--disabled');
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

dropzone.addEventListener('click', () => { if (SUPPORTED) fileInput.click(); });
dropzone.addEventListener('keydown', e => {
  if (SUPPORTED && (e.key === 'Enter' || e.key === ' ')) fileInput.click();
});

dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  if (SUPPORTED) dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', e => {
  if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('dragover');
});
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (SUPPORTED) ingestFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener('change', () => {
  ingestFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

[formatEl, qualityEl, fpsEl, maxWidthEl, loopsEl].forEach(el => {
  el.addEventListener('change', reconvertAll);
});

clearAllBtn.addEventListener('click', () => {
  state.files = [];
  renderQueue();
});

// ─── Ingest ───────────────────────────────────────────────────────────────────

function isGif(file) {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

function ingestFiles(files) {
  const entries = files.map(f => {
    const entry = createEntry(f);
    if (!isGif(f)) {
      entry.status = 'unsupported';
      entry.errorMessage = 'Not a GIF';
    }
    return entry;
  });

  state.files.push(...entries);
  renderQueue();

  const todo = entries.filter(e => e.status === 'pending');
  if (todo.length) enqueue(todo);
}

function reconvertAll() {
  state.gen++;
  const eligible = state.files.filter(e => e.status !== 'unsupported');
  eligible.forEach(e => {
    e.status = 'pending';
    e.outBlob = null;
    e.outSize = null;
    e.outExt = null;
    e.errorMessage = null;
  });
  renderQueue();
  if (eligible.length) enqueue(eligible);
}

// ─── Conversion queue ─────────────────────────────────────────────────────────

// Encoding is GPU/CPU heavy and holds a lot of decoded frames in memory, so
// runs are serialized rather than fanned out.
const queue = [];
let draining = false;

function enqueue(entries) {
  entries.forEach(entry => {
    if (!queue.includes(entry)) queue.push(entry);
  });
  drain();
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry.status !== 'pending') continue;
      entry.status = 'converting';
      updateCard(entry);
      await convertOne(entry);
    }
  } finally {
    draining = false;
  }
}

// ─── GIF decoding ─────────────────────────────────────────────────────────────

// Returns the GIF's frames as {bitmap, start, duration} in microseconds.
// ImageDecoder handles the GIF block structure and disposal methods for us —
// each decoded frame is already composited, unlike the raw sub-images.
async function decodeGif(file) {
  const decoder = new ImageDecoder({
    data: await file.arrayBuffer(),
    type: 'image/gif',
  });
  // tracks.ready resolves once the track list exists (selectedTrack is null
  // before that); completed resolves once all data is buffered, which is when
  // frameCount stops growing.
  await decoder.tracks.ready;
  await decoder.completed;

  const track = decoder.tracks.selectedTrack;
  const count = track ? track.frameCount : 0;
  if (!count) throw new Error('Couldn\'t read any frames from this GIF');

  const frames = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    // Browsers report the GIF's raw delay; delays of 0 or 1 hundredths are
    // conventionally rendered as 100ms, so anything implausibly short becomes
    // 100ms. A single-frame GIF gets a full second so the video isn't a blip.
    const raw = image.duration || 0;
    const duration = count === 1 ? 1e6 : (raw >= 20000 ? raw : 100000);
    frames.push({ frame: image, start: t, duration });
    t += duration;
  }
  decoder.close();
  return { frames, total: t };
}

// ─── Encoding ─────────────────────────────────────────────────────────────────

// Even dimensions — H.264 4:2:0 requires them, and VP9 is happier with them.
const even = n => Math.max(2, Math.round(n / 2) * 2);

function targetSize(width, height) {
  const maxW = parseInt(maxWidthEl.value, 10);
  if (maxW > 0 && width > maxW) {
    return { width: even(maxW), height: even(height * (maxW / width)) };
  }
  return { width: even(width), height: even(height) };
}

// "Match GIF" derives a frame rate from the shortest frame delay so the fastest
// part of the animation still lands on its own output frame.
function targetFps(frames) {
  const chosen = parseInt(fpsEl.value, 10);
  if (chosen > 0) return chosen;
  const shortest = Math.min(...frames.map(f => f.duration));
  const fps = 1e6 / shortest;
  return Math.min(50, Math.max(5, Math.round(fps)));
}

async function convertOne(entry) {
  const gen = state.gen;
  let decoded = null;
  try {
    decoded = await decodeGif(entry.originalFile);
    const { frames, total } = decoded;
    const src = { width: frames[0].frame.displayWidth, height: frames[0].frame.displayHeight };
    const { width, height } = targetSize(src.width, src.height);
    const fps = targetFps(frames);
    const loops = parseInt(loopsEl.value, 10) || 1;
    const bpp = parseFloat(qualityEl.value);
    const bitrate = Math.max(150_000, Math.round(width * height * fps * bpp));
    const format = formatEl.value;

    entry.meta = { width: src.width, height: src.height, frameCount: frames.length, duration: total * loops };

    const codec = format === 'mp4' ? 'avc1.42001f' : 'vp09.00.10.08';
    const config = { codec, width, height, bitrate, framerate: fps };
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) throw new Error(`${format.toUpperCase()} encoding not supported by this browser`);

    const muxer = format === 'mp4'
      ? new Mp4Muxer({
          target: new Mp4Target(),
          video: { codec: 'avc', width, height },
          fastStart: 'in-memory',
        })
      : new WebmMuxer({
          target: new WebmTarget(),
          video: { codec: 'V_VP9', width, height, frameRate: fps },
        });

    let encodeError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: err => { encodeError = err; },
    });
    encoder.configure({ ...config, ...(format === 'mp4' ? { avc: { format: 'avc' } } : {}) });

    // Resample the GIF's variable-delay timeline onto a constant frame rate.
    // Variable-frame-rate MP4/WebM plays back inconsistently across players,
    // and a constant rate is what the muxers and encoder expect.
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const frameDuration = 1e6 / fps;
    const outCount = Math.max(1, Math.round((total * loops) / frameDuration));
    const keyEvery = Math.max(1, Math.round(fps * 2)); // keyframe every ~2s

    let cursor = 0; // index into `frames` for the current loop pass
    for (let i = 0; i < outCount; i++) {
      const t = i * frameDuration;
      const inLoop = total > 0 ? t % total : 0;
      if (t > 0 && total > 0 && Math.floor(t / total) !== Math.floor((t - frameDuration) / total)) cursor = 0;
      while (cursor < frames.length - 1 && frames[cursor].start + frames[cursor].duration <= inLoop) cursor++;

      ctx.drawImage(frames[cursor].frame, 0, 0, width, height);
      const vf = new VideoFrame(canvas, {
        timestamp: Math.round(t),
        duration: Math.round(frameDuration),
      });
      encoder.encode(vf, { keyFrame: i % keyEvery === 0 });
      vf.close();

      // Don't let the encoder queue run away on long GIFs.
      if (encoder.encodeQueueSize > 16) {
        await new Promise(r => setTimeout(r, 0));
      }
      if (encodeError) throw encodeError;
    }

    await encoder.flush();
    encoder.close();
    if (encodeError) throw encodeError;
    muxer.finalize();

    if (gen !== state.gen) { // options changed mid-run — redo with the new ones
      entry.status = 'pending';
      enqueue([entry]);
      return;
    }

    const type = format === 'mp4' ? 'video/mp4' : 'video/webm';
    entry.outBlob = new Blob([muxer.target.buffer], { type });
    entry.outSize = entry.outBlob.size;
    entry.outExt = format;
    entry.status = 'done';
  } catch (err) {
    if (gen !== state.gen) {
      entry.status = 'pending';
      enqueue([entry]);
      return;
    }
    entry.status = 'error';
    entry.errorMessage = err && err.message ? err.message : 'Conversion failed';
  } finally {
    if (decoded) decoded.frames.forEach(f => f.frame.close());
  }
  updateCard(entry);
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderQueue() {
  queueEl.hidden = state.files.length === 0;
  queueList.innerHTML = '';
  state.files.forEach(entry => queueList.appendChild(buildCard(entry)));
}

function updateCard(entry) {
  const existing = document.getElementById(`card-${entry.id}`);
  const newCard = buildCard(entry);
  if (existing) {
    existing.replaceWith(newCard);
  } else {
    renderQueue();
  }
}

function buildCard(entry) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${entry.id}`;

  if (entry.status === 'unsupported' || entry.status === 'error') {
    card.classList.add('card--error');
  }

  // Thumbnail — the converted video once available, so the result is playable
  // in place; the source GIF until then.
  if (entry.status === 'done' && entry.outBlob) {
    const video = document.createElement('video');
    video.className = 'card__thumb';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    const url = URL.createObjectURL(entry.outBlob);
    video.src = url;
    card.appendChild(video);
  } else if (entry.status !== 'unsupported') {
    const img = document.createElement('img');
    img.className = 'card__thumb';
    img.alt = entry.originalFile.name;
    const url = URL.createObjectURL(entry.originalFile);
    img.src = url;
    img.onload = () => URL.revokeObjectURL(url);
    card.appendChild(img);
  } else {
    const thumb = document.createElement('div');
    thumb.className = 'card__thumb card__thumb--placeholder';
    thumb.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
    card.appendChild(thumb);
  }

  const info = document.createElement('div');
  info.className = 'card__info';

  const name = document.createElement('div');
  name.className = 'card__name';
  name.title = entry.originalFile.name;
  name.textContent = uniqueFilenames(state.files)[entry.id];
  info.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'card__meta';

  if (entry.status === 'unsupported' || entry.status === 'error') {
    const err = document.createElement('span');
    err.className = 'card__error';
    err.textContent = entry.errorMessage;
    meta.appendChild(err);
  } else if (entry.status === 'converting' || entry.status === 'pending') {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    meta.appendChild(spinner);
    const st = document.createElement('span');
    st.className = 'card__status';
    st.textContent = entry.status === 'pending' ? 'Queued…' : 'Converting…';
    meta.appendChild(st);
  } else {
    const origSize = document.createElement('span');
    origSize.className = 'card__size';
    origSize.textContent = formatBytes(entry.originalSize);
    meta.appendChild(origSize);

    const arrow = document.createElement('span');
    arrow.className = 'card__arrow';
    arrow.textContent = '→';
    meta.appendChild(arrow);

    const newSize = document.createElement('span');
    newSize.className = 'card__size--new';
    newSize.textContent = formatBytes(entry.outSize);
    meta.appendChild(newSize);

    const pct = Math.round((1 - entry.outSize / entry.originalSize) * 100);
    const savings = document.createElement('span');
    if (pct > 0) {
      savings.className = 'card__savings card__savings--good';
      savings.textContent = `−${pct}%`;
    } else {
      savings.className = 'card__savings card__savings--warn';
      savings.textContent = `+${Math.abs(pct)}%`;
    }
    meta.appendChild(savings);

    if (entry.meta) {
      const detail = document.createElement('span');
      detail.className = 'card__status';
      detail.textContent = `${entry.meta.frameCount} frames · ${(entry.meta.duration / 1e6).toFixed(1)}s`;
      meta.appendChild(detail);
    }
  }

  info.appendChild(meta);
  card.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'card__actions';
  if (entry.status === 'done') {
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn--primary btn--sm';
    dlBtn.textContent = 'Download';
    dlBtn.addEventListener('click', () => downloadEntry(entry));
    actions.appendChild(dlBtn);
  }

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn--secondary btn--sm';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => {
    state.files = state.files.filter(f => f.id !== entry.id);
    renderQueue();
  });
  actions.appendChild(removeBtn);
  card.appendChild(actions);

  return card;
}

function outputFilename(entry) {
  const base = entry.originalFile.name.replace(/\.[^.]+$/, '');
  return `${base}.${entry.outExt || formatEl.value}`;
}

function uniqueFilenames(entries) {
  const seen = {};
  const result = {};
  for (const entry of entries) {
    const base = outputFilename(entry);
    if (!(base in seen)) {
      seen[base] = 0;
      result[entry.id] = base;
    } else {
      seen[base]++;
      const dot = base.lastIndexOf('.');
      const stem = dot !== -1 ? base.slice(0, dot) : base;
      const ext  = dot !== -1 ? base.slice(dot)   : '';
      result[entry.id] = `${stem}-${seen[base]}${ext}`;
    }
  }
  return result;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Downloads ────────────────────────────────────────────────────────────────

function downloadEntry(entry) {
  const url = URL.createObjectURL(entry.outBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = uniqueFilenames(state.files)[entry.id];
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

downloadAll.addEventListener('click', async () => {
  const done = state.files.filter(e => e.status === 'done' && e.outBlob);
  if (!done.length) return;

  downloadAll.disabled = true;
  downloadAll.textContent = 'Zipping…';

  try {
    const zip = new JSZip();
    const filenameMap = uniqueFilenames(state.files);
    done.forEach(entry => zip.file(filenameMap[entry.id], entry.outBlob));
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'videos.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    downloadAll.disabled = false;
    downloadAll.textContent = 'Download all as ZIP';
  }
});
