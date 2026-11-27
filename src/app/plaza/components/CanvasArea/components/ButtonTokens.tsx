"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { getGlobalScss } from "@/store/htmlStorage";
import {
  extractRootBlock,
  parseTokensFromRootText,
} from "@/app/plaza/components/CanvasArea/components/ModalTokens/tokensModel";

const ModalTokens = dynamic(
  () =>
    import(
      "@/app/plaza/components/CanvasArea/components/ModalTokens/ModalTokens"
    ),
  { ssr: false },
);

export default function ButtonTokens() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [tokensCount, setTokensCount] = useState<number>(0);

  const updateCount = useCallback(async () => {
    try {
      const scss = (await getGlobalScss().catch(() => "")) || "";
      const rootInfo = extractRootBlock(scss);
      if (rootInfo) {
        const tokens = parseTokensFromRootText(rootInfo.rootText);
        setTokensCount(tokens.length);
      } else {
        setTokensCount(0);
      }
    } catch {
      setTokensCount(0);
    }
  }, []);

  useEffect(() => {
    updateCount();

    const handleStylesUpdated = () => {
      updateCount();
    };

    window.addEventListener("plaza-styles-updated", handleStylesUpdated);
    window.addEventListener("figma_colors:saved", handleStylesUpdated);

    return () => {
      window.removeEventListener("plaza-styles-updated", handleStylesUpdated);
      window.removeEventListener("figma_colors:saved", handleStylesUpdated);
    };
  }, [updateCount]);

  return (
    <>
      <button
        type="button"
        title="Manage CSS theme variables & root tokens (Sliders & Monaco)"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer border ${
          tokensCount > 0
            ? "bg-indigo-950/60 text-indigo-300 border-indigo-700/60 hover:bg-indigo-900/60 hover:text-white"
            : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border-zinc-700/50"
        }`}
      >
        <span className="text-[11px]">🎛️</span>
        <span>Tokens</span>
        {tokensCount > 0 && (
          <span className="px-1 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
            {tokensCount}
          </span>
        )}
      </button>

      <ModalTokens isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
}
