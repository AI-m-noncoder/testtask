import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors the nginx setup in Docker: API lives under /api on the same origin
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    // ~210 kB gzipped, mostly Mantine; acceptable for an internal B2B app without route splitting
    chunkSizeWarningLimit: 800,
  },
});
