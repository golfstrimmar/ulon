"use client";

import React, { useState } from "react";
import ModalAiSiteBuilder from "@/app/plaza/components/CanvasArea/components/ModalAiSiteBuilder";

export default function ButtonAiSiteBuilder() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ModalAiSiteBuilder isOpen={isOpen} setIsOpen={setIsOpen} />
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="AI Сборщик сайта: введите промпт и соберите готовый интерактивный сайт из модулей"
        className="w-full px-2 py-1.5 rounded text-[11px] font-mono font-bold border transition cursor-pointer flex items-center justify-between gap-1.5 bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border-indigo-500/60 hover:border-indigo-400 text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.25)] hover:shadow-[0_0_16px_rgba(99,102,241,0.4)]"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-amber-300">🪄</span>
          <span>AI Site Builder</span>
        </span>
        <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 uppercase">
          Auto
        </span>
      </button>
    </>
  );
}
