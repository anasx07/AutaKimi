import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist-mobile',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@common': resolve(__dirname, 'src/common'),
      '@mobile': resolve(__dirname, 'src/mobile')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  plugins: [react()]
})
