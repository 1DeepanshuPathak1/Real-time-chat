import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [react()],
  base: '/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, 
    rollupOptions: {
      output: {
        manualChunks: undefined, 
      }
    }
  },
  server: {
    port: 5173,
    host: true, 
    historyApiFallback: true 
  },
  preview: {
    port: 3000,
    host: true,
    historyApiFallback: true
  }
})