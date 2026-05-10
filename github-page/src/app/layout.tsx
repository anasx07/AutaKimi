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
  title: "AutaKimi - The Ultimate Manga Reader",
  description: "The ultimate manga experience on Windows. Free, extensible, and built for speed.",
  keywords: ["Manga", "Reader", "Windows", "AutaKimi", "Anime", "Free", "Extensions", "Arabic localization"],
  icons: {
    icon: "/AutaKimi/favicon.png",
    shortcut: "/AutaKimi/favicon.png",
    apple: "/AutaKimi/assets/icon.png",
  },
  openGraph: {
    title: "AutaKimi - The Ultimate Manga Reader",
    description: "The ultimate manga experience on Windows. Free, extensible, and built for speed.",
    url: "https://anasx07.github.io/AutaKimi",
    siteName: "AutaKimi",
    images: [
      {
        url: "/AutaKimi/assets/icon.png",
        width: 512,
        height: 512,
        alt: "AutaKimi Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  alternates: {
    canonical: "https://anasx07.github.io/AutaKimi",
  },
  verification: {
    google: "oLob_47r8e6mHEe8beX6u_sSm-eGtaljDpJQkZ_jeuw",
  },
};

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import StarfieldShader from "@/components/backgrounds/StarfieldShader";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} dark scroll-smooth`}>
      <body className="antialiased min-h-screen flex flex-col relative bg-black selection:bg-primary/30 text-white">
        {/* Deep Space high-performance background */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
          {/* Subtle Deep Nebulae */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/15 rounded-full blur-[140px] animate-pulse" />
          <div className="absolute bottom-[0%] right-[-10%] w-[45%] h-[45%] bg-indigo-950/10 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-blue-900/5 rounded-full blur-[100px]" />
          
          {/* Static Stars (High Performance) */}
          <div className="absolute inset-0 opacity-30" 
               style={{ 
                 backgroundImage: 'radial-gradient(1px 1px at 20px 30px, white, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 50px 100px, white, rgba(0,0,0,0)), radial-gradient(1px 1px at 150px 150px, white, rgba(0,0,0,0)), radial-gradient(2px 2px at 250px 50px, white, rgba(0,0,0,0))',
                 backgroundSize: '300px 300px'
               }} 
          />
          
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
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
