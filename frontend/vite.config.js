import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5175,
    proxy: {
        "/api": {
        target: "http://10.147.17.70:3000",
        changeOrigin: true,
        secure: false,
        },
        "/socket.io": {
        target: "http://10.147.17.70:3000",
        changeOrigin: true,
        ws: true,
        secure: false,
        },
      
    }
  }
  
})
