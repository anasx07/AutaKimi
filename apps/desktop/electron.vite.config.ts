import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  const obfuscatorPlugin = (options: Record<string, any> = {}, exclude: (RegExp | string)[] = [/network\.ts/]) =>
    isProd
      ? [
          obfuscator({
            exclude: [/node_modules/, /\.nuxt/, ...exclude],
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
              ...options
            }
          })
        ]
      : []

  return {
    main: {
      resolve: {
        alias: {
          '@common': resolve(__dirname, '../../packages/sdk/src')
        }
      },
      build: {
        bytecode: false,
        sourcemap: !isProd,
        rollupOptions: {
          external: ['electron', 'path', 'fs', 'crypto', 'os', 'worker_threads', 'vm', 'http', 'better-sqlite3'],
          input: {
            index: resolve(__dirname, 'src/main/index.ts'),
            'extension-worker': resolve(__dirname, 'src/main/extension-worker.ts'),
            'plugin-worker': resolve(__dirname, 'src/main/plugin-worker.ts'),
            'localFileInterceptor': resolve(__dirname, '../../packages/sdk/src/services/localFileInterceptor.ts')
          }
        }
      },
      plugins: [...obfuscatorPlugin()]
    },
    preload: {
      resolve: {
        alias: {
          '@common': resolve(__dirname, '../../packages/sdk/src')
        }
      },
      build: {
        bytecode: false,
        sourcemap: !isProd,
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/preload/index.ts'),
            'cf-stealth-preload': resolve(__dirname, 'src/preload/cf-stealth-preload.ts')
          }
        }
      },
      plugins: [...obfuscatorPlugin()]
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
        sourcemap: !isProd,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('hls.js')) {
                  return 'vendor-hls'
                }
                if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
                  return 'vendor-react'
                }
                if (id.includes('lucide-react')) {
                  return 'vendor-icons'
                }
                if (id.includes('framer-motion')) {
                  return 'vendor-motion'
                }
                if (id.includes('@tanstack/react-query')) {
                  return 'vendor-query'
                }
                if (id.includes('react-virtuoso')) {
                  return 'vendor-virtuoso'
                }
              }
              return undefined
            }
          }
        }
      },
      plugins: [
        react(),
        ...obfuscatorPlugin(
          { reservedStrings: ['@renderer/pages/.*', '@renderer/widgets/.*'] },
          [/extension\.store\.ts/, /network\.ts/]
        )
      ]
    }
  }
})
