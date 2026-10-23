import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-chatgpt',
    cssCodeSplit: false,
    lib: { entry: 'src/chatgpt.jsx', name: 'FolioWidget', formats: ['iife'], fileName: () => 'widget.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
