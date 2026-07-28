// Video compression via canvas + MediaRecorder.
//
// Why not WebCodecs like the GIF→Video tool: WebCodecs has no demuxer, so
// reading an arbitrary MP4/MOV would mean shipping one, and there is no AAC
// encoder in any browser — audio would have to be dropped or re-encoded to
// Opus, which most MP4 players can't read. Playing the file into a canvas and
// recording it keeps audio intact and works with every container the browser
// can already play. The cost is that it runs at playback speed.

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('fileInput');
const sourceEl     = document.getElementById('source');
const preview      = document.getElementById('preview');
const sourceName   = document.getElementById('sourceName');
const sourceMeta   = document.getElementById('sourceMeta');
const controlsEl   = document.getElementById('controls');
const formatEl     = document.getElementById('format');
const resolutionEl = document.getElementById('resolution');
const fpsEl        = document.getElementById('fps');
const bitrateEl    = document.getElementById('bitrate');
const trimStartEl  = document.getElementById('trimStart');
const trimEndEl    = document.getElementById('trimEnd');
const keepAudioEl  = document.getElementById('keepAudio');
const audioBrEl    = document.getElementById('audioBitrate');
const runEl        = document.getElementById('run');
const startBtn     = document.getElementById('startBtn');
const cancelBtn    = document.getElementById('cancelBtn');
const clearBtn     = document.getElementById('clearBtn');
const progressEl   = document.getElementById('progress');
const progressBar  = document.getElementById('progressBar');
const runStatus    = document.getElementById('runStatus');
const resultEl     = document.getElementById('result');
const resultVideo  = document.getElementById('resultVideo');
const resultMeta   = document.getElementById('resultMeta');
const downloadBtn  = document.getElementById('downloadBtn');
const unsupported  = document.getElementById('unsupported');

// ─── Output formats ───────────────────────────────────────────────────────────

// Candidate mime types per format, most preferred first. MediaRecorder support
// varies a lot by browser (Chrome only got MP4 recording recently, Firefox has
// none), so the format dropdown is built from what actually works here.
const FORMATS = [
  {
    id: 'mp4',
    label: 'MP4 (H.264)',
    ext: 'mp4',
    mimes: ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'],
  },
  {
    id: 'webm',
    label: 'WebM (VP9)',
    ext: 'webm',
    mimes: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm'],
  },
  {
    id: 'webm-vp8',
    label: 'WebM (VP8)',
    ext: 'webm',
    mimes: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8'],
  },
];

const available = [];
const RECORDER_OK = typeof window.MediaRecorder === 'function' && !!HTMLCanvasElement.prototype.captureStream;
if (RECORDER_OK) {
  for (const format of FORMATS) {
    const mime = format.mimes.find(m => MediaRecorder.isTypeSupported(m));
    if (mime) available.push({ ...format, mime });
  }
}

if (!RECORDER_OK || !available.length) {
  unsupported.hidden = false;
  dropzone.classList.add('dropzone--disabled');
} else {
  available.forEach(format => {
    const opt = document.createElement('option');
    opt.value = format.id;
    opt.textContent = format.label;
    formatEl.appendChild(opt);
  });
}

const SUPPORTED = RECORDER_OK && available.length > 0;

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  file: null,
  sourceUrl: null,
  meta: null,      // {width, height, duration}
  outBlob: null,
  outUrl: null,
  running: false,
  cancelled: false,
};

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
  if (SUPPORTED && e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) loadFile(fileInput.files[0]);
  fileInput.value = '';
});

