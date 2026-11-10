"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { PencilSquareIcon } from "@heroicons/react/24/outline";

import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { usePixelPerfect } from "@/app/plaza/components/PreviewArea/hooks/usePixelPerfect";
import { useBreakpoint } from "@/app/plaza/components/PreviewArea/hooks/useBreakpoint";
import { usePreviewHeight } from "@/app/plaza/components/PreviewArea/hooks/usePreviewHeight";
import { usePreviewHighlight } from "@/app/plaza/components/PreviewArea/hooks/usePreviewHighlight";
import TracingWireframeOverlay from "./components/TracingWireframeOverlay";

import ButtonCss from "@/app/plaza/components/PreviewArea/components/ButtonCss";
import ButtonJS from "@/app/plaza/components/PreviewArea/components/ButtonJS";
import ButtonHtml from "@/app/plaza/components/PreviewArea/components/ButtonHtml";
import ButtonFonts from "@/app/plaza/components/PreviewArea/components/ButtonFonts";
import ButtonPixelPerfect from "@/app/plaza/components/PreviewArea/components/ButtonPixelPerfect";
import ButtonJson from "@/app/plaza/components/PreviewArea/components/ButtonJson";
import BreakpointControls from "@/app/plaza/components/PreviewArea/components/BreakpointControls";
import Link from "next/link";

const ModalFonts = dynamic(
  () => import("@/app/plaza/components/PreviewArea/components/ModalFonts"),
  { ssr: false },
);

const ModalPixelPerfect = dynamic(
  () =>
    import("@/app/plaza/components/PreviewArea/components/ModalPixelPerfect"),
  { ssr: false },
);

