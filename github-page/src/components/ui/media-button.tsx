"use client";

import React from "react";
import { motion } from "motion/react";

type MediaButtonProps = {
  label: string;
  mediaUrl: string;
  href?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export const MediaButton = ({
  label,
  mediaUrl,
  href,
  icon,
  variant = "primary",
  className = "",
}: MediaButtonProps) => {
  const isVideo = /\.(mp4|webm)$/i.test(mediaUrl);
  const Component = href ? motion.a : motion.button;
  const props = href
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : {};

  const baseStyles =
    variant === "primary"
      ? "bg-white text-zinc-950 border-white hover:text-white"
      : "bg-zinc-900/80 text-zinc-100 border-white/[0.12] hover:border-white/25";

  return (
    <Component
      {...(props as any)}
      className={`relative inline-flex h-11 items-center justify-center gap-2.5 overflow-hidden rounded-xl px-5 font-semibold text-sm border group transition-colors outline-none whitespace-nowrap ${baseStyles} ${className}`}
      whileHover="hover"
      initial="rest"
      animate="rest"
    >
      {isVideo ? (
        <motion.video
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          src={mediaUrl}
          muted
          loop
          playsInline
          autoPlay
        />
      ) : (
        <motion.img
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          src={mediaUrl}
          alt="Preview"
        />
      )}

      <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-20 flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
    </Component>
  );
};
