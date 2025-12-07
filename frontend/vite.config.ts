import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
	allowedHosts: [''],
    // Disable HMR or configure it for network access
    hmr: {
      // Let the browser determine the WebSocket host
      clientPort: 3000,
      // Use the client's current host for WebSocket connection
      host: undefined,
    },
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
      },
    },
  },
})
