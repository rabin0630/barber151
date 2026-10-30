import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// TypeScript環境（ESM）で__dirnameのエラーを回避するための定義
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  // HTMLはpages/に置く。rootにしておくと、URLとdistの配置は/booking.htmlのままになる
  root: 'pages',
  publicDir: '../public',
  envDir: '..',
  // HTMLの/src/...はrootの外にあるので、実際のsrc/に向ける
  resolve: {
    alias: { '/src': resolve(__dirname, 'src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // rootの外にあるsrc/を配信できるようにする
    fs: { allow: ['..'] },
  }, // ← 元のコードでここにカンマが抜けていたため修正
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'pages/index.html'),
        booking: resolve(__dirname, 'pages/booking.html'),
        admin: resolve(__dirname, 'pages/admin.html'),
        tutorialBooking: resolve(__dirname, 'tutorial-booking.html'),
        tutorialAdmin: resolve(__dirname, 'tutorial-admin.html'),
      },
    },
  },
});