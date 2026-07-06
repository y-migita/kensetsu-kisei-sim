/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  base: '/kensetsu-kisei-sim/',
  plugins: [react(), tailwindcss()],
  build: {
    // three.js 系を分離してキャッシュ効率を上げる
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|@react-three)/ },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)/ },
          ],
        },
      },
    },
    // three.js 本体を含むチャンクは必然的に大きい (gzip ~350kB)
    chunkSizeWarningLimit: 1300,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
