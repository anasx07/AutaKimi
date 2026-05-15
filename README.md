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
