import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes every link relative, so the built app works from any
// folder — including a GitHub Pages sub-path (increment 5).
export default defineConfig({
  base: './',
  plugins: [react()],
});
