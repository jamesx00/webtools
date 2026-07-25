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
      },
    },
  },
});
