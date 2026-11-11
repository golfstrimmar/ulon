"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";
import type { ModalFlexBuilderProps } from "./types/flexBuilder.types";
import {
  COLUMN_COLORS,
  QUICK_PRESETS,
  MIN_ITEMS_COUNT,
  MAX_ITEMS_COUNT,
} from "./constants/flexBuilderConstants";
import { getFlexClass } from "./models/flexBuilderModel";
import { useFlexBuilderController } from "./controllers/useFlexBuilderController";

export default function ModalFlexBuilder({
  isOpen,
  setIsOpen,
  initialDirection = "row",
  onSaveNode,
}: ModalFlexBuilderProps) {
  const {
    isCol,
    itemsCount,
    percentages,
    containerClass,
    childExtraClass,
    activeSplitterIndex,
    trackRef,
    splitterPositions,
    defaultClass,
    setContainerClass,
    setChildExtraClass,
    handleDirectionChange,
    handleCountChange,
    applyPreset,
    distributeEqually,
    startDragSplitter,
    handleSaveToTree,
  } = useFlexBuilderController({
    initialDirection,
    onSaveNode,
    onClose: () => setIsOpen(false),
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="fixed inset-0  h-screen bg-black/70 z-50 overflow-y-auto custom-scrollbar flex flex-col  justify-between   select-none"
        >
          {/* Close button */}
          <div className="absolute top-6 right-8 z-10">
            <ButtonClose setClose={setIsOpen} />
          </div>
          {/* ══ Main Interactive Area ══ */}
          <div className="w-full  mx-auto mt-auto bg-black flex flex-col  justify-end py-6 gap-6">
            {/* Control Bar: Items Count & Distribute */}
            <div className="bg-black flex flex-col sm:flex-row items-center justify-between gap-4 p-4  border border-neutral-800 rounded-2xl shadow-xl backdrop-blur">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-mono text-neutral-300 font-semibold whitespace-nowrap">
                  {isCol ? "Rows (Items):" : "Columns:"}{" "}
                  <span className="text-cyan-400 font-bold">{itemsCount}</span>
                </span>
                <div className="flex items-center gap-2 flex-1 sm:w-64">
                  <button
                    type="button"
                    onClick={() => handleCountChange(itemsCount - 1)}
                    disabled={itemsCount <= MIN_ITEMS_COUNT}
                    className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-800 text-white font-bold transition flex items-center justify-center cursor-pointer"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={MIN_ITEMS_COUNT}
                    max={MAX_ITEMS_COUNT}
                    value={itemsCount}
                    onChange={(e) => handleCountChange(Number(e.target.value))}
                    className="flex-1 accent-cyan-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleCountChange(itemsCount + 1)}
                    disabled={itemsCount >= MAX_ITEMS_COUNT}
                    className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-800 text-white font-bold transition flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              {/* Direction Switcher: Row (f-r) vs Col (f-c) */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleDirectionChange("row")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    !isCol
                      ? "bg-cyan-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <span>⇄</span> Flex Row (f-r)
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange("col")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    isCol
                      ? "bg-cyan-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <span>⇅</span> Flex Column (f-c)
                </button>
              </div>
              <button
                type="button"
                onClick={distributeEqually}
                className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer transition flex items-center gap-1.5"
              >
                <span>↺</span> Distribute Equally (100%)
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono ">
              <span className="text-neutral-500 mr-1">Quick Presets:</span>
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.percentages)}
                  className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* ══ INTERACTIVE SPLITTER TRACK ══ */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span>
                  Interactive Splitter (drag ↔ handles to adjust{" "}
                  {isCol ? "heights" : "widths"}):
                </span>
                <span className="text-neutral-500">
                  Total: {percentages.reduce((s, p) => s + p, 0).toFixed(1)}%
                </span>
              </div>

              {/* Horizontal Track for Row Mode */}
              {!isCol ? (
                <div
                  ref={trackRef}
                  className="relative w-full h-20 bg-neutral-950 border-2 border-neutral-700 rounded-xl overflow-hidden shadow-2xl flex select-none"
                >
                  {percentages.map((percent, idx) => {
                    const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
                    return (
                      <div
                        key={idx}
                        style={{ width: `${percent}%` }}
                        className={`h-full ${color.bg}   flex flex-col items-center justify-center relative transition-all duration-75`}
                      >
                        <span
                          className={`text-sm font-mono font-bold ${color.text}`}
                        >
                          {percent}%
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-semibold mt-0.5">
                          .{getFlexClass(percent)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Vertical Splitters */}
                  {splitterPositions.map(({ index, position }) => (
                    <div
                      key={index}
                      onPointerDown={(e) => startDragSplitter(index, e)}
                      style={{ left: `${position}%` }}
                      className={`absolute top-0 bottom-0 w-4 -ml-2 z-20 flex items-center justify-center cursor-col-resize group transition-transform ${
                        activeSplitterIndex === index ? "scale-110" : ""
                      }`}
                    >
                      <div
                        className={`w-1 h-full transition-colors ${
                          activeSplitterIndex === index
                            ? "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                            : "bg-neutral-500 group-hover:bg-cyan-400"
                        }`}
                      />
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform ${
                          activeSplitterIndex === index
                            ? "bg-cyan-500 border-white scale-110"
                            : "bg-neutral-900 border-neutral-500 group-hover:border-cyan-400 group-hover:scale-105"
                        }`}
                      >
                        <span className="text-[9px] text-white select-none">
                          ↔
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Vertical Track for Column Mode */
                <div
                  ref={trackRef}
                  className="relative w-full h-80 bg-neutral-950 border-2 border-neutral-700 rounded-xl overflow-hidden shadow-2xl flex flex-col select-none"
                >
                  {percentages.map((percent, idx) => {
                    const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
                    return (
                      <div
                        key={idx}
                        style={{ height: `${percent}%` }}
                        className={`w-full ${color.bg} border-b border-neutral-800/80 flex items-center justify-between px-6 relative transition-all duration-75`}
                      >
                        <span
                          className={`text-sm font-mono font-bold ${color.text}`}
                        >
                          {percent}%
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-semibold">
                          .{getFlexClass(percent)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Horizontal Splitters */}
                  {splitterPositions.map(({ index, position }) => (
                    <div
                      key={index}
                      onPointerDown={(e) => startDragSplitter(index, e)}
                      style={{ top: `${position}%` }}
                      className={`absolute left-0 right-0 h-4 -mt-2 z-20 flex items-center justify-center cursor-row-resize group transition-transform ${
                        activeSplitterIndex === index ? "scale-110" : ""
                      }`}
                    >
                      <div
                        className={`h-1 w-full transition-colors ${
                          activeSplitterIndex === index
                            ? "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                            : "bg-neutral-500 group-hover:bg-cyan-400"
                        }`}
                      />
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform ${
                          activeSplitterIndex === index
                            ? "bg-cyan-500 border-white scale-110"
                            : "bg-neutral-900 border-neutral-500 group-hover:border-cyan-400 group-hover:scale-105"
                        }`}
                      >
                        <span className="text-[9px] text-white select-none">
                          ↕
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Classes Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Parent Flex Container Classes:
                </label>
                <input
                  type="text"
                  value={containerClass}
                  onChange={(e) => setContainerClass(e.target.value)}
                  placeholder={defaultClass}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Additional Child Classes (optional):
                </label>
                <input
                  type="text"
                  value={childExtraClass}
                  onChange={(e) => setChildExtraClass(e.target.value)}
                  placeholder="custom-class"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* ══ Footer ══ */}
          <div className="w-full max-w-4xl mx-auto flex items-center justify-between pt-4 border-t border-neutral-800 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-neutral-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveToTree}
                className="btn admin-btn"
              >
                <span>➕</span> Insert Flex into Canvas
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
