# 🌌 AutaKimi

**AutaKimi** is a modern, privacy-first, cross-platform media framework designed for organized Manga, Webtoon, and Anime consumption. Built with a decentralized "empty shell" architecture, it provides an ultra-fast, native experience across **Windows, Android, and iOS** without accounts, telemetry, or centralized tracking.

[![CI & Quality Verification](https://github.com/anasx07/AutaKimi/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/anasx07/AutaKimi/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/Version-2.1.1-blue.svg)](https://github.com/anasx07/AutaKimi/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-green.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Website](https://img.shields.io/badge/Website-anasx07.github.io%2FAutaKimi-purple)](https://anasx07.github.io/AutaKimi/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Desktop-Electron%2033-47848F.svg)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/UI-React%2019-61DAFB.svg)](https://react.dev/)
[![Expo](https://img.shields.io/badge/Mobile-Expo%2052-000020.svg)](https://expo.dev/)

---

## ✨ Key Features

- **🛡️ 100% Privacy-First & Local-First:** No accounts, no telemetry, and zero tracking. Your entire library, bookmarks, and watch history are stored locally on your device in a high-performance SQLite database via Drizzle ORM.
- **🎬 Advanced Anime Video Player:**
  - **Direct Stream Extraction:** Prioritizes direct MP4/HLS streams from popular hosting providers (VOE, Uqload, VidMoly, MixDrop, StreamRuby) for smooth, ad-free playback.
  - **Dead Stream Probing & Auto-Failover:** Automatically detects broken embeds or dead notices and switches to available mirrors in real time.
  - **Malicious Popup & Redirect Blocker:** Sandboxed iframe execution prevents ad hijacks and unwanted browser popups.
  - **Full Playback Controls:** Multi-speed playback, audio/subtitle selector, and auto-next episode progression.
- **📖 Comprehensive Manga & Webtoon Reader:**
  - Continuous vertical webtoon mode, single-page, and double-page reading.
  - Intelligent image preloading, pinch-to-zoom, and offline chapter caching.
- **📱 Local Wi-Fi P2P Syncing:** Seamlessly pair and synchronize your library, reading progress, and watch history between Desktop and Mobile devices over your local Wi-Fi without third-party cloud servers.
- **🧩 Dynamic Decoupled Extensions:** The app acts as an "empty shell". Content sources, scraping templates, and video extractors are loaded dynamically from community-maintained remote repositories.
- **☁️ Cloudflare & Anti-Bot Protection:** Built-in "User-Solved" verification system with cookie clearance persistence, paired with automated headless solver plugins (`auto-solve-cf`).
- **⚡ Sandboxed Worker Thread Execution:** All extension scraping logic runs in dedicated background `Worker` threads with locked-down V8 `vm.Script` contexts, ensuring the user interface remains butter-smooth and immune to scraping freezes.
- **🛠️ In-App Developer Mode:** Load and test extension directories directly from your local filesystem (`autakimi-local://`) without pushing to Git.

---

## 🏗️ Monorepo Architecture

AutaKimi is organized as a unified TypeScript monorepo using npm workspaces:

```
AutaKimi/
├── apps/
│   ├── desktop/          # Electron application (React 19, Vite, TailwindCSS, Drizzle ORM, Worker Threads)
│   └── mobile/           # Cross-platform mobile app (Expo SDK 52, React Native, NativeWind, Hermes)
├── packages/
│   └── sdk/              # Universal core SDK (Extension Engine, P2P Sync, Network Client, Templates)
├── github-page/          # Next.js-powered official documentation and landing page
└── scripts/              # Automated build scripts for Android APKs and developer environment
```

---

## 🛡️ Security & Sandbox Architecture

AutaKimi guarantees host process safety against untrusted third-party extension code through a strict multi-layer sandbox:

1. **Worker Threads Isolation:** All extension scrapers run inside dedicated Node.js `worker_threads` with a locked-down V8 `vm.Script` context. Memory is isolated, and execution is strictly monitored by a 30-second watchdog timer.
2. **Safe Template Engine:** Scraping templates are interpolated purely in memory using safe string replacements—**never** evaluating untrusted strings with `eval()` or `new Function()` in the main process.
3. **Monitored Network Gateway:** Scraper network calls pass through a managed network manager that scrubs sensitive headers and blocks requests to private/loopback IP addresses (SSRF prevention).
4. **Persistent Local Vault:** Installed extensions and compiled bytecode bundles are stored locally in an encrypted/isolated SQLite database, enabling full offline startup and execution.

---

## 📖 Adding Extensions (Repositories)

AutaKimi does not bundle any media sources by default. To discover content, subscribe to an official or community extension repository:

1. Open **AutaKimi** and go to **Settings** ➔ **Extensions / Repositories**.
2. Click **Add Repository** and enter the official community repository URL:
   ```http
   https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/dist/manifest.json
   ```
3. Click **Add**. AutaKimi will automatically hydrate available Manga catalogs, Anime sources, and scraping templates across 20+ languages.

> [!NOTE]
> For information on creating or contributing extensions, visit the [AutaKimi Extensions Repository](https://github.com/Autakimi-Ecosystem/autakimi-extensions).

---

## 🛠️ Developer Setup & Local Building

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10+`
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/anasx07/AutaKimi.git
cd AutaKimi

# Install all monorepo dependencies
npm install
```

### Running Development Environments

```bash
# Start Electron Desktop App
npm run dev:desktop

# Start Expo Mobile App
npm run dev:mobile

# Start Documentation Website
npm run dev:page
```

### Building for Production

```bash
# Build Electron Desktop distribution (Windows/macOS/Linux)
npm run build:desktop

# Build Android APK (Requires Android SDK & Gradle)
npm run build:apk

# Code Quality Checks
npm run lint
npm run format
```

---

## 🧪 Local Extension Testing (Developer Mode)

AutaKimi includes a built-in **Developer Mode** for authors building custom extensions:

1. Go to **Settings** ➔ **Advanced Settings** and enable **Developer Mode**.
2. Navigate to **Settings** ➔ **Extensions**.
3. Click the **"Load Local Directory"** button and select your local `autakimi-extensions/dist/` folder.
4. The app's **Local File System Interceptor** will route repository queries directly to your local files, allowing you to iterate on scrapers in real time without committing to GitHub!

---

## 🛡️ Legal Notice & Neutrality

**AutaKimi** is a **neutral media framework and open-source browser utility**.

- It does not host, provide, cache, stream, or distribute any copyrighted media content.
- It does not come pre-packaged with any content repositories or media links.
- Users have sole discretion and responsibility over the third-party extension repositories they choose to add.

---

## ⚖️ License

AutaKimi is distributed under the terms of the **GNU General Public License v3.0 (GPLv3)**. See the [LICENSE](./LICENSE) file for more details.

---

<p align="center">
  Crafted with ❤️ by the <b>AutaKimi Team</b> &bull; <a href="https://github.com/anasx07/AutaKimi">GitHub Repository</a>
</p>
