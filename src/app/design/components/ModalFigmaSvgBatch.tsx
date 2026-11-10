"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ButtonClose from "@/components/ButtonClose";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  domToSvgHtmlNode,
  svgStringToBase64,
  type FigmaSvgItem,
} from "../models/figmaSvgNode.model";

interface ProcessedSvgItem {
  id: string;
  name: string;
  rawClean: string;
  baseNode: HtmlNode;
  selected: boolean;
}

interface ModalFigmaSvgBatchProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  rawSvgs: FigmaSvgItem[];
  onSaveNodes: (nodes: HtmlNode[]) => Promise<void> | void;
}

const PRESET_HEIGHTS = [16, 18, 20, 22, 24, 28, 32, 40, 48];

export default function ModalFigmaSvgBatch({
  isOpen,
  setIsOpen,
  rawSvgs,
  onSaveNodes,
}: ModalFigmaSvgBatchProps) {
  const [svgItems, setSvgItems] = useState<ProcessedSvgItem[]>([]);

  // Ð ÐµÐ¶Ð¸Ð¼ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ñ
  const [outputMode, setOutputMode] = useState<
    "inline-wrapper" | "image-datauri"
  >("inline-wrapper");
  const [targetHeight, setTargetHeight] = useState<number>(24);
  const [targetWidth, setTargetWidth] = useState<number>(24);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [wrapperClass, setWrapperClass] = useState<string>("svg-wrapper");

  // Ð¦Ð²ÐµÑ‚Ð¾Ð²Ð¾Ð¹ Ñ€ÐµÐ¶Ð¸Ð¼
  const [colorMode, setColorMode] = useState<
    "original" | "currentcolor" | "custom"
  >("original");
  const [customColor, setCustomColor] = useState<string>("#2563eb");
  const [isSaving, setIsSaving] = useState(false);

  // ÐŸÐ°Ñ€ÑÐ¸Ð½Ð³ Ð¾Ð´Ð½Ð¾Ð³Ð¾ SVG Ð¸Ð· Figma
  const parseFigmaSvg = useCallback(
    (raw: string, name: string): ProcessedSvgItem | null => {
      try {
        const parser = new DOMParser();
        let doc = parser.parseFromString(raw.trim(), "image/svg+xml");
        let svgEl = doc.querySelector("svg");

        if (!svgEl || doc.querySelector("parsererror")) {
          doc = parser.parseFromString(raw.trim(), "text/html");
          svgEl = doc.querySelector("svg");
        }

        if (!svgEl) return null;

        if (!svgEl.getAttribute("xmlns")) {
          svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        }

        const viewBoxStr =
          svgEl.getAttribute("viewBox") || svgEl.getAttribute("viewbox") || "";
        if (!viewBoxStr) {
          const wAttr = parseFloat(svgEl.getAttribute("width") || "");
          const hAttr = parseFloat(svgEl.getAttribute("height") || "");
          if (!isNaN(wAttr) && !isNaN(hAttr) && wAttr > 0 && hAttr > 0) {
            svgEl.setAttribute("viewBox", `0 0 ${wAttr} ${hAttr}`);
          }
        }

        const parsedNode = domToSvgHtmlNode(svgEl);
        const serializer = new XMLSerializer();
        const cleanSerialized = serializer.serializeToString(svgEl);

        return {
          id: `figma_svg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: name || "icon.svg",
          rawClean: cleanSerialized,
          baseNode: parsedNode,
          selected: true,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  // Ð˜Ð½Ð¸Ñ†Ð¸Ð°Ð»Ð¸Ð·Ð°Ñ†Ð¸Ñ Ð¿Ñ€Ð¸ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚Ð¸Ð¸ Ð¼Ð¾Ð´Ð°Ð»ÐºÐ¸
  useEffect(() => {
    if (!isOpen || rawSvgs.length === 0) return;

    const parsedList: ProcessedSvgItem[] = rawSvgs
      .map((item) => parseFigmaSvg(item.content, item.name))
      .filter(Boolean) as ProcessedSvgItem[];

    setSvgItems(parsedList);
  }, [isOpen, rawSvgs, parseFigmaSvg]);

  const handleHeightChange = (newH: number) => {
    const h = Math.max(8, newH);
    setTargetHeight(h);
    if (lockAspectRatio) setTargetWidth(h);
  };

  const handleWidthChange = (newW: number) => {
    const w = Math.max(8, newW);
    setTargetWidth(w);
    if (lockAspectRatio) setTargetHeight(w);
  };

  const toggleItemSelect = (id: string) => {
    setSvgItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  };

  const selectAll = (val: boolean) => {
    setSvgItems((prev) => prev.map((it) => ({ ...it, selected: val })));
  };

  // ÐŸÐ¾ÑÑ‚Ñ€Ð¾ÐµÐ½Ð¸Ðµ Ð³Ð¾Ñ‚Ð¾Ð²Ñ‹Ñ… HtmlNode Ñ ÑƒÑ‡ÐµÑ‚Ð¾Ð¼ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ñ… ÑÑ‚Ð¸Ð»ÐµÐ¹ Ð¸ Ñ†Ð²ÐµÑ‚Ð¾Ð²
  const buildFinalNodes = (): HtmlNode[] => {
    const selected = svgItems.filter((i) => i.selected);

    return selected.map((item): HtmlNode => {
      const key = `svg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 1. Ð ÐµÐ¶Ð¸Ð¼ <img src="data:image/svg+xml;base64,...">
      if (outputMode === "image-datauri") {
        const dataUri = svgStringToBase64(item.rawClean);
        return {
          tag: "img",
          text: "",
          class: "svg-img",
          style: `width: ${targetWidth}px; height: ${targetHeight}px; display: inline-block; vertical-align: middle;`,
          attributes: {
            src: dataUri,
            alt: item.name.replace(/\.svg$/i, ""),
          },
          children: [],
          _key: key,
        };
      }

      // 2. Ð ÐµÐ¶Ð¸Ð¼ Inline <i class="..."><svg></i>
      const clonedNode: HtmlNode = JSON.parse(JSON.stringify(item.baseNode));
      clonedNode.attributes = clonedNode.attributes || {};
      clonedNode.attributes["width"] = "100%";
      clonedNode.attributes["height"] = "100%";
      clonedNode.style = "width: 100%; height: 100%; display: block;";

      if (colorMode === "currentcolor") {
        if (
          clonedNode.attributes["stroke"] &&
          clonedNode.attributes["stroke"] !== "none"
        ) {
          clonedNode.attributes["stroke"] = "currentColor";
        }
        if (
          clonedNode.attributes["fill"] &&
          clonedNode.attributes["fill"] !== "none"
        ) {
          clonedNode.attributes["fill"] = "currentColor";
        }
      } else if (colorMode === "custom") {
        if (
          clonedNode.attributes["stroke"] &&
          clonedNode.attributes["stroke"] !== "none"
        ) {
          clonedNode.attributes["stroke"] = customColor;
        }
        if (
          clonedNode.attributes["fill"] &&
          clonedNode.attributes["fill"] !== "none"
        ) {
          clonedNode.attributes["fill"] = customColor;
        }
      }

      return {
        tag: "i",
        text: "",
        class: wrapperClass.trim() || "svg-wrapper",
        style: `display: inline-block; line-height: 0; vertical-align: middle; width: ${targetWidth}px; height: ${targetHeight}px;`,
        attributes: {},
        children: [clonedNode],
        _key: key,
      };
    });
  };

  const handleSave = async () => {
    const nodes = buildFinalNodes();
    if (nodes.length === 0) return;

    setIsSaving(true);
    try {
      await onSaveNodes(nodes);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to append SVG nodes:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = svgItems.filter((i) => i.selected).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 w-screen h-screen bg-black/98 z-50 overflow-y-auto custom-scrollbar flex flex-col items-center justify-between p-6 sm:p-8"
        >
          {/* Header */}
          <div className="w-full max-w-5xl flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-neutral-100 tracking-wide flex items-center gap-2">
                <span>Figma Extracted SVGs</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50 text-xs font-mono">
                  {svgItems.length} found
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Bulk configure sizes, colors, and insert vector icons into
                canvas
              </p>
            </div>
            <ButtonClose setClose={setIsOpen} />
          </div>

          {/* Main Area */}
          <div className="w-full max-w-5xl my-auto flex flex-col gap-4 py-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 px-4">
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-zinc-400">
                  Total: <b className="text-white">{svgItems.length}</b> icons
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-amber-400">
                  Selected: <b>{selectedCount}</b>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectAll(true)}
                  className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => selectAll(false)}
                  className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="w-full max-h-[300px] overflow-y-auto custom-scrollbar p-3 bg-zinc-950 border border-zinc-800/80 rounded-2xl grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {svgItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    setSvgItems((prev) =>
                      prev.map((it) =>
                        it.id === item.id
                          ? { ...it, selected: !it.selected }
                          : it,
                      ),
                    )
                  }
                  className={`relative group p-3 rounded-xl border flex flex-col items-center justify-between gap-2 transition cursor-pointer ${
                    item.selected
                      ? "bg-zinc-900 border-amber-500/80 shadow-md ring-1 ring-amber-500/30"
                      : "bg-zinc-950/60 border-zinc-800 opacity-60 hover:opacity-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => {}}
                    className="absolute top-2 left-2 rounded border-zinc-700 bg-zinc-800 text-amber-600 accent-amber-500 cursor-pointer pointer-events-none"
                  />

                  <div className="w-14 h-14 flex items-center justify-center p-1.5 bg-zinc-900/80 rounded-lg my-1">
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        color:
                          colorMode === "custom"
                            ? customColor
                            : colorMode === "currentcolor"
                              ? "#ffffff"
                              : undefined,
                      }}
                      dangerouslySetInnerHTML={{ __html: item.rawClean }}
                    />
                  </div>

                  <span
                    title={item.name}
                    className="text-[10px] text-zinc-400 font-mono text-center truncate max-w-full"
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Global Settings for Batch */}
            <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
              {/* Output Mode */}
              <div className="flex flex-col gap-2 pb-3 border-b border-zinc-800">
                <span className="text-xs font-bold text-zinc-400 tracking-wider">
                  Output Format (Mode):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutputMode("inline-wrapper")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                      outputMode === "inline-wrapper"
                        ? "bg-amber-600/15 border-amber-500 text-white"
                        : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span className="text-xs font-semibold text-zinc-200">
                      ðŸ§© Inline SVG (&lt;i&gt; + &lt;svg&gt;)
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Full node tree on canvas. Classes, hover states, and
                      direct styling.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutputMode("image-datauri")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                      outputMode === "image-datauri"
                        ? "bg-amber-600/15 border-amber-500 text-white"
                        : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span className="text-xs font-semibold text-zinc-200">
                      ðŸ–¼ï¸ Vector &lt;img&gt; (Data-URI)
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Compact single node with encoded vector SVG content.
                    </span>
                  </button>
                </div>
              </div>

              {/* Dimensions */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Target Dimensions:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLockAspectRatio(!lockAspectRatio)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition cursor-pointer ${
                        lockAspectRatio
                          ? "bg-amber-600/20 border-amber-500 text-amber-300 font-semibold"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {lockAspectRatio ? "ðŸ”’ Square (1:1)" : "ðŸ”“ Free"}
                    </button>
                    <span className="font-mono text-amber-400 font-semibold">
                      {targetWidth} Ã— {targetHeight} px
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                      <span>Height:</span>
                      <span>{targetHeight}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="120"
                      value={targetHeight}
                      onChange={(e) =>
                        handleHeightChange(parseInt(e.target.value, 10))
                      }
                      className="h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                      <span>Width:</span>
                      <span>{targetWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="120"
                      value={targetWidth}
                      onChange={(e) =>
                        handleWidthChange(parseInt(e.target.value, 10))
                      }
                      className="h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-zinc-500 mr-1">
                    Presets:
                  </span>
                  {PRESET_HEIGHTS.map((h) => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => handleHeightChange(h)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                        targetHeight === h
                          ? "bg-amber-600 text-white font-bold"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {h}px
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Mode */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
                <span className="text-xs text-zinc-300 font-medium">
                  Color Mode:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setColorMode("original")}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition cursor-pointer ${
                      colorMode === "original"
                        ? "bg-emerald-600/15 border-emerald-500 text-emerald-300 font-semibold"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    ðŸŽ¨ Original (1:1)
                  </button>

                  <button
                    type="button"
                    onClick={() => setColorMode("currentcolor")}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition cursor-pointer ${
                      colorMode === "currentcolor"
                        ? "bg-amber-600/15 border-amber-500 text-amber-300 font-semibold"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    ðŸ”¤ currentColor
                  </button>

                  <button
                    type="button"
                    onClick={() => setColorMode("custom")}
                    className={`px-3 py-2 rounded-lg border text-left text-xs transition cursor-pointer ${
                      colorMode === "custom"
                        ? "bg-purple-600/15 border-purple-500 text-purple-300 font-semibold"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    ðŸŽ¯ Custom Color
                  </button>
                </div>

                {colorMode === "custom" && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-8 h-8 rounded border border-zinc-700 bg-zinc-800 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-32 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono text-zinc-200"
                    />
                  </div>
                )}
              </div>

              {outputMode === "inline-wrapper" && (
                <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800">
                  <label className="text-xs text-zinc-400">
                    Wrapper &lt;i&gt; Class Name:
                  </label>
                  <input
                    type="text"
                    value={wrapperClass}
                    onChange={(e) => setWrapperClass(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 font-mono outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="w-full max-w-5xl flex items-center justify-between pt-4 border-t border-zinc-800">
            <span className="text-xs text-zinc-500 font-mono">
              {selectedCount > 0
                ? `Ready to insert: ${selectedCount} SVG node(s)`
                : "No icons selected"}
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedCount === 0 || isSaving}
                onClick={handleSave}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-lg cursor-pointer ${
                  selectedCount > 0 && !isSaving
                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 active:scale-95"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                }`}
              >
                {isSaving
                  ? "Saving to Tree..."
                  : `Save ${selectedCount > 0 ? `(${selectedCount})` : ""} to Canvas`}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
