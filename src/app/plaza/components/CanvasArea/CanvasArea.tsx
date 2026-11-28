"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useCanvasArea } from "@/app/plaza/components/CanvasArea/hooks/useCanvasArea";
import { useCanvasFloatingWindow } from "@/app/plaza/components/CanvasArea/hooks/useCanvasFloatingWindow";
import { NodeCard } from "@/app/plaza/components/CanvasArea/components/NodeCard";
import { CanvasMarqueeOverlay } from "@/app/plaza/components/CanvasArea/components/CanvasMarqueeOverlay";
import { CanvasDragGhost } from "@/app/plaza/components/CanvasArea/components/CanvasDragGhost";
import { CanvasToolbar } from "@/app/plaza/components/CanvasArea/components/CanvasToolbar";
import AsideCanvas from "@/app/plaza/components/CanvasArea/components/AsideCanvas/AsideCanvas";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import { getNodeKey } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import type { HtmlNode } from "@/types/HtmlNode";
import { ProjectManagerModal } from "@/app/plaza/components/ProjectManager/ProjectManagerModal";

const ModalNodeProperties = dynamic(
  () => import("./components/ModalNodeProperties"),
  { ssr: false },
);

export function CanvasArea() {
  const currentJson = useCanvasStore((s) => s.currentJson);
  const isSplit = useCanvasStore((s) => s.isSplit);
  const isTemplateMode = useCanvasStore((s) => s.isTemplateMode);
  const templateSlotKeys = useCanvasStore((s) => s.templateSlotKeys);
  const hudMessage = useCanvasStore((s) => s.hudMessage);
  const clickedKey = useCanvasStore((s) => s.clickedKey);
  const setClickedKey = useCanvasStore((s) => s.setClickedKey);
  const persist = useCanvasStore((s) => s.persist);
  const isCanvasFloating = useCanvasStore((s) => s.isCanvasFloating);
  const isArmingMarker = useCanvasStore((s) => s.isArmingMarker);
  const isStyleTransplantMode = useCanvasStore((s) => s.isStyleTransplantMode);
  const isBlendingStyles = useCanvasStore((s) => s.isBlendingStyles);
  const blendStylesFromPanes = useCanvasStore((s) => s.blendStylesFromPanes);
  const toggleStyleTransplantMode = useCanvasStore(
    (s) => s.toggleStyleTransplantMode,
  );

  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (useCanvasStore.getState().isArmingMarker) {
          useCanvasStore.getState().setArmingMarker(false);
          useCanvasStore.getState().showHud("Режим маркера отменен", "info");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const {
    containerRef,
    leftPaneRef,
    rightPaneRef,
    leftNodes,
    rightNodes,
    handleMarqueePointerDown,
  } = useCanvasArea();

  const {
    workspaceRef,
    graphZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    isInteractingWindow,
    floatingPos,
    floatingSize,
    handleWindowDragStart,
    handleWindowDragMove,
    handleWindowDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  } = useCanvasFloatingWindow(isCanvasFloating);

  const renderNodeList = (nodes: HtmlNode[], panePrefix: string) => (
    <div
      style={{
        transform: `scale(${graphZoom})`,
        transformOrigin: "top left",
      }}
      className="w-max min-w-full flex flex-row flex-nowrap items-start gap-2 p-3"
    >
      {nodes.map((node, index) => (
        <div
          key={`${panePrefix}-${getNodeKey(node) || index}`}
          className="relative flex flex-row items-start shrink-0 px-1.5"
        >
          <NodeCard
            node={node}
            depth={0}
            parentIsRow={true}
            showBeforeGap={true}
            showAfterGap={true}
          />
        </div>
      ))}
    </div>
  );

  const workspaceContent = (
    <div
      ref={workspaceRef}
      style={
        isCanvasFloating
          ? {
              left: 0,
              top: 0,
              width: `${floatingSize.w}px`,
              height: `${floatingSize.h}px`,
              transform: `translate3d(${floatingPos.x}px, ${floatingPos.y}px, 0)`,
            }
          : undefined
      }
      className={
        isCanvasFloating
          ? `plaza-workspace fixed z-[43] bg-zinc-950 border ${
              isArmingMarker
                ? "border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]"
                : "border-indigo-500/40 shadow-2xl"
            } rounded-xl overflow-hidden flex flex-col select-none will-change-transform transition-colors`
          : `plaza-workspace flex-1 min-h-[460px] relative bg-zinc-950 border ${
              isArmingMarker
                ? "border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.25)]"
                : "border-zinc-800 shadow-2xl"
            } rounded-xl overflow-hidden flex flex-col transition-colors`
      }
    >
      {/* HUD TOAST NOTIFICATION */}
      {hudMessage && (
        <div className="absolute top-9 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          <div
            className={`px-3 py-1.5 rounded-lg border shadow-2xl backdrop-blur-md text-xs font-mono font-medium flex items-center gap-2 ${
              hudMessage.type === "warning"
                ? "bg-amber-950/90 border-amber-500/60 text-amber-200"
                : hudMessage.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-200"
                  : "bg-zinc-900/90 border-indigo-500/60 text-zinc-200"
            }`}
          >
            <span className="size-2 rounded-full bg-current animate-ping" />
            <span>{hudMessage.text}</span>
          </div>
        </div>
      )}

      <CanvasToolbar
        graphZoom={graphZoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onDragStart={handleWindowDragStart}
        onDragMove={handleWindowDragMove}
        onDragEnd={handleWindowDragEnd}
      />

      {/* ПЛАШКА РЕЖИМА РАССТАНОВКИ МАРКЕРА */}
      {isArmingMarker && (
        <div className="bg-rose-950/90 border-b border-rose-500/60 px-3 py-1 flex items-center justify-between text-xs font-mono text-rose-200 shrink-0">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="animate-pulse">📍</span>
            <span>Режим расстановки маркера: кликните по ноде на канвасе</span>
          </span>
          <button
            type="button"
            onClick={() => useCanvasStore.getState().setArmingMarker(false)}
            className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-[11px] border border-rose-500/40 text-rose-300 cursor-pointer"
          >
            Отмена (Esc)
          </button>
        </div>
      )}

      {/* ПЛАШКА РЕЖИМА AI СТИЛИЗАЦИИ */}
      {isStyleTransplantMode && (
        <div className="bg-purple-950/90 border-b border-purple-500/60 px-3 py-1.5 flex items-center justify-between text-xs font-mono text-purple-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <span className="font-semibold text-purple-100">AI Styler:</span>
            <span className="text-purple-300 text-[11px] hidden sm:inline">
              Слева (Pane 1) — донор Figma &bull; Справа (Pane 2) — интерактивный пресет
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBlendingStyles}
              onClick={() => void blendStylesFromPanes()}
              className={`px-3 py-1 rounded font-bold text-[11px] border transition flex items-center gap-1.5 cursor-pointer ${
                isBlendingStyles
                  ? "bg-purple-850/50 border-purple-500/50 text-purple-300 cursor-wait animate-pulse"
                  : "bg-purple-600 hover:bg-purple-500 text-white border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.5)] active:scale-95"
              }`}
            >
              <span>{isBlendingStyles ? "⏳" : "🪄"}</span>
              <span>
                {isBlendingStyles ? "Стилизация..." : "Перенести стили (AI)"}
              </span>
            </button>
            <button
              type="button"
              onClick={toggleStyleTransplantMode}
              className="px-2 py-1 rounded bg-purple-900/60 hover:bg-purple-800 text-[11px] border border-purple-500/40 text-purple-300 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* WORKSPACE PANELS */}
      <div
        ref={containerRef}
        onPointerDown={handleMarqueePointerDown}
        className={`flex-1 flex ${isSplit ? "flex-row" : "flex-col"} overflow-hidden`}
      >
        {/* LEFT PANEL (PANE 1 - MAIN / DONORS) */}
        <div
          ref={leftPaneRef}
          data-pane="left"
          className="flex-1 h-full overflow-hidden flex flex-col"
        >
          {isSplit && (
            <div className="px-3 py-1 bg-zinc-900/40 text-[11px] font-mono text-zinc-500 border-b border-zinc-800/40 flex justify-between">
              <span>
                Pane 1{" "}
                {isStyleTransplantMode
                  ? "(Figma Donor)"
                  : isTemplateMode
                    ? "(Donors Source)"
                    : ""}
              </span>
              <span>{leftNodes.length} items</span>
            </div>
          )}
          <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1">
            {leftNodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs font-mono">
                Empty
              </div>
            ) : (
              renderNodeList(leftNodes, "p1")
            )}
          </div>
        </div>

        {/* RIGHT PANEL (PANE 2 - PROTOTYPE TEMPLATE) */}
        {isSplit && (
          <div
            ref={rightPaneRef}
            data-pane="right"
            className="flex-1 h-full overflow-hidden flex flex-col border-l border-zinc-800 bg-zinc-950"
          >
            <div className="px-3 py-1 bg-zinc-900/40 text-[11px] font-mono text-zinc-500 border-b border-zinc-800/40 flex justify-between items-center">
              <span>
                Pane 2{" "}
                {isStyleTransplantMode
                  ? "(Target Preset)"
                  : isTemplateMode
                    ? "(Template Blueprint)"
                    : ""}
              </span>
              <div className="flex items-center gap-2">
                {isTemplateMode && (
                  <span className="text-[10px] text-amber-400 font-bold">
                    {templateSlotKeys.length} slot(s)
                  </span>
                )}
                <span>{rightNodes.length} items</span>
              </div>
            </div>

            <div className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1">
              {rightNodes.length === 0 ? (
                <div className="w-full h-full border border-dashed border-zinc-800/50 rounded flex items-center justify-center text-xs font-mono text-zinc-700">
                  Drop template prototype nodes here
                </div>
              ) : (
                renderNodeList(rightNodes, "p2")
              )}
            </div>
          </div>
        )}
      </div>

      {/* RESIZE HANDLE (when floating) */}
      {isCanvasFloating && (
        <div
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          title="Resize Canvas window"
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize touch-none flex items-end justify-end p-0.5 text-zinc-500 hover:text-indigo-400"
        >
          <span className="text-[10px] leading-none">◢</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full flex-1 flex gap-1 select-none min-h-[460px]">
      <AsideCanvas />

      {isCanvasFloating && mounted
        ? createPortal(
            <>
              {isInteractingWindow && (
                <div className="fixed inset-0 z-[42] select-none" />
              )}
              {workspaceContent}
            </>,
            document.body,
          )
        : workspaceContent}

      <ModalNodeProperties
        key={clickedKey || "modal-props"}
        clickedKey={clickedKey}
        currentJson={currentJson}
        persist={persist}
        onClose={() => setClickedKey(null)}
      />
      <ProjectManagerModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
      />
      <CanvasDragGhost />
      <CanvasMarqueeOverlay />
    </div>
  );
}

export default CanvasArea;
