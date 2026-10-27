"use client";

import React from "react";
import { usePixelPerfect } from "@/app/plaza/components/PreviewArea/hooks/usePixelPerfect";

export default function ButtonPixelPerfect() {
  const {
    hasImage,
    isOverlayActive,
    previewOpacity,
    isModalOpen,
    setIsModalOpen,
  } = usePixelPerfect();

  return (
    <button
      type="button"
      onClick={() => setIsModalOpen(!isModalOpen)}
      title="Pixel Perfect: подложка макета под превью и регулировка прозрачности"
      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition duration-200 cursor-pointer flex items-center gap-1.5 ${
        hasImage
          ? isOverlayActive
            ? "bg-amber-950/70 border-amber-500/70 text-amber-300"
            : "bg-zinc-800 border-zinc-700 text-amber-500/70"
          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700"
      }`}
    >
      <span>🎯</span>
      <span className="hidden sm:inline">Pixel Perfect</span>
    </button>
  );
}
