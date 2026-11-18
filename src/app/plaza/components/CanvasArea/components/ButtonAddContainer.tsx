"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { HtmlNode } from "@/types/HtmlNode";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import { getGlobalScss, saveGlobalScss } from "@/lib/htmlStorage";
import { updateClassInGlobalScss } from "@/lib/scssCompiler";

const WIDTH_PRESETS = [1140, 1200, 1300, 1440, 1600, 1790];

export default function ButtonAddContainer() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [maxWidth, setMaxWidth] = useState<number>(1790);
  const [vwOffset, setVwOffset] = useState<number>(40);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cssBody = `max-width: ${maxWidth}px; margin: 0 auto; width: calc(100vw - ${vwOffset}px);`;

  const handleAddContainer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const containerNode: HtmlNode = {
        tag: "div",
        text: "",
        class: "container",
        style: cssBody,
        children: [],
      };

      const store = useCanvasStore.getState();
      await store.appendRawNodes([containerNode]);

      // Гарантированно обновляем .container в GlobalScss, даже если он уже был создан ранее
      const currentScss = (await getGlobalScss().catch(() => "")) || "";
      const fullSnippet = `.container {\n  max-width: ${maxWidth}px;\n  margin: 0 auto;\n  width: calc(100vw - ${vwOffset}px);\n}`;
      const nextScss = updateClassInGlobalScss(
        currentScss,
        "container",
        fullSnippet,
      );

      if (nextScss !== currentScss) {
        await saveGlobalScss(nextScss);
        window.dispatchEvent(
          new CustomEvent("plaza-styles-updated", { detail: nextScss }),
        );
      }

      store.showHud(`Container (${maxWidth}px) added!`, "success");
      setIsOpen(false);
    } catch (err) {
      console.error("[ButtonAddContainer] Failed to add container:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="admin-btn !justify-between"
        title="Add .container with custom max-width"
      >
        <span className="flex items-center gap-1.5 font-mono">
          <span>📦</span>
          <span>Container</span>
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          {maxWidth}px
        </span>
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            onClick={() => !isSaving && setIsOpen(false)}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
          >
            <form
              onSubmit={handleAddContainer}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl flex flex-col gap-3.5 text-zinc-100"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-sm font-bold font-mono text-white">
                  .container — ширина
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-zinc-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-zinc-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Ползунок ширины + точный ввод */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">max-width:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={320}
                      max={2560}
                      step={10}
                      value={maxWidth}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) {
                          setMaxWidth(Math.max(320, Math.min(2560, v)));
                        }
                      }}
                      className="w-20 bg-zinc-950 border border-zinc-700 focus:border-blue-500 rounded-lg px-2 py-1 text-right text-xs font-mono text-blue-400 font-bold outline-none"
                    />
                    <span className="text-zinc-500">px</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={480}
                  max={1920}
                  step={10}
                  value={Math.min(1920, Math.max(480, maxWidth))}
                  onChange={(e) => setMaxWidth(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />

                {/* Пресеты */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {WIDTH_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMaxWidth(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer ${
                        maxWidth === preset
                          ? "bg-blue-600 border-blue-400 text-white font-bold"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Отступ calc(100vw - Xpx) */}
              <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-zinc-800/80">
                <span className="text-zinc-400">calc(100vw - X):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={4}
                    value={vwOffset}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) {
                        setVwOffset(Math.max(0, Math.min(200, v)));
                      }
                    }}
                    className="w-16 bg-zinc-950 border border-zinc-700 focus:border-blue-500 rounded-lg px-2 py-0.5 text-right text-xs font-mono text-zinc-200 outline-none"
                  />
                  <span className="text-zinc-500">px</span>
                </div>
              </div>

              {/* Превью CSS */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 font-mono text-[11px] text-emerald-400 leading-relaxed">
                <div>.container {"{"}</div>
                <div className="pl-3">max-width: {maxWidth}px;</div>
                <div className="pl-3">margin: 0 auto;</div>
                <div className="pl-3">width: calc(100vw - {vwOffset}px);</div>
                <div>{"}"}</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition cursor-pointer"
                >
                  {isSaving ? "Добавление..." : "Добавить"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
