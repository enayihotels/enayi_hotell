import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: [
      // Explicit aliases first (more specific must come before more general)
      { find: '@/components/ui', replacement: path.resolve(__dirname, './src/components/ui/index.tsx') },
      { find: '@/types', replacement: path.resolve(__dirname, './src/types/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },

  server: {
    port: 5173,
    host: true,
    allowedHosts: true,        // ← ADDED: accepts the random ngrok hostname
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/media': { target: 'http://localhost:8000', changeOrigin: true },
      '/static': { target: 'http://localhost:8000', changeOrigin: true },  // ← ADDED
      '/admin': { target: 'http://localhost:8000', changeOrigin: true },   // ← ADDED
    },
  },

  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
          state: ['zustand', '@tanstack/react-query', 'axios'],
        },
      },
    },
  },
})