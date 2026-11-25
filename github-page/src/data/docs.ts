import type { LightboxImage } from "@/components/ui/image-lightbox";

export type DocCalloutTone = "note" | "tip" | "warning";

export interface DocCallout {
  tone: DocCalloutTone;
  title?: string;
  body: string;
}

export interface DocSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: Array<{ label?: string; text: string }>;
  steps?: string[];
  code?: { label?: string; snippet: string };
  callout?: DocCallout;
  screenshots?: Array<{
    src: string;
    alt: string;
    caption: string;
  }>;
  links?: Array<{
    label: string;
    href: string;
    external?: boolean;
  }>;
}

export interface DocPage {
  slug: string;
  category: "guides" | "faq" | "gallery";
  categoryLabel: string;
  title: string;
  subtitle: string;
  sections: DocSection[];
  isGallery?: boolean;
}

export interface DocNavGroup {
  id: string;
  title: string;
  items: Array<{
    slug: string;
    title: string;
  }>;
}

export const DOCS_GALLERY: LightboxImage[] = [
  {
    src: "/AutaKimi/assets/screenshots/manga-browse.webp",
    alt: "AutaKimi Manga Catalog",
    badge: "Catalog",
    title: "Unified Manga & Webtoon Discovery",
    description:
      "Multi-language catalogs across community repositories with repository filters.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-source-browse.png",
    alt: "Anime Source Browse Feed",
    badge: "Anime Feed",
    title: "Source Feed & Popular Catalog",
    description:
      "Browse Popular, Latest, and direct search feeds inside any installed anime source.",
  },
  {
    src: "/AutaKimi/assets/screenshots/history-anime.png",
    alt: "Anime History with Source Badges",
    badge: "Source Badges",
    title: "Cross-Source Anime History",
    description:
      "Every card displays its owning extension badge so duplicate series names never blur together.",
  },
  {
    src: "/AutaKimi/assets/screenshots/history-manga.png",
    alt: "Manga Reading History",
    badge: "Source Badges",
    title: "Cross-Source Manga History",
    description:
      "Resume from the last read chapter with per-extension attribution.",
  },
  {
    src: "/AutaKimi/assets/screenshots/library-anime.png",
    alt: "Saved Anime Library",
    badge: "Library",
    title: "Saved Anime Library",
    description:
      "Clean Anime & Manga shelves displaying source tags on covers.",
  },
  {
    src: "/AutaKimi/assets/screenshots/library-manga.png",
    alt: "Saved Manga Library",
    badge: "Library",
    title: "Saved Manga Library",
    description: "Local SQLite library with status metadata and source pills.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-player-sidebar.png",
    alt: "Anime Video Player with Sidebar",
    badge: "Anime Player",
    title: "Built-In Player, Skip Intro & Multi-Server",
    description:
      "Hardware-accelerated player with Skip Intro, Ambient Glow, Episode Sidebar, and instant server switch.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-player-fullscreen.png",
    alt: "Fullscreen Anime Player",
    badge: "Theater Mode",
    title: "Clean Fullscreen Overlay",
    description:
      "Minimal top controls with Auto-Next, server selector, and 1080p quality switch.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-mini-pip.png",
    alt: "Docked Mini Player",
    badge: "Mini Player",
    title: "In-App Dockable Mini Player",
    description:
      "Keep watching in the corner while browsing your library or managing downloads.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-floating-pip.png",
    alt: "System-wide Floating PiP",
    badge: "Floating PiP",
    title: "Always-On-Top Desktop Floating PiP",
    description:
      "Detach playback to float smoothly over other desktop windows.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-floating-pip-hover.png",
    alt: "Floating PiP Hover Controls",
    badge: "Floating PiP",
    title: "Floating PiP Quick Return & Playback Controls",
    description:
      "Hover the floating window to pause, skip, or snap straight back into the main tab.",
  },
  {
    src: "/AutaKimi/assets/screenshots/manga-reader-vertical.png",
    alt: "Vertical Webtoon Reader",
    badge: "Manga Reader",
    title: "Continuous Vertical Webtoon Reader",
    description:
      "Silky vertical scrolling with drag mode, Night Eye-Care tint, and minimal chrome.",
  },
  {
    src: "/AutaKimi/assets/screenshots/manga-reader-chapters.png",
    alt: "Reader Chapter Switcher",
    badge: "Manga Reader",
    title: "Instant Chapter Dropdown in Reader",
    description:
      "Switch directly between chapters without exiting your reading flow.",
  },
  {
    src: "/AutaKimi/assets/screenshots/themes-showcase.png",
    alt: "Themes Showcase",
    badge: "Themes",
    title: "Studio & Character Themes",
    description:
      "Customize workspace colors, monochrome studio modes, and character palettes.",
  },
  {
    src: "/AutaKimi/assets/screenshots/manga-details-rtl.png",
    alt: "Manga Details in Arabic RTL",
    badge: "Arabic RTL",
    title: "Native Arabic RTL & Chapter Details",
    description:
      "Complete right-to-left Arabic support with synopses, Smart Downloads, and AniList tracking.",
  },
  {
    src: "/AutaKimi/assets/screenshots/anime-details-episode-list.png",
    alt: "Anime Details & Episode List",
    badge: "AniList Sync",
    title: "Episode Tracking & Last-Watched State",
    description:
      "Track watched episodes with unread filters and automatic two-way AniList updates.",
  },
];

