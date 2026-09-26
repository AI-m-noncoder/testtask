import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors the nginx setup in Docker: API lives under /api on the same origin
    proxy: { '/api': 'http://localhost:3000' },
  },
});
