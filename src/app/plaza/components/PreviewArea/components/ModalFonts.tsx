"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { motion, AnimatePresence } from "framer-motion";
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
export default function ModalFonts() {
  const {
    newFontInput,
    setNewFontInput,
    fontEntries,
    defaultFont,
    detectedFamilies,
    handleAddFont,
    handleRemoveFont,
    handleSetDefaultFont,
  } = usePreviewArea();
  const [isFontsPanelOpen, setIsFontsPanelOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleFontsPanel = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setIsFontsPanelOpen(customEvent.detail);
    };

    window.addEventListener("preview-fontspanel", handleFontsPanel);
    return () => {
      window.removeEventListener("preview-fontspanel", handleFontsPanel);
    };
  }, []);
  return (
    <AnimatePresence>
      {isFontsPanelOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0, y: 0 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className=" px-4 py-3 bg-zinc-950/95 border-b border-zinc-800/80 flex flex-col gap-2.5 z-50"
        >
          <form
            onSubmit={handleAddFont}
            className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2"
          >
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Insert the tag &lt;link rel="stylesheet" ...&gt; or the font
                URL:
              </label>
              <textarea
                value={newFontInput}
                onChange={(e) => setNewFontInput(e.target.value)}
                rows={2}
                placeholder={`<link href="https://fonts.googleapis.com/css2?family=Lobster&display=swap" rel="stylesheet">`}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded bg-zinc-900 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-zinc-100 placeholder-zinc-600 transition resize-none custom-scrollbar"
              />
            </div>
            <button
              type="submit"
              disabled={!newFontInput.trim()}
              className="px-4 py-2 self-end sm:self-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition cursor-pointer shrink-0 shadow"
            >
              + Add to &lt;head&gt;
            </button>
          </form>

          {/* Список распознанных семейств шрифтов */}
          {detectedFamilies.length > 0 && (
            <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 font-semibold uppercase tracking-wider">
                Active fonts:
              </span>
              {detectedFamilies.map((fam) => {
                const isDef = defaultFont === fam;
                const slug = fam.toLowerCase().replace(/\s+/g, "-");
                return (
                  <div
                    key={fam}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200"
                  >
                    <span className="font-semibold text-indigo-300">{fam}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      (class:{" "}
                      <code className="text-emerald-400">font-{slug}</code>)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetDefaultFont(fam)}
                      className={`ml-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition ${
                        isDef
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                      }`}
                      title={
                        isDef
                          ? "Активен как шрифт всего сайта"
                          : "Сделать шрифтом всего сайта"
                      }
                    >
                      {isDef ? "✓ По умолчанию" : "Сделать по умолчанию"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Список подключенных тегов */}
          {fontEntries.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Code in &lt;head&gt;:
              </span>
              {fontEntries.map((font, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-750 text-zinc-300 text-[11px] font-mono max-w-full"
                >
                  <span className="truncate max-w-[450px]" title={font}>
                    {font.replace(/\n\s*/g, " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFont(font)}
                    className="text-zinc-500 hover:text-red-400 font-bold transition cursor-pointer text-xs leading-none"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-zinc-600 font-mono">
              Paste the Google Fonts code, and the font will instantly connect
              to preview.
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
