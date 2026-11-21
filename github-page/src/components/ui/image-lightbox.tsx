"use client";

import { useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
} from "lucide-react";

export interface LightboxImage {
  src: string;
  alt: string;
  title?: string;
  badge?: string;
  description?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImageLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const current = images[currentIndex] || images[0];

  const handlePrev = useCallback(() => {
    onNavigate((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  const handleNext = useCallback(() => {
    onNavigate((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, onNavigate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    },
    [isOpen, onClose, handlePrev, handleNext],
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-6 bg-black/92 backdrop-blur-2xl animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Controls */}
      <div
        className="w-full max-w-6xl flex items-center justify-between gap-4 z-20 pb-3 border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {current.badge && (
            <span className="premium-pill bg-orange-500/15 border-orange-500/30 text-orange-300 text-xs px-2.5 py-0.5 shrink-0">
              {current.badge}
            </span>
          )}
          <span className="text-white font-bold text-sm sm:text-base truncate">
            {current.title || current.alt}
          </span>
          <span className="text-xs font-mono text-zinc-500 shrink-0 hidden sm:inline">
            ({currentIndex + 1} of {images.length})
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={current.src}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Open original resolution in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 text-zinc-400 hover:text-red-300 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div
        className="relative flex-1 w-full max-w-6xl flex items-center justify-center my-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation Previous */}
        {images.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 z-30 p-3 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95"
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Screenshot Image */}
        <div className="relative max-h-[78vh] max-w-full rounded-2xl overflow-hidden border border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-zinc-950">
          <img
            src={current.src}
            alt={current.alt}
            className="max-h-[78vh] w-auto h-auto object-contain select-none"
          />
        </div>

        {/* Navigation Next */}
        {images.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 sm:right-4 z-30 p-3 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95"
            aria-label="Next screenshot"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Caption & Keyboard Hints */}
      <div
        className="w-full max-w-6xl flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/10 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="truncate pr-4 text-zinc-400 text-xs">
          {current.description ||
            "High-resolution desktop interface screenshot."}
        </p>
        <div className="hidden sm:flex items-center gap-3 shrink-0 text-zinc-500 font-mono text-[11px]">
          <span>ESC to close</span>
          <span>•</span>
          <span>← / → to navigate</span>
        </div>
      </div>
    </div>
  );
}

export function ZoomBadge() {
  return (
    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none z-20">
      <span className="px-4 py-2 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-2 shadow-2xl scale-95 group-hover:scale-100 transition-transform duration-300">
        <ZoomIn className="w-4 h-4 text-orange-400" /> Click to Expand
      </span>
    </div>
  );
}
