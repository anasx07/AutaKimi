# Contributing to AutaKimi

Thank you for your interest in contributing to AutaKimi! We are building a modern, privacy-first, cross-platform media viewer. 

## 🏗️ Architecture Overview

AutaKimi is structured as a **Monorepo** to share logic between Desktop and Mobile platforms efficiently.

- **`apps/desktop`**: Electron + React application.
- **`apps/mobile`**: Expo + React Native application.
- **`packages/sdk`**: The core logic (Networking, Sync, Extension Engine).
- **`github-page`**: Next.js landing page.

## 🛡️ Legal Boundary & Extensions

To protect the core project from DMCA liabilities, AutaKimi is an **Empty Shell**. It does not contain any built-in scrapers for specific copyrighted content.

### How to contribute Scrapers (Templates)

If you want to add or fix a scraper (e.g., Madara, MangaStream), do **NOT** open a Pull Request in this repository. Instead:

1.  Navigate to the [Autakimi-Extensions](https://github.com/Autakimi-Ecosystem/autakimi-extensions) repository.
2.  Contribute your logic to the `templates.json` file there.
3.  The main app will automatically fetch your changes on the next restart.

## 💻 Development Workflow

### Prerequisites
- Node.js (v20+)
- npm

### Setup
```bash
npm install
```

### Running Desktop
```bash
npm run dev:desktop
```

### Running Mobile
```bash
npm run dev:mobile
```

## 📜 Code of Conduct
Please be respectful to other contributors. Our goal is to build a neutral, high-quality tool for the community.

## ⚖️ License
By contributing to AutaKimi, you agree that your contributions will be licensed under the **GPL-3.0 License**.
