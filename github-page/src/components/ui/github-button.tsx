"use client";

import React, { useState } from "react";
import { Github } from "lucide-react";
import { Liquid, Colors } from "@/components/ui/button-1";

const STUDIO_COLORS: Colors = {
  color1: "#FFFFFF",
  color2: "#18181B",
  color3: "#FB7185",
  color4: "#FAFAFA",
  color5: "#F4F4F5",
  color6: "#E4E4E7",
  color7: "#9F1239",
  color8: "#E11D48",
  color9: "#BE123C",
  color10: "#F43F5E",
  color11: "#881337",
  color12: "#D4D4D8",
  color13: "#4C0519",
  color14: "#FECDD3",
  color15: "#E4E4E7",
  color16: "#27272A",
  color17: "#3F3F46",
};

const GitHubButton = ({ className = "" }: { className?: string }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href="https://github.com/anasx07/AutaKimi"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub Repository"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative inline-flex items-center justify-center h-8 px-3.5 rounded-lg border border-white/[0.14] hover:border-white/30 bg-zinc-950 overflow-hidden transition-all duration-200 group ${className}`}
    >
      <div className="absolute inset-0 opacity-85 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <span className="absolute inset-0 bg-zinc-950" />
        <Liquid isHovered={isHovered} colors={STUDIO_COLORS} />
        <span className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors" />
      </div>

      <span className="relative z-10 inline-flex items-center gap-1.5 text-white text-xs font-semibold tracking-tight whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        <Github className="w-3.5 h-3.5 shrink-0" />
        <span>GitHub</span>
      </span>
    </a>
  );
};

export default GitHubButton;
