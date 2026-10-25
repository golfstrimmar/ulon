"use client";
import React, { useState } from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { saveGlobalJs } from "@/lib/htmlStorage";
import dynamic from "next/dynamic";
const ModalJS = dynamic(
  () => import("@/app/plaza/components/PreviewArea/components/ModalJS"),
  {
    ssr: false,
  },
);
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonJS() {
  const { scriptsCount } = usePreviewArea();
  const [openModalJs, setOpenModalJs] = useState<boolean>(false);
  const clearJs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await saveGlobalJs("");
      // Оповещаем все компоненты
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: "" }),
      );
    } catch (err) {
      console.error("[ModalCss] Failed to save SCSS to IndexedDB:", err);
    }
  };
  //  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
  return (
    <>
      <button
        title="Compiled class styles embedded in the <head> iframe"
        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition duration-200 cursor-pointer flex items-center gap-1.5
        ${
          scriptsCount > 0
            ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
            : "bg-zinc-800 border-zinc-700 text-zinc-500"
        }
        `}
        onClick={() => setOpenModalJs(!openModalJs)}
      >
        <span>⚡</span>
        <span className="hidden sm:inline">JS:</span>
        <span
          className={`font-bold center rounded-full w-6 text-[10px]
          ${
            scriptsCount > 0
              ? "bg-amber-600 text-white"
              : "bg-zinc-700 text-zinc-400"
          }

        `}
        >
          {scriptsCount}
        </span>
        {scriptsCount > 0 && (
          <i
            onClick={(e) => clearJs(e)}
            className=" text-red-500 hover:text-white h-4 rounded-lg bg-zinc-500 hover:bg-red-600  border border-zinc-700  text-[12px]  flex flex-col justify-center transition-all cursor-pointer px-1.5  text-center duration-200"
          >
            CLEAR
          </i>
        )}
      </button>
      <ModalJS openModalJs={openModalJs} setOpenModalJs={setOpenModalJs} />
    </>
  );
}
