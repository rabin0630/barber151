import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// TypeScript環境（ESM）で__dirnameのエラーを回避するための定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
  }, // ← 元のコードでここにカンマが抜けていたため修正
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        booking: resolve(__dirname, 'booking.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});