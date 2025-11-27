import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: '/ewe-diaspora/',
  server: {
    fs: { strict: false },
  },
  optimizeDeps: {
    include: ['maplibre-gl']
  },
});