clearBtn.addEventListener('click', reset);

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadFile(file) {
  if (state.running) return;
  if (!file.type.startsWith('video/')) {
    runEl.hidden = false;
    runStatus.textContent = 'That file isn\'t a video.';
    runStatus.className = 'run__status run__status--error';
    return;
  }

  reset();
  state.file = file;
  state.sourceUrl = URL.createObjectURL(file);
  preview.src = state.sourceUrl;

  try {
    state.meta = await new Promise((resolve, reject) => {
      preview.onloadedmetadata = () => resolve({
        width: preview.videoWidth,
        height: preview.videoHeight,
        duration: preview.duration,
      });
      preview.onerror = () => reject(new Error('Your browser can\'t decode this video.'));
    });
  } catch (err) {
    runEl.hidden = false;
    runStatus.textContent = err.message;
    runStatus.className = 'run__status run__status--error';
    return;
  }

  sourceName.textContent = file.name;
  sourceMeta.textContent =
    `${state.meta.width}×${state.meta.height} · ${formatDuration(state.meta.duration)} · ${formatBytes(file.size)}`;
  trimEndEl.max = Math.floor(state.meta.duration);

  sourceEl.hidden = false;
  controlsEl.hidden = false;
  runEl.hidden = false;
  runStatus.textContent = '';
  runStatus.className = 'run__status';
}

function reset() {
  if (state.running) return;
  if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
  if (state.outUrl) URL.revokeObjectURL(state.outUrl);
  Object.assign(state, {
    file: null, sourceUrl: null, meta: null, outBlob: null, outUrl: null,
    running: false, cancelled: false,
  });
  preview.removeAttribute('src');
  resultVideo.removeAttribute('src');
  sourceEl.hidden = true;
  controlsEl.hidden = true;
  runEl.hidden = true;
  resultEl.hidden = true;
  progressEl.hidden = true;
  runStatus.textContent = '';
  runStatus.className = 'run__status';
}

// ─── Output settings ──────────────────────────────────────────────────────────

// Even dimensions — H.264 4:2:0 requires them.
const even = n => Math.max(2, Math.round(n / 2) * 2);

function outputSize() {
  const { width, height } = state.meta;
  const maxHeight = parseInt(resolutionEl.value, 10);
  if (maxHeight > 0 && height > maxHeight) {
    return { width: even(width * (maxHeight / height)), height: even(maxHeight) };
  }
  return { width: even(width), height: even(height) };
}

function trimRange() {
  const duration = state.meta.duration;
  const rawStart = parseFloat(trimStartEl.value);
  const rawEnd = parseFloat(trimEndEl.value);
  let start = Number.isFinite(rawStart) ? Math.max(0, rawStart) : 0;
  let end = Number.isFinite(rawEnd) ? Math.min(duration, rawEnd) : duration;
  if (!(end > start)) { start = 0; end = duration; }
  return { start, end };
}

// ~0.07 bits per pixel per frame — around the low end of what looks fine for
// screen-recording and phone footage, which is what people compress.
function autoBitrate(width, height, fps) {
  return Math.max(200_000, Math.round(width * height * fps * 0.07));
}

// ─── Compress ─────────────────────────────────────────────────────────────────

startBtn.addEventListener('click', () => { compress().catch(fail); });
cancelBtn.addEventListener('click', () => { state.cancelled = true; });

