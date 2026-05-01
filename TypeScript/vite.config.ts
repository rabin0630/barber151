import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'top.html'),
        admin: resolve(__dirname, 'admin.html'),
        top: resolve(__dirname, 'index.html'),
      },
    },
  },
});
