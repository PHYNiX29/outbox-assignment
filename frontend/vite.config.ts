import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxy API calls to Express so cookies are first-party and no CORS setup is needed in dev.
    proxy: {
      '/api': 'http://localhost:4000',
      '/admin': 'http://localhost:4000',
    },
  },
});
