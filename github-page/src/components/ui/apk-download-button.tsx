"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smartphone,
  ChevronDown,
  ExternalLink,
  Check,
} from "lucide-react";

interface ApkOption {
  id: string;
  title: string;
  subtitle: string;
  size: string;
  tag: string;
  tagColor: string;
  icon: React.ReactNode;
  url: string;
  isRecommended?: boolean;
}

const APK_OPTIONS: ApkOption[] = [
  {
    id: "arm64",
    title: "ARM64-v8a",
    subtitle:
      "Fast & lightweight (All modern 64-bit Android phones: Samsung, Xiaomi, Pixel, Oppo)",
    size: "51 MB",
    tag: "Recommended",
    tagColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    icon: <Smartphone className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />,
    url: "https://github.com/anasx07/AutaKimi/releases/latest/download/app-arm64-v8a-release.apk",
    isRecommended: true,
  },
];

interface ApkDownloadButtonProps {
  mediaUrl?: string;
  className?: string;
}

export const ApkDownloadButton: React.FC<ApkDownloadButtonProps> = ({
  mediaUrl = "/AutaKimi/assets/videos/installer-preview.mp4",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const primaryBuild = APK_OPTIONS[0]; // ARM64 51MB default

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      {/* Split Button Main Shell */}
      <div className="relative inline-flex h-11 w-full sm:w-auto items-stretch overflow-hidden rounded-xl bg-zinc-900/90 border border-white/[0.12] group hover:border-white/25 transition-colors outline-none">
        {/* Background Video Preview on hover */}
        {mediaUrl && (
          <video
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            src={mediaUrl}
            muted
            loop
            playsInline
            autoPlay
          />
        )}

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Left Side: Primary Download (ARM64 51MB) */}
        <a
          href={primaryBuild.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Download Android APK (${primaryBuild.size} - Recommended for modern phones)`}
          className="relative z-20 flex-1 flex items-center justify-center gap-2 px-4 text-zinc-100 font-semibold text-sm hover:bg-white/[0.04] transition-colors whitespace-nowrap outline-none"
        >
          <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Android APK</span>
          <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            51 MB
          </span>
        </a>

        {/* Divider */}
        <div className="relative z-20 w-[1px] bg-white/[0.1] my-2 pointer-events-none" />

        {/* Right Side: Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Android APK download options"
          title="Android APK download options"
          className="relative z-20 flex items-center justify-center px-3 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors outline-none cursor-pointer"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-white" : ""
            }`}
          />
        </button>
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-[calc(100%+8px)] left-0 sm:left-auto right-0 sm:w-96 z-50 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl shadow-black/80"
          >
            {/* Menu Header */}
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Android Build
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5">
                64-bit ARM
              </span>
            </div>

            {/* Builds List */}
            <div className="py-1 space-y-1">
              {APK_OPTIONS.map((option) => (
                <a
                  key={option.id}
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl transition-all group/item ${
                    option.isRecommended
                      ? "bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {option.icon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white tracking-tight">
                        {option.title}
                      </span>
                      <span
                        className={`text-[10px] font-medium font-mono px-1.5 py-0.2 rounded border ${option.tagColor}`}
                      >
                        {option.tag}
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-400 ml-auto shrink-0">
                        {option.size}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                      {option.subtitle}
                    </p>
                  </div>
                  {option.isRecommended && (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 self-center opacity-80" />
                  )}
                </a>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-1.5 border-t border-white/5">
              <a
                href="https://github.com/anasx07/AutaKimi/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-orange-400/90 hover:text-orange-300 font-medium hover:bg-white/5 rounded-lg transition-colors"
              >
                <span>View all builds on GitHub Releases</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
