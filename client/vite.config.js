import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      external: ['/__catalyst/sdk/init.js'],
    },
  },
  server: {
    proxy: {
      '/api/chat': {
        target: 'https://crimeiq-60074288350.development.catalystserverless.in',
        changeOrigin: true,
        rewrite: (path) => '/server/chat-function/execute' + path.replace('/api/chat', ''),
      },
      '/api/role': {
        target: 'https://crimeiq-60074288350.development.catalystserverless.in',
        changeOrigin: true,
        rewrite: (path) => '/server/role-function/execute' + path.replace('/api/role', ''),
      },
    },
  },
})