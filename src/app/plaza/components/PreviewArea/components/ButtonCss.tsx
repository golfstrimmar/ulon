"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { saveGlobalScss } from "@/lib/htmlStorage";
import dynamic from "next/dynamic";
const ModalCss = dynamic(
  () => import("@/app/plaza/components/PreviewArea/components/ModalCss"),
  {
    ssr: false,
  },
);
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonCss() {
  const { cssCount } = usePreviewArea();
  const [openModalCss, setopenModalCss] = useState<boolean>(false);
  const clearScss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await saveGlobalScss("");
      // Оповещаем все компоненты
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: "" }),
      );
    } catch (err) {
      console.error("[ModalCss] Failed to save SCSS to IndexedDB:", err);
    }
  };
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
          className={`font-bold center rounded-full w-6 text-[10px]
          ${
            cssCount > 0
              ? "bg-emerald-600 text-white"
              : "bg-zinc-700 text-zinc-400"
          }

        `}
        >
          {cssCount}
        </span>
        {cssCount > 0 && (
          <i
            onClick={(e) => clearScss(e)}
            className=" text-red-500 hover:text-white h-4 rounded-lg bg-zinc-500 hover:bg-red-600  border border-zinc-700  text-[12px]  flex flex-col justify-center transition-all cursor-pointer px-1.5  text-center duration-200"
          >
            CLEAR
          </i>
        )}
      </button>
      <ModalCss openModalCss={openModalCss} setopenModalCss={setopenModalCss} />
    </>
  );
}
