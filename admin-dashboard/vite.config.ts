import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'map': ['leaflet', 'react-leaflet'],
          'utils': ['date-fns'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/v1/riders':    { target: 'http://localhost:8001', changeOrigin: true },
      '/api/v1/zones':     { target: 'http://localhost:8001', changeOrigin: true },
      '/api/v1/policies':  { target: 'http://localhost:8002', changeOrigin: true },
      '/api/v1/trigger':   { target: 'http://localhost:8003', changeOrigin: true },
      '/api/v1/claims':    { target: 'http://localhost:8004', changeOrigin: true },
      '/api/v1/payments':  { target: 'http://localhost:8005', changeOrigin: true },
      '/api/v1/premium':   { target: 'http://localhost:8006', changeOrigin: true },
      '/api/v1/fraud':     { target: 'http://localhost:8006', changeOrigin: true },
      '/api/v1/predict':   { target: 'http://localhost:8006', changeOrigin: true },
    },
  },
})
