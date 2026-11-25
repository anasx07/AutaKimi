import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata = {
  metadataBase: new URL("https://anasx07.github.io/AutaKimi"),
  title:
    "AutaKimi - Modern Cross-Platform Manga & Anime Reader (Windows & Android)",
  description:
    "The ultimate privacy-first manga & anime reader for Windows and Android. Tachiyomi & Aniyomi inspired PC alternative with local Wi-Fi sync, AniList tracking, and offline CBZ support.",
  keywords: [
    "Tachiyomi for PC",
    "Tachiyomi PC alternative",
    "Aniyomi PC alternative",
    "Mihon alternative",
    "Manga reader Windows",
    "Manga reader Android",
    "Open source manga reader",
    "AniList tracker PC",
    "CBZ reader Windows",
    "Webtoon reader desktop",
    "AutaKimi",
    "Anime player PC",
    "Offline manga reader",
    "Arabic localization",
  ],
  icons: {
    icon: "/AutaKimi/favicon.png",
    shortcut: "/AutaKimi/favicon.png",
    apple: "/AutaKimi/assets/branding/icon.png",
  },
  openGraph: {
    title:
      "AutaKimi - Modern Cross-Platform Manga & Anime Reader (Windows & Android)",
    description:
      "The ultimate privacy-first manga & anime reader for Windows and Android. Tachiyomi & Aniyomi inspired PC alternative with local Wi-Fi sync, AniList tracking, and offline CBZ support.",
    url: "https://anasx07.github.io/AutaKimi",
    siteName: "AutaKimi",
    images: [
      {
        url: "/AutaKimi/assets/screenshots/manga-browse.png",
        width: 1280,
        height: 720,
        alt: "AutaKimi - Manga and Anime Reader",
      },
      {
        url: "/AutaKimi/assets/branding/icon.png",
        width: 512,
        height: 512,
        alt: "AutaKimi Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "AutaKimi - Modern Cross-Platform Manga & Anime Reader (Windows & Android)",
    description:
      "The ultimate privacy-first manga & anime reader for Windows and Android. Tachiyomi & Aniyomi inspired PC alternative with local Wi-Fi sync, AniList tracking, and offline CBZ support.",
    images: ["/AutaKimi/assets/screenshots/manga-browse.png"],
  },
  alternates: {
    canonical: "https://anasx07.github.io/AutaKimi",
  },
  verification: {
    google: "oLob_47r8e6mHEe8beX6u_sSm-eGtaljDpJQkZ_jeuw",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://anasx07.github.io/AutaKimi/#software",
      name: "AutaKimi",
      operatingSystem: "Windows 10, Windows 11, Android",
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Comic and Manga Reader",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Free and open-source cross-platform manga and anime reader for Windows and Android with local Wi-Fi sync, AniList scrobbling, and offline CBZ library support.",
      url: "https://anasx07.github.io/AutaKimi",
      downloadUrl: "https://github.com/anasx07/AutaKimi/releases",
      image: "https://anasx07.github.io/AutaKimi/assets/branding/icon.png",
      screenshot: [
        "https://anasx07.github.io/AutaKimi/assets/screenshots/manga-browse.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/anime-player-sidebar.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/anime-mini-pip.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/manga-reader-vertical.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/history-anime.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/manga-details-rtl.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/anime-details-episode-list.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/themes-showcase.png",
      ],
      softwareVersion: "2.3.0",
      author: {
        "@type": "Person",
        name: "anasx07",
        url: "https://github.com/anasx07",
      },
      license: "https://www.gnu.org/licenses/gpl-3.0.html",
      featureList: [
        "Vertical Webtoon and Right-to-Left (RTL) Manga Reading",
        "Offline CBZ, ZIP, and Local Folder Support",
        "Native Local Wi-Fi Sync without Cloud Accounts",
        "AniList Episode and Chapter Progress Tracking",
        "Zero Ads and Privacy-First Empty Shell Architecture",
        "Windows Desktop and Android APK Cross-Platform Parity",
        "Tachiyomi and Aniyomi Inspired Experience for PC",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://anasx07.github.io/AutaKimi/#website",
      url: "https://anasx07.github.io/AutaKimi",
      name: "AutaKimi",
      description:
        "Modern Cross-Platform Manga & Anime Reader for Windows & Android",
      publisher: {
        "@type": "Person",
        name: "anasx07",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://anasx07.github.io/AutaKimi/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is AutaKimi free and open-source?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, AutaKimi is 100% free and open-source under GPL-3.0, containing zero tracking, advertisements, telemetry, or data collection.",
          },
        },
        {
          "@type": "Question",
          name: "Is AutaKimi an alternative to Tachiyomi, Mihon, and Aniyomi for PC?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AutaKimi is designed as a native desktop and mobile media client, providing a fast, ad-free PC alternative to Android-only readers like Tachiyomi, Mihon, and Aniyomi without needing an Android emulator.",
          },
        },
        {
          "@type": "Question",
          name: "Which platforms does AutaKimi support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutaKimi runs natively on Windows 10/11 (64-bit) as a desktop application and on Android (5.0+) as a standalone APK, sharing full feature parity, reading modes, and extension support.",
          },
        },
        {
          "@type": "Question",
          name: "How does sync work between PC and Android?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutaKimi uses local Wi-Fi LAN sync and portable .json.gz backups. Your desktop app acts as a local sync host that your phone discovers automatically on the same Wi-Fi, syncing reading progress and library changes with zero cloud intermediaries.",
          },
        },
        {
          "@type": "Question",
          name: "Can I track my anime and manga with AniList?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AutaKimi integrates natively with AniList for real-time progress updates, automatic completion marking upon finishing the final chapter or episode, and offline SQLite retry queuing.",
          },
        },
        {
          "@type": "Question",
          name: "Does AutaKimi support offline reading and downloads?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes! You can bulk download manga chapters directly as standard .cbz comic archives, cache anime episodes for offline playback, and read local CBZ/ZIP files directly from your storage.",
          },
        },
      ],
    },
  ],
};

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} dark scroll-smooth`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col relative bg-[#09090b] selection:bg-rose-500/30 selection:text-white text-zinc-100">
        {/* Clean Studio Backdrop */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#09090b]">
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[960px] h-[420px] rounded-full opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(225, 29, 72, 0.14) 0%, rgba(225, 29, 72, 0.03) 45%, transparent 70%)",
            }}
          />
          <div className="absolute inset-0 tech-grid [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,#000_55%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[url('/AutaKimi/assets/branding/noise.svg')] opacity-[0.025] mix-blend-overlay" />
        </div>

        <Navbar />
        <main className="flex-1 w-full flex flex-col items-center pt-20 relative z-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
