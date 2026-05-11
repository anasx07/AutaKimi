import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@common': resolve(__dirname, '../../packages/sdk/src')
      }
    },
    build: {
      bytecode: false,
      sourcemap: false,
      rollupOptions: {
        external: ['electron', 'path', 'fs', 'crypto', 'os', 'worker_threads', 'vm', 'http', 'better-sqlite3'],
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'extension-worker': resolve(__dirname, 'src/main/extension-worker.ts')
        }
      }
    },
    plugins: [
      obfuscator({
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          numbersToExpressions: true,
          simplify: true,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayThreshold: 0.75,
          splitStrings: true,
          splitStringsChunkLength: 10,
          unicodeEscapeSequence: true
        }
      })
    ]
  },
  preload: {
    resolve: {
      alias: {
        '@common': resolve(__dirname, '../../packages/sdk/src')
      }
    },
    build: {
      bytecode: false,
      sourcemap: false
    },
    plugins: [
      obfuscator({
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          numbersToExpressions: true,
          simplify: true,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayThreshold: 0.75,
          splitStrings: true,
          splitStringsChunkLength: 10,
          unicodeEscapeSequence: true
        }
      })
    ]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@common': resolve(__dirname, '../../packages/sdk/src'),
        '@mobile': resolve('src/mobile')
      }
    },
    build: {
      sourcemap: false
    },
    plugins: [
      react(),
      obfuscator({
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          numbersToExpressions: true,
          simplify: true,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayThreshold: 0.75,
          splitStrings: true,
          splitStringsChunkLength: 10,
          unicodeEscapeSequence: true,
          reservedStrings: ['@renderer/pages/.*']
        }
      })
    ]
  }
})
