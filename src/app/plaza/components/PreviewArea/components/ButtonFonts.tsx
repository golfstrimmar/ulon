"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonFonts() {
  const { isFontsPanelOpen, openModalFonts, fontEntries } = usePreviewArea();

  return (
    <div className="">
      <button
        type="button"
        onClick={() => openModalFonts()}
        title="Настройка подключаемых веб-шрифтов"
        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1 ${
          isFontsPanelOpen || fontEntries.length > 0
            ? "bg-indigo-950/80 border-indigo-500/80 text-indigo-300"
            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700"
        }`}
      >
        <span>🔤</span>
        <span>Fonts</span>
        {fontEntries.length > 0 && (
          <span className="px-1 bg-indigo-600 text-white rounded-full text-[9px] font-bold">
            {fontEntries.length}
          </span>
        )}
      </button>
    </div>
  );
}
