import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const page = (...segments) => resolve(root, ...segments, 'index.html');

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: page(),
        imageCompressor: page('image-compressor'),
        qrCode: page('qr-code'),
        encodeDecode: page('encode-decode'),
        colorTools: page('color-tools'),
        fileHash: page('file-hash'),
        jsonFormatter: page('json-formatter'),
        textDiff: page('text-diff'),
        caseConverter: page('case-converter'),
        jwtDecoder: page('jwt-decoder'),
        regexTester: page('regex-tester'),
        cronParser: page('cron-parser'),
        timestampConverter: page('timestamp-converter'),
        markdownPreview: page('markdown-preview'),
        csvJson: page('csv-json'),
        loremIpsum: page('lorem-ipsum'),
        uuidGenerator: page('uuid-generator'),
        imageResizer: page('image-resizer'),
        faviconGenerator: page('favicon-generator'),
        svgOptimizer: page('svg-optimizer'),
        imageBase64: page('image-base64'),
        exifViewer: page('exif-viewer'),
        passwordGenerator: page('password-generator'),
        unitConverter: page('unit-converter'),
        cssGradient: page('css-gradient'),
      },
    },
  },
});
