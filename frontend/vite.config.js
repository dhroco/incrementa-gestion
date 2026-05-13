/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Make environment variables available to the app
    'process.env.ENVIRONMENT': JSON.stringify(process.env.ENVIRONMENT || 'local')
  },
  server: {
    port: 5173
  }
})
