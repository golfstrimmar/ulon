"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { motion, AnimatePresence } from "framer-motion";
import ButtonCss from "@/app/plaza/components/PreviewArea/components/ButtonCss";
import ButtonJS from "@/app/plaza/components/PreviewArea/components/ButtonJS";
import ButtonFonts from "@/app/plaza/components/PreviewArea/components/ButtonFonts";
import dynamic from "next/dynamic";
const ModalFonts = dynamic(
  () => import("@/app/plaza/components/PreviewArea/components/ModalFonts"),
  {
    ssr: false,
  },
);
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export function PreviewArea() {
  const {
    iframeRef,
    srcDoc,
    isEmpty,
    isCollapsed,
    setIsCollapsed,
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
  const [iframeHeight, setIframeHeight] = useState(140);

  // useEffect(() => {
  //   if (!srcDoc) return;
  //   alert(srcDoc);
  // }, [srcDoc]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const win = iframe?.contentWindow;
    const doc = iframe?.contentDocument;
    if (!win || !doc) return;

    const update = () => {
      const h = doc.body?.scrollHeight ?? 0;
      if (h > 0) setIframeHeight(h);
    };

    update();

    const observer = new ResizeObserver(update);
    if (doc.body) observer.observe(doc.body);

    // страховка: контент может догрузиться (шрифты, картинки)
    const t1 = setTimeout(update, 100);
    const t2 = setTimeout(update, 500);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [iframeRef]);
  return (
    <div className="w-full flex flex-col border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 shadow-xl">
      {/* Верхний тулбар */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-2 text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
            Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ButtonCss />
          <ButtonJS />
          <ButtonFonts />

          {/* Кнопка сворачивания */}
          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? "Развернуть" : "Свернуть"}
            className="text-zinc-500 hover:text-zinc-200 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer"
          >
            <img
              src="/chevron-down.svg"
              alt=""
              className={`w-5 h-5 transition-transform duration-200 ease-out ${
                isCollapsed ? "rotate-0" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>
      <ModalFonts />
      {/* Экран Iframe */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 0 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="relative w-full bg-white  min-h-[140px]"
          >
            {isEmpty ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2 bg-white">
                <span className="text-2xl">🖼️</span>
                <p className="text-sm font-medium text-zinc-400">
                  There are no elements to display
                </p>
                <p className="text-xs text-zinc-500">
                  Add the blocks to the canvas — they will appear here
                </p>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                srcDoc={srcDoc}
                title="iframe Prev"
                sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
                className="w-full  border-0 bg-white"
                onLoad={handleLoad}
                style={{ height: iframeHeight }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
