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
        "https://anasx07.github.io/AutaKimi/assets/screenshots/anime-browse.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/manga-details.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/anime-details.png",
        "https://anasx07.github.io/AutaKimi/assets/screenshots/themes-showcase.png",
      ],
      softwareVersion: "2.0.11",
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
      <body className="antialiased min-h-screen flex flex-col relative bg-black selection:bg-primary/30 text-white">
        {/* Deep Space high-performance background */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
          {/* Subtle Deep Nebulae */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-950/15 rounded-full blur-[140px] animate-pulse" />
          <div className="absolute bottom-[0%] right-[-10%] w-[45%] h-[45%] bg-amber-950/10 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-red-950/5 rounded-full blur-[100px]" />

          {/* Static Stars (High Performance) */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(1px 1px at 20px 30px, white, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 50px 100px, white, rgba(0,0,0,0)), radial-gradient(1px 1px at 150px 150px, white, rgba(0,0,0,0)), radial-gradient(2px 2px at 250px 50px, white, rgba(0,0,0,0))",
              backgroundSize: "300px 300px",
            }}
          />

          <div className="absolute inset-0 bg-[url('/AutaKimi/assets/branding/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        </div>

        <Navbar />
        <main className="flex-1 w-full flex flex-col items-center pt-32 relative z-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
