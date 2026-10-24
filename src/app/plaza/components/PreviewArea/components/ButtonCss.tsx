"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import ModalCss from "@/app/plaza/components/PreviewArea/components/ModalCss";

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonCss() {
  const {
    iframeRef,
    srcDoc,
    isEmpty,
    isCollapsed,
    setIsCollapsed,
    isFontsPanelOpen,
    setIsFontsPanelOpen,
    newFontInput,
    setNewFontInput,
    fontEntries,
    defaultFont,
    detectedFamilies,
    cssCount,
    scriptsCount,
    handleAddFont,
    handleRemoveFont,
    handleSetDefaultFont,
  } = usePreviewArea();
  const [openModalCss, setopenModalCss] = useState<boolean>(false);

  return (
    <>
      <button
        title="Compiled class styles embedded in the <head> iframe"
        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition duration-200 cursor-pointer flex items-center gap-1.5
        ${
          cssCount > 0
            ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
            : "bg-zinc-800 border-zinc-700 text-zinc-500"
        }
        `}
        onClick={() => setopenModalCss(!openModalCss)}
      >
        <span>🎨</span>
        <span className="hidden sm:inline">CSS:</span>
        <span
          className={`font-bold rounded-full px-1 text-[9px]
          ${
            cssCount > 0
              ? "bg-emerald-600 text-white"
              : "bg-zinc-700 text-zinc-400"
          }

        `}
        >
          {cssCount}
        </span>
      </button>
      <ModalCss openModalCss={openModalCss} setopenModalCss={setopenModalCss} />
    </>
  );
}