export const DOC_PAGES: DocPage[] = [
  // ─── GUIDES ─────────────────────────────────────────────────────────────
  {
    slug: "guides/getting-started",
    category: "guides",
    categoryLabel: "Guides",
    title: "Getting Started",
    subtitle:
      "Install AutaKimi on Windows 10/11 or Android, pick your interface language, and get ready to add extension repositories.",
    sections: [
      {
        id: "windows-install",
        title: "Installing on Windows Desktop",
        paragraphs: [
          "AutaKimi runs natively on Windows 10 and Windows 11 (64-bit) with hardware-accelerated playback and local SQLite storage—no Android emulator required.",
        ],
        steps: [
          "Download AutaKimi.exe from the latest GitHub Release or Changelog.",
          "Launch the installer (or run it directly) and wait for first-time initialization.",
          "Open Settings to choose English or Arabic (native RTL), pick your studio or character theme, and confirm auto-update checks.",
        ],
        links: [
          { label: "View Changelog & Releases", href: "/changelog" },
          {
            label: "GitHub Releases",
            href: "https://github.com/anasx07/AutaKimi/releases/latest",
            external: true,
          },
        ],
      },
      {
        id: "android-install",
        title: "Installing on Android",
        paragraphs: [
          "The Android companion app shares the same TypeScript extension runtime and SQLite data model as Desktop.",
        ],
        steps: [
          "Download app-arm64-v8a-release.apk (approx. 51 MB, built specifically for modern 64-bit ARM devices).",
          "Open the APK file on your phone and grant permission to install unknown apps if prompted.",
          "Optionally pair with Desktop via Settings → Local Wi-Fi Sync or import a .json.gz backup.",
        ],
        callout: {
          tone: "tip",
          title: "Which APK build should I pick?",
          body: "Almost all phones released in the past 8 years use 64-bit ARM (arm64-v8a). Grabbing the arm64 APK keeps install size around 51 MB instead of larger universal builds.",
        },
      },
      {
        id: "empty-shell-principle",
        title: "The Empty-Shell Architecture",
        paragraphs: [
          "AutaKimi does not bundle copyrighted media, scrapers, or hardcoded website URLs inside the core application. After installing the app, head to Browse → Repositories to connect a community repository of your choice.",
        ],
        links: [
          {
            label: "Next: Adding Repositories",
            href: "/docs/guides/repositories",
          },
        ],
      },
    ],
  },
  {
    slug: "guides/repositories",
    category: "guides",
    categoryLabel: "Guides",
    title: "Repositories & Multi-Repo Isolation",
    subtitle:
      "Connect AutaKimi manifests, Keiyoushi JSON indexes, or local developer directories side by side without version conflicts.",
    sections: [
      {
        id: "adding-a-repo",
        title: "Adding a Repository",
        paragraphs: [
          "AutaKimi supports official AutaKimi manifest.json endpoints, Keiyoushi index.min.json / index.json indexes, and local folder manifests during development.",
        ],
        steps: [
          "Navigate to Browse → Repositories (Windows) or Extensions → Repositories (Android).",
          "Paste the repository URL (for example, https://raw.githubusercontent.com/.../manifest.json or index.min.json).",
          "Select Add Repository. AutaKimi resolves the manifest and indexes catalogs automatically.",
        ],
      },
      {
        id: "repo-color-and-isolation",
        title: "Repo Colors & Isolated Versioning",
        paragraphs: [
          "When you add multiple repositories—for instance, both AutaKimi Ecosystem and Keiyoushi—every repository receives a deterministic color accent matching its card in Repositories.",
        ],
        bullets: [
          {
            label: "Strict repo pairing",
            text: "Each installed extension stores the repository URL it came from. Version update checks only compare against that owning repository.",
          },
          {
            label: "Coexistence (pkg::hash)",
            text: "If two repositories happen to publish an extension with the exact same package ID, installing the second copy automatically scopes it (pkg::hash) so both remain installed independently.",
          },
          {
            label: "Direct downloads",
            text: "Installing or updating fetches JavaScript bundles and metadata directly from that entry's owning repository URL.",
          },
        ],
        callout: {
          tone: "note",
          body: "Existing extensions installed prior to multi-repo support continue working seamlessly through automatic legacy pkg matching.",
        },
      },
      {
        id: "local-dev-repo",
        title: "Loading Local Repositories (Developers)",
        paragraphs: [
          "On Desktop, turn on Developer Mode in Settings to reveal the Load Local (manifest.json) picker on RepositoriesPage. This lets you test locally built extensions in autakimi-extensions/dist/ before pushing.",
        ],
        code: {
          label: "Build extensions locally before testing",
          snippet: "cd autakimi-extensions && npm run build && npm test",
        },
      },
    ],
  },
  {
    slug: "guides/extensions",
    category: "guides",
    categoryLabel: "Guides",
    title: "Extensions, Updates & Source Badges",
    subtitle:
      "Discover, install, update, pin, and distinguish extensions across your catalog, history, and library.",
    sections: [
      {
        id: "install-and-update",
        title: "Installing & Updating Extensions",
        steps: [
          "Open Browse → Extensions (Desktop) or Extensions (Android).",
          "Filter by language (Arabic, English, Multi, etc.), media type (Manga or Anime), or search by name.",
          "Click Install on any catalog card. When a repository publishes a newer semver version, an Update badge and Update All banner appear on both Desktop and Android.",
          "Click Update (or Update All) to pull the latest remote scraper code and bump the stored version immediately.",
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/manga-browse.webp",
            alt: "Manga Extension Catalog",
            caption: "Browse & Search Manga Extensions",
          },
          {
            src: "/AutaKimi/assets/screenshots/anime-source-browse.png",
            alt: "Anime Source Browse Feed",
            caption: "Anime Popular & Latest Feeds",
          },
        ],
      },
      {
        id: "source-badges",
        title: "Per-Extension Source Badges",
        paragraphs: [
          "You may read the same manga or watch the same anime across two or three different extensions. To eliminate ambiguity, every media cover card in History, Library, and Downloads displays a top-left source pill showing the extension name and repository accent dot.",
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/history-anime.png",
            alt: "Anime History with Source Badges",
            caption: "Source Badges on Anime History Cards",
          },
          {
            src: "/AutaKimi/assets/screenshots/history-manga.png",
            alt: "Manga History with Source Badges",
            caption: "Source Badges on Manga History Cards",
          },
        ],
      },
    ],
  },
  {
    slug: "guides/anime-player",
    category: "guides",
    categoryLabel: "Guides",
    title: "Anime Player & Floating PiP",
    subtitle:
      "Stream cleanly with Skip Intro, ambient edge lighting, multi-server fallback, docked Mini Player, and desktop Floating PiP.",
    sections: [
      {
        id: "theater-controls",
        title: "Player Controls & Multi-Server",
        bullets: [
          {
            label: "Multi-Server & Quality Selector",
            text: "Switch video mirrors or resolution tiers directly inside the player toolbar when an external host slows down.",
          },
          {
            label: "Skip Intro & Auto-Next",
            text: "Jump past opening sequences with one click (or hotkey S) and automatically queue the next episode.",
          },
          {
            label: "Ambient Glow",
            text: "Samples subtle edge lighting around the player canvas without washing out dark scenes.",
          },
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/anime-player-sidebar.png",
            alt: "Anime Player Sidebar View",
            caption: "Anime Player · Skip Intro, Ambient & Episode Sidebar",
          },
          {
            src: "/AutaKimi/assets/screenshots/anime-player-fullscreen.png",
            alt: "Fullscreen Anime Player",
            caption: "Minimal Fullscreen Overlay",
          },
        ],
      },
      {
        id: "mini-pip-and-floating",
        title: "Dockable Mini Player & System Floating PiP",
        paragraphs: [
          "Multitask without pausing playback. Toggle Mini PiP inside the app to keep video docked in the bottom-right corner while browsing Library or Settings, or pop playback out into a borderless Always-On-Top Floating PiP window over any desktop application.",
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/anime-mini-pip.png",
            alt: "Docked Mini Player",
            caption: "Docked Mini Player Inside Library",
          },
          {
            src: "/AutaKimi/assets/screenshots/anime-floating-pip.png",
            alt: "System Floating PiP",
            caption: "Always-On-Top Floating PiP Over Other Apps",
          },
        ],
      },
    ],
  },
  {
    slug: "guides/manga-reader",
    category: "guides",
    categoryLabel: "Guides",
    title: "Manga & Webtoon Reader",
    subtitle:
      "Customize continuous vertical webtoon scrolling, drag gestures, chapter jumping, and Night Eye-Care tinting.",
    sections: [
      {
        id: "reading-modes",
        title: "Continuous Vertical, RTL & Drag Scroll",
        bullets: [
          {
            label: "Continuous Vertical Mode",
            text: "Reads seamlessly across chapters—progress indicators, current chapter title, and chapter dropdown synchronize automatically with your scroll viewport.",
          },
          {
            label: "Drag Scroll Mode",
            text: "Click and drag anywhere on the canvas on Desktop for effortless one-handed scrolling.",
          },
          {
            label: "Quick Chapter Switcher",
            text: "Open the center header dropdown to jump directly between chapters without returning to series details.",
          },
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/manga-reader-vertical.png",
            alt: "Vertical Webtoon Reader",
            caption: "Continuous Vertical Webtoon Mode",
          },
          {
            src: "/AutaKimi/assets/screenshots/manga-reader-chapters.png",
            alt: "Reader Chapter Selector",
            caption: "Quick Chapter Switcher Dropdown",
          },
        ],
      },
      {
        id: "night-eye-care",
        title: "Night Eye-Care Tint Filter",
        paragraphs: [
          "Enable the Kindle-inspired Night Eye-Care filter directly inside the reader bar. Adjust the warm sepia tint strength and custom dimming slider to reduce blue-light glare at night without changing your Windows or Android system brightness.",
        ],
        callout: {
          tone: "tip",
          body: "Eye-Care settings persist cleanly so you only configure your ideal late-night warmth and brightness level once.",
        },
      },
    ],
  },
  {
    slug: "guides/downloads",
    category: "guides",
    categoryLabel: "Guides",
    title: "Smart Downloads & Offline CBZ",
    subtitle:
      "Download full manga chapters as standard .cbz archives or turn on Netflix-style Smart Downloads for automated caching and cleanup.",
    sections: [
      {
        id: "smart-downloads",
        title: "Netflix-Style Smart Downloads",
        paragraphs: [
          "When Smart Downloads is enabled, starting a chapter automatically pre-downloads the next 3 unread chapters in the background so page turns never stall on slow Wi-Fi or mobile data.",
        ],
        bullets: [
          {
            label: "Auto-Cleanup",
            text: "Finished chapters are automatically removed once you move past them so offline caches never silently consume your disk.",
          },
          {
            label: "Cross-Platform",
            text: "Available on both Desktop and Android inside Settings and Reader preferences.",
          },
        ],
      },
      {
        id: "cbz-and-offline",
        title: "Bulk Downloads & .cbz Archives",
        paragraphs: [
          "From any Manga details view, queue chapters into the background downloader. Completed chapters are packaged as standard .cbz comic archives inside your local app data folder and can be read offline anytime from Downloads.",
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/library-manga.png",
            alt: "Saved Manga Library",
            caption: "Library & Offline Ready Series",
          },
          {
            src: "/AutaKimi/assets/screenshots/library-anime.png",
            alt: "Saved Anime Library",
            caption: "Anime Library With Extension Badges",
          },
        ],
      },
    ],
  },
  {
    slug: "guides/lan-sync",
    category: "guides",
    categoryLabel: "Guides",
    title: "Local Wi-Fi Sync & .json.gz Backups",
    subtitle:
      "Keep your Windows PC and Android phone synchronized over local Wi-Fi—or back up everything offline in compressed archives.",
    sections: [
      {
        id: "lan-sync-flow",
        title: "Syncing Over Local Wi-Fi (LAN)",
        paragraphs: [
          "Your Desktop app includes a lightweight local sync host. No external accounts, passwords, or cloud databases are ever touched.",
        ],
        steps: [
          "Make sure both Windows PC and Android phone are connected to the same Wi-Fi router.",
          "Open Settings → Sync on Desktop to view your pairing code / local sync endpoint.",
          "On Android, open More → Sync (or scan the pairing QR code) to discover your Desktop and merge library items, bookmarks, and reading history.",
        ],
      },
      {
        id: "gz-backups",
        title: "Creating & Restoring .json.gz Backups",
        paragraphs: [
          "Use Export Backup in Settings to snapshot your entire SQLite library, history, tracking links, and installed extensions metadata into a single compressed .json.gz file. Import that file on any fresh Windows or Android install to restore immediately.",
        ],
        callout: {
          tone: "warning",
          title: "Media files are not embedded in .json.gz",
          body: "Backups store your database metadata cleanly at tiny file sizes; downloaded .cbz chapters remain stored locally on each device.",
        },
      },
    ],
  },
  {
    slug: "guides/tracking-stats",
    category: "guides",
    categoryLabel: "Guides",
    title: "AniList, Wrapped Stats & Discord",
    subtitle:
      "Configure two-way AniList scrobbling, browse your private Wrapped analytics dashboard, and toggle Discord Rich Presence.",
    sections: [
      {
        id: "anilist-setup",
        title: "AniList Two-Way Scrobbling",
        bullets: [
          {
            label: "Automatic Updates",
            text: "Finishing a chapter or episode updates your progress count directly on AniList.",
          },
          {
            label: "Auto-Completion",
            text: "Reaching the final chapter or episode of a completed series automatically transitions its status from CURRENT to COMPLETED.",
          },
          {
            label: "Offline SQLite Retry Queue",
            text: "No signal? Updates queue safely inside SQLite and replay once your connection returns.",
          },
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/anime-details-episode-list.png",
            alt: "Anime Episode Tracking View",
            caption: "Episode Tracking & Last Read State",
          },
          {
            src: "/AutaKimi/assets/screenshots/manga-details-rtl.png",
            alt: "Manga Tracking & Details View",
            caption: "Series Details, Tracking & Arabic RTL",
          },
        ],
      },
      {
        id: "wrapped-and-discord",
        title: "Local Wrapped Stats & Discord Rich Presence",
        bullets: [
          {
            label: "Local Wrapped Dashboard",
            text: "Because AutaKimi logs durationSeconds locally inside reading_history, Settings → Stats renders weekly Anime and Manga tabs showing total watch/read time, daily streaks, and top genres—100% offline.",
          },
          {
            label: "Discord Rich Presence",
            text: "Toggle Rich Presence in Settings to display Watching <Title> • Ep X or Reading <Title> • Ch X on your Discord profile (Desktop).",
          },
        ],
        screenshots: [
          {
            src: "/AutaKimi/assets/screenshots/themes-showcase.png",
            alt: "Settings & Themes Showcase",
            caption: "Settings & Studio Theme Customization",
          },
        ],
      },
    ],
  },
  {
    slug: "guides/troubleshooting",
    category: "guides",
    categoryLabel: "Guides",
    title: "Troubleshooting & Cloudflare Bypass",
    subtitle:
      "Resolve Cloudflare challenges, changing domain mirrors, empty covers, and stale caches cleanly.",
    sections: [
      {
        id: "cloudflare-checks",
        title: "Handling Cloudflare / Anti-Bot Checks",
        paragraphs: [
          "Some community websites enforce Cloudflare cookies before serving search pages or chapter images. AutaKimi maintains a dedicated persist:cloudflare partition on Desktop and native cookie storage on Android.",
        ],
        steps: [
          "When prompted (or from Settings / CF Bypass), open the source page inside the built-in browser window.",
          "Wait for the site page to finish loading normally so cookies persist.",
          "Return to Browse or retry your chapter/episode request.",
        ],
      },
      {
        id: "domain-overrides",
        title: "Site Domain Changes (Domain Override)",
        paragraphs: [
          "Many manga and anime hosts rotate TLDs frequently. Instead of waiting for an extension bump, open the extension's domain override setting to point it directly at the active mirror domain.",
        ],
      },
      {
        id: "missing-covers-or-logs",
        title: "Missing Covers or Stream Errors",
        bullets: [
          {
            label: "Missing history covers",
            text: "Re-open any series once from Browse or Library—AutaKimi backfills both missing covers in reading_history and resolves cover headers cleanly.",
          },
          {
            label: "Stale extension state",
            text: "Click Refresh in Browse and install any pending Extension updates before reporting a broken source.",
          },
        ],
      },
    ],
  },

  // ─── FREQUENTLY ASKED QUESTIONS ─────────────────────────────────────────
  {
    slug: "faq/general",
    category: "faq",
    categoryLabel: "FAQ",
    title: "General",
    subtitle:
      "Common questions about AutaKimi, licensing, supported platforms, and privacy.",
    sections: [
      {
        id: "is-autakimi-free",
        title: "Is AutaKimi free and open source?",
        paragraphs: [
          "Yes. AutaKimi is completely free and licensed under GPL-3.0. There are zero ads, zero paywalls, and zero analytics or telemetry.",
        ],
      },
      {
        id: "vs-mihon-aniyomi",
        title: "How does AutaKimi compare to Tachiyomi, Mihon, or Aniyomi?",
        paragraphs: [
          "Mihon and Aniyomi are Android-only applications. AutaKimi is built from the ground up with a shared TypeScript SDK so you get native performance on Windows PC and Android phones alike, plus built-in local LAN Wi-Fi sync between them.",
        ],
      },
      {
        id: "supported-platforms",
        title: "Which operating systems are supported?",
        paragraphs: [
          "AutaKimi targets Windows 10/11 (64-bit .exe) and Android 5.0+ (arm64-v8a APK).",
        ],
      },
    ],
  },
  {
    slug: "faq/library-and-history",
    category: "faq",
    categoryLabel: "FAQ",
    title: "Library & History",
    subtitle:
      "Frequently asked questions about covers, duplicate titles across sources, and reading history.",
    sections: [
      {
        id: "duplicate-titles-in-history",
        title: "Why do I see the same anime or manga twice in History?",
        paragraphs: [
          "If you started watching or reading the same series on two different extensions (for example, RistoAnime and Anime4Up), each source maintains its own entry. Every card displays a top-left source pill with the extension name so you can tell them apart immediately.",
        ],
      },
      {
        id: "blank-anime-covers",
        title: "Why did an older anime history entry show a blank cover?",
        paragraphs: [
          "Some anime extractors omit cover art inside episode feeds. AutaKimi now retrieves and caches cover URLs from series details/library automatically; opening the series page once refreshes any blank entry.",
        ],
      },
    ],
  },
  {
    slug: "faq/browse-and-extensions",
    category: "faq",
    categoryLabel: "FAQ",
    title: "Browse & Extensions",
    subtitle:
      "Frequently asked questions about installing extensions, updates, and multiple repositories.",
    sections: [
      {
        id: "update-badge-persists",
        title: "What if an extension keeps showing 'Update' after updating?",
        paragraphs: [
          "Fixed in v2.3.0: updates now strictly use the remote catalog payload (version + source code) and recompute availability synchronously against the installed version using semver comparison.",
        ],
      },
      {
        id: "same-pkg-two-repos",
        title: "Can I add both Keiyoushi and AutaKimi repositories at once?",
        paragraphs: [
          "Yes. Catalog entries are keyed per repository, each repo shows its matching color badge, and if two repos ever share the exact same package ID, installing both automatically scopes the second copy (pkg::hash) so neither overwrites the other.",
        ],
      },
      {
        id: "mobile-updates",
        title: "Can I update extensions directly on Android?",
        paragraphs: [
          "Yes. Both the Installed and Available tabs in Android Extensions display version diffs (vOld → vNew), per-item Update buttons, and a one-tap Update All banner.",
        ],
      },
    ],
  },
  {
    slug: "faq/reader-and-player",
    category: "faq",
    categoryLabel: "FAQ",
    title: "Reader & Player",
    subtitle:
      "Frequently asked questions about video playback, Floating PiP, and manga reading modes.",
    sections: [
      {
        id: "pip-outside-app",
        title: "How do I keep watching an episode while using other apps?",
        paragraphs: [
          "Click Floating PiP in the Anime Player controls. Video detaches into an always-on-top window you can move anywhere on your desktop, with quick pause/return controls on hover.",
        ],
      },
      {
        id: "eyecare-brightness",
        title: "Does Night Eye-Care change my Windows or Android brightness?",
        paragraphs: [
          "No. Night Eye-Care applies a warm sepia overlay and dimming filter exclusively inside the reader canvas, leaving your OS brightness slider untouched.",
        ],
      },
    ],
  },
  {
    slug: "faq/downloads-and-sync",
    category: "faq",
    categoryLabel: "FAQ",
    title: "Downloads, Sync & Storage",
    subtitle:
      "Frequently asked questions about Smart Downloads, .cbz storage, and Wi-Fi synchronization.",
    sections: [
      {
        id: "smart-downloads-space",
        title: "Will Smart Downloads fill up my storage?",
        paragraphs: [
          "No. Smart Downloads caches the next 3 unread chapters ahead of you and automatically deletes chapters once you finish reading them.",
        ],
      },
      {
        id: "cloud-account-needed",
        title: "Do I need an account for PC-to-Android Sync?",
        paragraphs: [
          "Never. Sync works directly over your home Wi-Fi network (LAN), or completely offline using compressed .json.gz backup files.",
        ],
      },
    ],
  },

  // ─── GALLERY ────────────────────────────────────────────────────────────
  {
    slug: "gallery",
    category: "gallery",
    categoryLabel: "Visual Tour",
    title: "Screenshots Gallery",
    subtitle:
      "High-resolution desktop screenshots across playback, PiP multitasking, reading modes, history badges, and themes. Click any image to open fullscreen.",
    isGallery: true,
    sections: [
      {
        id: "all-screenshots",
        title: "All Interface Screenshots",
      },
    ],
  },
];

export const DOCS_NAV_GROUPS: DocNavGroup[] = [
  {
    id: "guides",
    title: "Guides",
    items: DOC_PAGES.filter((p) => p.category === "guides").map((p) => ({
      slug: p.slug,
      title: p.title,
    })),
  },
  {
    id: "faq",
    title: "Frequently Asked Questions",
    items: DOC_PAGES.filter((p) => p.category === "faq").map((p) => ({
      slug: p.slug,
      title: p.title,
    })),
  },
  {
    id: "gallery",
    title: "Visual Tour",
    items: DOC_PAGES.filter((p) => p.category === "gallery").map((p) => ({
      slug: p.slug,
      title: p.title,
    })),
  },
];

export function findDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

export function getPrevNextDocs(slug: string): {
  prev?: DocPage;
  next?: DocPage;
} {
  const index = DOC_PAGES.findIndex((p) => p.slug === slug);
  if (index === -1) return {};
  return {
    prev: index > 0 ? DOC_PAGES[index - 1] : undefined,
    next: index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : undefined,
  };
}
