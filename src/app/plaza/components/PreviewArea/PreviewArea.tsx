"use client";

import React from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { motion, AnimatePresence } from "framer-motion";
export function PreviewArea() {
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
          {/* Индикатор стилей CSS */}
          <div
            title="Compiled class styles embedded in the <head> iframe"
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1.5 ${
              cssCount > 0
                ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            <span>🎨</span>
            <span className="hidden sm:inline">CSS:</span>
            <span
              className={`font-bold rounded-full px-1 text-[9px] ${
                cssCount > 0
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {cssCount}
            </span>
          </div>

          {/* Индикатор скриптов JS */}
          <div
            title="Итоговый бандл JS-скриптов, подключенный в конец <body> iframe"
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1.5 ${
              scriptsCount > 0
                ? "bg-amber-950/70 border-amber-500/60 text-amber-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            <span>⚡</span>
            <span className="hidden sm:inline">JS:</span>
            <span
              className={`font-bold rounded-full px-1 text-[9px] ${
                scriptsCount > 0
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {scriptsCount}
            </span>
          </div>

          {/* Кнопка открытия панели шрифтов */}
          <button
            type="button"
            onClick={() => setIsFontsPanelOpen((prev) => !prev)}
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

      {/* Выдвижная панель шрифтов */}
      {isFontsPanelOpen && (
        <div className="px-4 py-3 bg-zinc-950/95 border-b border-zinc-800/80 flex flex-col gap-2.5">
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
        </div>
      )}

      {/* Экран Iframe */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 0 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 0 }}
            transition={{ duration: 0.1, ease: "easeInOut" }}
            className="relative w-full bg-white min-h-[140px]"
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
                className="w-full h-full border-0 bg-white"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
