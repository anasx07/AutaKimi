// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import obfuscator from "vite-plugin-javascript-obfuscator";
var __electron_vite_injected_dirname = "D:\\DEV\\Apps\\AutaKimi\\apps\\desktop";
var electron_vite_config_default = defineConfig({
  main: {
    resolve: {
      alias: {
        "@common": resolve(__electron_vite_injected_dirname, "../../packages/sdk/src")
      }
    },
    build: {
      bytecode: true,
      sourcemap: false,
      rollupOptions: {
        external: ["electron", "path", "fs", "crypto", "os", "worker_threads", "vm", "http", "better-sqlite3"],
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/index.ts"),
          "extension-worker": resolve(__electron_vite_injected_dirname, "src/main/extension-worker.ts")
        }
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        "@common": resolve(__electron_vite_injected_dirname, "../../packages/sdk/src")
      }
    },
    build: {
      bytecode: true,
      sourcemap: false
    }
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@common": resolve(__electron_vite_injected_dirname, "../../packages/sdk/src"),
        "@mobile": resolve("src/mobile")
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
          reservedStrings: ["@renderer/pages/.*"]
        }
      })
    ]
  }
});
export {
  electron_vite_config_default as default
};
