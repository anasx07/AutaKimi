# 🌌 AutaKimi

**AutaKimi** is a professional, privacy-first, cross-platform media framework for organized content viewing. Built with a modern tech stack, it provides a seamless experience across Windows, Android, and iOS.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Website](https://img.shields.io/badge/Website-anasx07.github.io%2FAutaKimi-purple)](https://anasx07.github.io/AutaKimi/)

---

## ✨ Key Features

- **🛡️ Privacy First:** No accounts, no tracking, and no central servers. Your data stays on your device.
- **📱 P2P Syncing:** Seamlessly synchronize your history and library between Desktop and Mobile via local Wi-Fi pairing.
- **🧩 Dynamic Extensions:** A powerful "Empty Shell" architecture that allows you to add your own content sources via remote repositories.
- **🔌 Sandboxed Plugins:** Secure, community-driven JavaScript modules for specialized automation and site interactions (e.g., automated Cloudflare solving).
- **☁️ Cloudflare Bypass:** Built-in "User-Solved" verification system and automated solver plugins to navigate protected websites reliably.
- **⚡ High Performance:** Native-speed performance powered by Electron (Desktop) and Expo/React Native (Mobile).

---

## 🏗️ Monorepo Architecture

AutaKimi is built as a unified TypeScript monorepo using npm workspaces:

- **`packages/sdk`**: The shared core containing the extension engine, sandboxed plugin system, network client, and sync protocols.
- **`apps/desktop`**: Modern Electron application featuring a sleek React 19 UI, sandboxed VM execution, and Drizzle ORM.
- **`apps/mobile`**: High-performance Expo application with NativeWind styling and local-first storage.
- **`github-page`**: Next.js-powered landing page and documentation.

---

## 🛡️ Security & Sandbox Architecture

AutaKimi implements a strict multi-layer sandbox environment to guarantee host process safety against third-party extension code:

1. **Host-Safe Template Registration**:
   - The SDK features a safe, non-eval template interpolation mechanism in `TemplateService`. It reads and interpolates dynamic scraping templates purely in-memory using strict string replacements—**never** evaluating untrusted code with `eval()` or `new Function()` in the main process.
2. **Scraper Sandboxing (Worker Threads)**:
   - All extension scraping runs inside isolated, dedicated Node.js `worker_threads` containing a locked-down V8 `vm.Script` execution context.
   - Workers are scoped with restricted, zero-access globals. Network access is routed through a monitored network manager with built-in case-insensitive Cloudflare and header scrubbers.
3. **Plugin Isolation**:
   - Automated helper plugins run inside scoped, highly-restricted `vm.createContext` contexts in the Electron process, isolated from core Electron internals via secure `BrowserWindow` proxies.

---

## 📡 Subscribing to Extensions

To add content sources to your local AutaKimi app, paste any compatible community-maintained repository URL in the **Repositories** page:

* **GitHub Pages URL (Recommended)**:
  ```http
  https://autakimi-ecosystem.github.io/autakimi-extensions/
  ```
* **Raw Git CDN URL**:
  ```http
  https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/
  ```

AutaKimi will automatically parse, fetch, and register all the catalogs, scraping templates, icons, and helper plugins defined in the remote index.

---

## 🛠️ Local Developer Mode & Extension Testing

AutaKimi provides a built-in **Developer Mode** designed for creators working on custom extensions. This allows you to load, test, and debug templates and plugins locally without having to release or push changes to a remote repository first.

### How to Use Local Developer Mode:

1. **Enable Developer Mode**:
   * Navigate to **Settings** > **Advanced Settings**.
   * Toggle the **Developer Mode** switch to **ON**.

2. **Load a Local Extension Directory**:
   * Navigate to **Settings** > **Sources**.
   * When Developer Mode is active, a premium **"Load Local Directory"** button will appear next to the Repository URL input.
   * Click this button to open your system's native directory dialog, and select the local folder containing your compiled extension assets (e.g., your local directory with `templates.json` and `plugins.json`).

3. **Visual Indicators & Execution**:
   * AutaKimi's network layer implements a **Local File System Interceptor** that detects absolute paths and `file:///` protocol URIs, loading files directly from your hard drive via Node `fs` APIs.
   * Active local directories are visually distinguished in your source list with sleek, amber **"Local Dev"** folder badges.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or higher)
- npm

### Installation
```bash
git clone https://github.com/anasx07/AutaKimi.git
cd AutaKimi
npm install
```

### Running Development
- **Desktop:** `npm run dev:desktop`
- **Mobile:** `npm run dev:mobile`
- **Docs:** `npm run dev:page`

---

## 🛡️ Legal Posture & Neutrality

AutaKimi is a **neutral media viewer**. It does not host, provide, or pre-configure any copyrighted content. By using this software, users acknowledge that they are responsible for the third-party extension repositories they choose to add.

For information on contributing scrapers, please see the [Autakimi-Extensions](https://github.com/Autakimi-Ecosystem/autakimi-extensions) repository.

---

## ⚖️ License

AutaKimi is licensed under the **GNU General Public License v3.0**. See the [LICENSE](./LICENSE) file for details.

---

<p align="center">
  Crafted with passion by the AutaKimi Team
</p>
