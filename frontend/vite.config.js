import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/admin': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/admin/, '')
      },
      '/api/driver': {
        target: 'http://127.0.0.1:4002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/driver/, '')
      },
      '/api/sponsor': {
        target: 'http://127.0.0.1:4003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sponsor/, '')
      }
    }
  }
})
