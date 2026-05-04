import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3100,
  },
  define: {
    'import.meta.env.VITE_DEMO_MODE': JSON.stringify('true'),
  },
})