async function compress() {
  if (state.running || !state.file) return;
  state.running = true;
  state.cancelled = false;
  startBtn.disabled = true;
  clearBtn.disabled = true;
  cancelBtn.hidden = false;
  resultEl.hidden = true;
  progressEl.hidden = false;
  progressBar.style.width = '0%';
  runStatus.className = 'run__status';
  runStatus.textContent = 'Preparing…';

  const format = available.find(f => f.id === formatEl.value) || available[0];
  const { width, height } = outputSize();
  const { start, end } = trimRange();
  const fps = parseInt(fpsEl.value, 10) || 30;
  const kbps = parseInt(bitrateEl.value, 10);
  const videoBitsPerSecond = kbps > 0 ? kbps * 1000 : autoBitrate(width, height, fps);
  const withAudio = keepAudioEl.checked;

  // A fresh element per run: createMediaElementSource can only be called once
  // per media element, and it permanently reroutes that element's audio.
  const video = document.createElement('video');
  video.src = state.sourceUrl;
  video.playsInline = true;
  video.preload = 'auto';

  let audioCtx = null;
  let recorder = null;

  try {
    await once(video, 'loadedmetadata');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const stream = canvas.captureStream(fps);

    if (withAudio) {
      // Routing the element through a MediaStreamDestination (and nowhere
      // else) captures its audio without it playing out loud.
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      await audioCtx.resume();
      dest.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    } else {
      video.muted = true;
    }

    const options = { mimeType: format.mime, videoBitsPerSecond };
    if (withAudio) options.audioBitsPerSecond = parseInt(audioBrEl.value, 10) * 1000;
    recorder = new MediaRecorder(stream, options);

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = once(recorder, 'stop');

    // Seek before recording starts so the first recorded frame is already the
    // trimmed-in frame rather than frame 0.
    if (start > 0) {
      video.currentTime = start;
      await once(video, 'seeked');
    }

    runStatus.textContent = 'Compressing…';
    recorder.start(1000);
    await video.play();

    await new Promise(resolve => {
      const span = end - start;
      const draw = () => {
        if (video.ended || state.cancelled || video.currentTime >= end) {
          resolve();
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const pct = span > 0 ? Math.min(100, ((video.currentTime - start) / span) * 100) : 100;
        progressBar.style.width = `${pct.toFixed(1)}%`;
        schedule();
      };
      // requestVideoFrameCallback fires once per decoded frame, so nothing is
      // drawn twice and no frame is missed; rAF is the fallback.
      const schedule = video.requestVideoFrameCallback
        ? () => video.requestVideoFrameCallback(draw)
        : () => requestAnimationFrame(draw);
      schedule();
    });

    video.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;

    if (state.cancelled) {
      runStatus.textContent = 'Cancelled.';
      progressEl.hidden = true;
      return;
    }

    progressBar.style.width = '100%';
    state.outBlob = new Blob(chunks, { type: format.mime.split(';')[0] });
    state.outExt = format.ext;
    if (state.outUrl) URL.revokeObjectURL(state.outUrl);
    state.outUrl = URL.createObjectURL(state.outBlob);
    resultVideo.src = state.outUrl;

    const pct = Math.round((1 - state.outBlob.size / state.file.size) * 100);
    resultMeta.innerHTML = '';
    resultMeta.append(
      span('result__size', formatBytes(state.file.size)),
      span('result__arrow', '→'),
      span('result__size--new', formatBytes(state.outBlob.size)),
      span(
        pct > 0 ? 'card__savings card__savings--good' : 'card__savings card__savings--warn',
        pct > 0 ? `−${pct}%` : `+${Math.abs(pct)}%`,
      ),
      span('result__detail', `${width}×${height} · ${formatDuration(end - start)}`),
    );
    resultEl.hidden = false;
    runStatus.textContent = 'Done.';
  } finally {
    if (audioCtx) audioCtx.close();
    video.pause();
    video.removeAttribute('src');
    state.running = false;
    startBtn.disabled = false;
    clearBtn.disabled = false;
    cancelBtn.hidden = true;
  }
}

function fail(err) {
  runStatus.className = 'run__status run__status--error';
  runStatus.textContent = err && err.message ? err.message : 'Compression failed.';
  progressEl.hidden = true;
}

downloadBtn.addEventListener('click', () => {
  if (!state.outBlob) return;
  const base = state.file.name.replace(/\.[^.]+$/, '');
  const a = document.createElement('a');
  a.href = state.outUrl;
  a.download = `${base}-compressed.${state.outExt}`;
  a.click();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function once(target, event) {
  return new Promise((resolve, reject) => {
    target.addEventListener(event, resolve, { once: true });
    target.addEventListener('error', () => reject(new Error('Video playback failed.')), { once: true });
  });
}

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
