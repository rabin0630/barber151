import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
  }
  // build: {
  //   rollupOptions: {
  //     input: {
  //       main: resolve(__dirname, 'top.html'),
  //       admin: resolve(__dirname, 'admin.html'),
  //       top: resolve(__dirname, 'index.html'),
  //     },
  //   },
  // },
});
