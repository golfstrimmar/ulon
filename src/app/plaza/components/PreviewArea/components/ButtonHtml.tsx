"use client";
import React, { useState } from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import dynamic from "next/dynamic";

const ModalHtml = dynamic(
  () => import("@/app/plaza/components/PreviewArea/components/ModalHtml"),
  { ssr: false },
);

//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ButtonHtml() {
  const { srcDoc, isEmpty } = usePreviewArea();
  const [openModalHtml, setOpenModalHtml] = useState<boolean>(false);

  const htmlCount = !isEmpty ? 1 : 0;

  return (
    <>
      <button
        title="Full generated HTML document (as rendered in the iframe)"
        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition duration-200 cursor-pointer flex items-center gap-1.5
        ${
          htmlCount > 0
            ? "bg-orange-950/70 border-orange-500/60 text-orange-300"
            : "bg-zinc-800 border-zinc-700 text-zinc-500"
        }
        `}
        onClick={() => setOpenModalHtml(!openModalHtml)}
      >
        <span>🌐</span>
        <span className="hidden sm:inline">HTML:</span>
        <span
          className={`font-bold center rounded-full w-6 text-[10px]
          ${
            htmlCount > 0
              ? "bg-orange-600 text-white"
              : "bg-zinc-700 text-zinc-400"
          }
        `}
        >
          {htmlCount}
        </span>
      </button>
      <ModalHtml
        openModalHtml={openModalHtml}
        setOpenModalHtml={setOpenModalHtml}
        srcDoc={srcDoc}
      />
    </>
  );
}
