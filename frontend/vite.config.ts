import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Only precache the built app shell (JS/CSS/fonts/icons) — never the
      // API. This app's data (room status, bookings, payments) changes
      // constantly; caching API responses would show staff and guests
      // stale information, which is exactly the kind of bug that's easy
      // to introduce carelessly with a service worker and hard to notice
      // until someone's looking at a room that's actually already booked.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Explicit network-only for every API call — belt and
            // suspenders alongside the denylist above, since this is the
            // one thing in this config that must never be gotten wrong.
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Enayi Hotels & Suites',
        short_name: 'Enayi Hotels',
        description: 'Enayi Hotels & Suites — bookings, front desk, and hotel management, Jos, Plateau State, Nigeria',
        theme_color: '#0B1120',
        background_color: '#0B1120',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],

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