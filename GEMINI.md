# AutaKimi — AI Assistant Guidelines & Project Manual (GEMINI.md)

Welcome to **AutaKimi**! This document provides persistent project architecture, coding standards, development workflows, and critical rules for AI assistants (Antigravity / Gemini).

---

## 1. 🏗️ Monorepo Architecture

AutaKimi is a modern, cross-platform media and manga viewer built with a monorepo structure:

| Package | Path | Tech Stack | Role |
| :--- | :--- | :--- | :--- |
| **Desktop App** | `apps/desktop` | Electron, React, Vite, Tailwind CSS, TypeScript | Desktop client with custom video/webtoon reader, sync server, and stream proxy |
| **Mobile App** | `apps/mobile` | Expo SDK 58, React Native 0.88, TypeScript | Mobile client with gesture navigation, offline storage, and sync client |
| **Core SDK** | `packages/sdk` | TypeScript (Node/Universal) | Shared domain logic, extension engine, networking, sync protocols, and models |
| **Web Page** | `github-page` | Next.js, Tailwind CSS | Public landing page and documentation |

### 🛡️ Legal Boundary & External Extensions Repository
- **Empty Shell Architecture**: AutaKimi core repo is strictly an empty media viewer shell. It **never** contains hardcoded scrapers, site parsers, or direct references to copyrighted third-party media sources.
- **Dedicated External Repository**:
  - All scrapers, parsers, and source definitions reside in the dedicated external repository:
    👉 **[Autakimi-Ecosystem/autakimi-extensions](https://github.com/Autakimi-Ecosystem/autakimi-extensions)** (`templates.json` & `js/`).
- **Separation of Concerns**:
  - `AutaKimi` core repo: Contains only the sandboxed extension engine (`packages/sdk`), desktop/mobile UI, video players, and local reader implementations.
  - `autakimi-extensions` repo: Contains community source templates, scrapers, and domain definitions.
- **AI Rule**: **NEVER** add or commit website scrapers, anime stream extractors, or manga providers inside the `AutaKimi` repository. Any scraping logic requested by the user must be contributed to `autakimi-extensions`.

---

## 2. ⚡ Development & Build Commands

Always run commands from the repository root or target the appropriate workspace:

```bash
# General Quality Checks (run before pushing changes)
npm run lint                 # ESLint check across all workspaces
npm run format               # Format code with Prettier

# Desktop App
npm run dev:desktop          # Launch Electron in development mode
npm run build:desktop        # Build desktop production bundle
npm run typecheck --prefix apps/desktop  # Typecheck node & web configs for desktop

# Mobile App
npm run dev:mobile           # Start Expo development server
npm run build:apk            # Execute local Android build script
npm run emulator             # Launch configured Android emulator

# Android Native (apps/mobile/android)
./gradlew :app:assembleRelease --dry-run   # Dry run release tasks
./gradlew :app:assembleRelease            # Build release APK
```

---

## 3. 🔒 Git & Branching Protocol (Strictly Enforced)

> [!IMPORTANT]
> The `main` branch is protected on GitHub (`GH013`). **Direct pushes to `main` will fail.**

All automated agent changes targeting `main` must strictly follow this workflow:
1. Create a dedicated feature branch:
   ```bash
   git checkout -b <branch-name>
   ```
2. Commit changes with Conventional Commits (`fix(...)`, `feat(...)`, `refactor(...)`):
   ```bash
   git add <files>
   git commit -m "fix(scope): brief description"
   ```
3. Push the feature branch to origin:
   ```bash
   git push origin <branch-name>
   ```
4. Open a Pull Request via GitHub REST API targeting `main` and squash-merge it.
5. Switch back to `main`, pull the merge, and clean up the feature branch:
   ```bash
   git checkout main
   git pull origin main
   git branch -D <branch-name>
   git push origin --delete <branch-name>
   ```

---

## 4. 🧠 Key Architectural Patterns & Critical Rules

### A. Electron `webRequest` Central Dispatcher
- **Single Listener Restriction**: Electron's `session.defaultSession.webRequest` methods (`onBeforeSendHeaders`, `onHeadersReceived`) support **only one listener per session**. Registering a second listener silently overwrites the first!
- **Rule**: All `webRequest` handling is centralized in [apps/desktop/src/main/index.ts](apps/desktop/src/main/index.ts).
- Never register `session.defaultSession.webRequest` hooks inside standalone services. Instead, provide helper methods (e.g. `streamProxyService.applyRequestHeaders()` and `streamProxyService.applyResponseHeaders()`) and call them from the central dispatcher in `main/index.ts`.

### B. Mobile / Android Build Compatibility (Expo 58 & AGP 9)
- **AGP 9.2.1 + Gradle 9.4.1 Configuration**:
  In [apps/mobile/android/gradle.properties](apps/mobile/android/gradle.properties), the following flags are **mandatory**:
  ```properties
  # Opt out of AGP 9 built-in kotlin and new DSL behavior for Expo 58 compatibility
  android.builtInKotlin=false
  android.newDsl=false
  ```
  - `android.newDsl=false` preserves `libraryVariants` and `applicationVariants` required by `expo-constants`.
  - `android.builtInKotlin=false` prevents conflicts with `org.jetbrains.kotlin.android`.
- **Keystore Fallback**: In `apps/mobile/android/app/build.gradle`, verify keystore existence (`file(keystorePath).exists()`) and fallback to `debug.keystore` when `release.keystore` is missing so automated or local builds don't fail.
- **CI Environment**: Android builds in GitHub Actions should run on `ubuntu-latest` to avoid Windows 260-character `MAX_PATH` limitations during Ninja/CMake builds (specifically for `react-native-reanimated`).

### C. Continuous / Webtoon Reader Synchronization
- **Viewport Detection**:
  - Root viewport observer in [apps/desktop/src/renderer/src/widgets/reader/components/ChapterSection.tsx](apps/desktop/src/renderer/src/widgets/reader/components/ChapterSection.tsx) uses `{ root: scrollRoot, threshold: 0, rootMargin: '-10% 0px -70% 0px' }`.
  - Callbacks (`onVisible`, `onPageVisible`, `onHalfway`) must be tracked through `useRef` to avoid stale closures in IntersectionObserver instances.
- **Multi-Chapter DOM Query Scoping**:
  - When scrubbing or jumping to pages in a multi-chapter continuous view, **always scope DOM queries to the active chapter container**:
    ```ts
    const pageEl = scrollRef.current?.querySelector(
      `[data-chapter-id="${CSS.escape(activeChapter.id)}"] [data-page-index="${targetPage - 1}"]`
    )
    ```
  - Always update `activeChapter`, `currentPage`, `totalPages`, and `chapter.number` synchronously so toolbars and progress bars never desynchronize.

---

## 5. 🎨 Code Style & Quality Standards

- **TypeScript**: Strict type checking. Avoid `any` wherever possible. Ensure all types match Electron / React Native SDK definitions.
- **Linting & Formatting**: Must pass `npm run lint` with 0 warnings/errors before opening PRs.
- **Component Design**: Modular React components with clear separation between state (custom hooks/services) and presentation.
- **Safe Case Sensitivity**: When mutating HTTP headers, perform case-insensitive key cleanup before applying new values to prevent duplicate conflicting headers (e.g. `Referer` vs `referer`).

---

## 6. 🚀 Release Protocol & CI/CD (`.github/workflows/release.yml`)

AutaKimi uses GitHub Actions to automate cross-platform release builds:

### A. Version Bumping Checklist
When preparing a new release version `vX.Y.Z`, update:
1. Root `package.json`: `"version": "X.Y.Z"`
2. Desktop `apps/desktop/package.json`: `"version": "X.Y.Z"`
3. Mobile `apps/mobile/app.json`: `"version": "X.Y.Z"` (and increment `android.versionCode` for Google Play / updates)

### B. Triggering a Release
A release is triggered automatically by pushing a Git tag or manually via workflow dispatch:
```bash
# 1. Ensure all changes are merged to main and local main is up to date
git checkout main
git pull origin main

# 2. Create and push the release tag
git tag v2.1.0
git push origin v2.1.0

# If re-tagging an existing release after a fix:
git tag -f v2.1.0
git push origin v2.1.0 --force
```

### C. Pipeline Jobs & Artifacts
The GitHub Actions workflow runs three parallel/sequential jobs:
1. **`build-desktop` (Windows)**:
   - Builds `AutaKimi.exe` installer, `.blockmap`, and `latest.yml` via `electron-builder`.
2. **`build-android` (Ubuntu Linux)**:
   - Uses Java 21 Temurin, Gradle 9.4.1, Node 22.
   - Decodes `ANDROID_KEYSTORE_BASE64` secret (or falls back to `debug.keystore`).
   - Runs `./gradlew assembleRelease` generating 5 APK variants:
     - `app-arm64-v8a-release.apk`
     - `app-armeabi-v7a-release.apk`
     - `app-universal-release.apk`
     - `app-x86-release.apk`
     - `app-x86_64-release.apk`
3. **`publish`**:
   - Collects both desktop and Android artifacts and creates or updates (`--clobber`) the GitHub Release under `TAG`.

