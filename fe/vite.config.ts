import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    // Bind to all interfaces so other devices on the same LAN can open the app.
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8085",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:8085",
        changeOrigin: true,
      },
    },
  },
})