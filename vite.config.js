import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dashboard talks to the backend directly on port 5000 (see frontend/src/services/api.js).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild'
  }
});