export function PreviewArea() {
  const { iframeRef, srcDoc, isEmpty, isCollapsed, setIsCollapsed } =
    usePreviewArea();

  const {
    image: overlayImage,
    hasImage,
    isOverlayActive,
    previewOpacity,
    overlayOpacity,
    offsetX,
    offsetY,
    align,
    imageHeight: overlayHeight,
    setPreviewOpacity,
    setOffsetX,
    setAlign,
    centerImage,
  } = usePixelPerfect();

  const {
    effectiveWidthStyle,
    effectiveWidth,
    isFullWidth,
    activeBreakpoint,
    isRotated,
  } = useBreakpoint();

  // Ð ÐµÐ¶Ð¸Ð¼ ÐºÐ°Ð»ÑŒÐºÐ¸ (Ð¾Ð±Ð²Ð¾Ð´ÐºÐ¸ Ð¿Ð¾Ð²ÐµÑ€Ñ… Ð¼Ð°ÐºÐµÑ‚Ð°)
  const [isTracingActive, setIsTracingActive] = useState(false);

  const { effectiveHeight, initHeightMeasurement, setNaturalImgHeight } =
    usePreviewHeight({
      iframeRef,
      isEmpty,
      overlayImage,
      hasImage,
      overlayHeight,
      offsetY,
    });

  const { initHighlighting } = usePreviewHighlight({
    iframeRef,
    srcDoc,
  });

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    initHighlighting(doc);
    initHeightMeasurement(doc);
  }, [iframeRef, initHighlighting, initHeightMeasurement]);

  const stepOffset = useCallback(
    (delta: number) => {
      if (align !== "center") setAlign("center");
      setOffsetX(offsetX + delta);
    },
    [align, offsetX, setAlign, setOffsetX],
  );

  const handleWheelOffset = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      stepOffset(delta);
    },
    [stepOffset],
  );

  return (
    <div className="w-full flex flex-col border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 shadow-xl">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800 bg-zinc-900/80 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-1 text-[11px] font-mono text-zinc-400 tracking-widest hidden sm:inline">
                Preview
              </span>
            </div>

            {/* ðŸš€ ÐšÐÐžÐŸÐšÐ ÐšÐÐ›Ð¬ÐšÐ˜ (TRACING MODE) */}
            <button
              type="button"
              onClick={() => setIsTracingActive(!isTracingActive)}
              title={
                isTracingActive
                  ? "Exit Tracing Mode"
                  : "Trace Layout: Draw wireframe boxes directly over prototype mockup"
              }
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer border ${
                isTracingActive
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                  : "bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border-zinc-700/60"
              }`}
            >
              <PencilSquareIcon className="size-3.5 text-cyan-400" />
              <span>Trace</span>
            </button>

            {hasImage && isOverlayActive && (
              <>
                {/* Opacity Slider */}
                <div
                  className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-[10px] font-mono text-zinc-400"
                  title="Preview opacity for reference comparison"
                >
                  <span className="text-zinc-400">Opacity:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={previewOpacity}
                    onChange={(e) => setPreviewOpacity(Number(e.target.value))}
                    className="w-16 h-1.5 accent-indigo-500 cursor-pointer"
                  />
                  <span className="w-7 text-right text-indigo-300 font-bold">
                    {previewOpacity}%
                  </span>
                </div>

                {/* Horizontal Alignment */}
                <div
                  className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-[10px] font-mono text-zinc-400"
                  title="Center & horizontal alignment. Use slider or buttons for 1px steps"
                >
                  <button
                    type="button"
                    onClick={centerImage}
                    title="Snap to exact center (0px)"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                      align === "center" && offsetX === 0
                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    Center
                  </button>

                  <button
                    type="button"
                    onClick={() => stepOffset(-1)}
                    title="Move 1px Left"
                    className="w-4 h-4 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center transition leading-none active:scale-95"
                  >
                    âˆ’
                  </button>

                  <span className="text-zinc-400 select-none">X:</span>

                  <input
                    type="range"
                    min="-300"
                    max="300"
                    step="1"
                    value={offsetX}
                    onWheel={handleWheelOffset}
                    onChange={(e) => {
                      if (align !== "center") setAlign("center");
                      setOffsetX(Number(e.target.value));
                    }}
                    className="w-36 md:w-48 h-1.5 accent-indigo-500 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => stepOffset(1)}
                    title="Move 1px Right"
                    className="w-4 h-4 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center transition leading-none active:scale-95"
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={() => setOffsetX(0)}
                    onWheel={handleWheelOffset}
                    title="Click to reset X offset to 0px"
                    className="w-12 text-right text-indigo-300 font-bold hover:text-white transition cursor-pointer select-none"
                  >
                    {offsetX > 0 ? `+${offsetX}` : offsetX}px
                  </button>
                </div>
              </>
            )}

            <ButtonPixelPerfect />
            <ButtonCss />
            <ButtonJS />
            <ButtonHtml />
            <ButtonFonts />
            <BreakpointControls />
            <ButtonJson />
            <Link
              href="/plaza/export"
              target="_blank"
              title="Production Build — 3 clean files (HTML, CSS, JS)"
              className="text-[10px] font-mono px-2 py-0.5 rounded border transition duration-200 cursor-pointer flex items-center gap-1.5 bg-indigo-950/70 border-indigo-500/60 text-indigo-300 hover:bg-indigo-900/70"
            >
              ?? Export
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? "Expand" : "Collapse"}
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
      <ModalPixelPerfect />

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 0 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className={`relative w-full overflow-x-auto custom-scrollbar transition-colors ${
              isFullWidth
                ? "bg-white"
                : "bg-zinc-950/90 p-2 sm:p-4 flex flex-col items-center"
            }`}
          >
            <div
              className={`relative bg-white transition-[width] duration-200 ease-out overflow-hidden ${
                isFullWidth
                  ? "w-full"
                  : "shadow-2xl rounded-lg border border-zinc-700/70 ring-1 ring-zinc-800 shrink-0 box-content"
              }`}
              style={{
                width: isFullWidth ? "100%" : effectiveWidthStyle,
                maxWidth: isFullWidth ? "100%" : effectiveWidthStyle,
              }}
            >
              {!isFullWidth && (
                <div className="relative z-20 flex items-center justify-center px-3 py-1.5 bg-zinc-900 border-b border-zinc-700/80 text-xs font-mono select-none flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{activeBreakpoint.icon}</span>
                    <span className="font-bold text-zinc-100 text-xs tracking-tight">
                      {activeBreakpoint.name}
                    </span>
                    <span className="text-zinc-300 text-[11px] font-medium">
                      ({activeBreakpoint.deviceType})
                    </span>

                    <span
                      title="CSS Media Query"
                      className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-amber-300 font-mono text-[10px] font-semibold"
                    >
                      @{activeBreakpoint.mediaQuery}
                    </span>

                    {activeBreakpoint.tailwindPrefix && (
                      <span
                        title="Tailwind breakpoint class prefix"
                        className="px-1.5 py-0.5 rounded bg-indigo-950/90 border border-indigo-700/70 text-indigo-300 font-mono text-[10px] font-bold"
                      >
                        {activeBreakpoint.tailwindPrefix}
                      </span>
                    )}

                    {isRotated && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-medium flex items-center gap-1">
                        ðŸ”„ Landscape
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-zinc-400">Viewport:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 font-bold">
                      {effectiveWidth}px
                    </span>
                  </div>
                </div>
              )}

              {/* Viewport Screen with live Tracing Overlay Layer */}
              <div
                className="relative w-full bg-white transition-[height] duration-200 ease-out overflow-hidden"
                style={{
                  height: effectiveHeight,
                  minHeight: effectiveHeight,
                }}
              >
                {/* ðŸŽ¯ Ð¡Ð›ÐžÐ™-ÐšÐÐ›Ð¬ÐšÐ Ð”Ð›Ð¯ Ð Ð˜Ð¡ÐžÐ’ÐÐÐ˜Ð¯ Ð ÐÐœÐžÐš ÐŸÐžÐ’Ð•Ð Ð¥ ÐœÐÐšÐ•Ð¢Ð */}
                <TracingWireframeOverlay
                  isActive={isTracingActive}
                  onClose={() => setIsTracingActive(false)}
                  viewportWidth={isFullWidth ? "100%" : effectiveWidthStyle}
                  viewportHeight={effectiveHeight}
                />

                {/* Pixel Perfect Reference Overlay */}
                {hasImage && isOverlayActive && (
                  <div
                    className="absolute top-0 pointer-events-none select-none z-0"
                    style={{
                      left: align === "center" ? "50%" : 0,
                      transform:
                        align === "center"
                          ? `translateX(calc(-50% + ${offsetX}px)) translateY(${offsetY}px)`
                          : `translate(${offsetX}px, ${offsetY}px)`,
                    }}
                  >
                    <img
                      src={overlayImage}
                      alt="Pixel Perfect Reference"
                      className="max-w-none block pointer-events-none select-none"
                      draggable={false}
                      style={{ opacity: overlayOpacity / 100 }}
                      onLoad={(e) => {
                        if (e.currentTarget.naturalHeight) {
                          setNaturalImgHeight(e.currentTarget.naturalHeight);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Empty State or Live Iframe */}
                {isEmpty ? (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2 bg-white z-10"
                    style={{
                      opacity:
                        hasImage && isOverlayActive ? previewOpacity / 100 : 1,
                      transition: "opacity 0.05s ease-out",
                    }}
                  >
                    <span className="text-2xl">ðŸ–¼ï¸</span>
                    <p className="text-sm font-medium text-zinc-400">
                      There are no elements to display
                    </p>
                    <p className="text-xs text-zinc-500">
                      Add blocks to the canvas â€” they will appear here
                    </p>
                  </div>
                ) : (
                  <iframe
                    ref={iframeRef}
                    srcDoc={srcDoc}
                    title="iframe Prev"
                    sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
                    className="w-full border-0 bg-white block relative z-10 transition-[height] duration-200 ease-out"
                    onLoad={handleLoad}
                    style={{
                      height: effectiveHeight,
                      minHeight: effectiveHeight,
                      opacity:
                        hasImage && isOverlayActive ? previewOpacity / 100 : 1,
                      transition:
                        "height 0.2s ease-out, opacity 0.05s ease-out",
                    }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PreviewArea;
