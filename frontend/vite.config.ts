import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/ai-stock-simulation/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3100,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
          'vendor-lucide': ['lucide-react'],
        }
      }
    }
  }
})
