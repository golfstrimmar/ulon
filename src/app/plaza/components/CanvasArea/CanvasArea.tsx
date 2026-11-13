"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
  SparklesIcon,
  TagIcon,
  Square3Stack3DIcon,
} from "@heroicons/react/24/outline";
import { useCanvasArea } from "@/app/plaza/components/CanvasArea/hooks/useCanvasArea";
import { NodeCard } from "@/app/plaza/components/CanvasArea/components/NodeCard";
import { DropGap } from "@/app/plaza/components/CanvasArea/components/DropGap";
import { CanvasMarqueeOverlay } from "@/app/plaza/components/CanvasArea/components/CanvasMarqueeOverlay";
import { CanvasDragGhost } from "@/app/plaza/components/CanvasArea/components/CanvasDragGhost";
import AsideCanvas from "@/app/plaza/components/CanvasArea/components/AsideCanvas/AsideCanvas";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  getNodeKey,
  removeNodesByKeys,
  extractNodesByKeys,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import type { HtmlNode } from "@/types/HtmlNode";
// 1. В импорты CanvasArea.tsx добавь:
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";
import { ProjectManagerModal } from "@/app/plaza/components/ProjectManager/ProjectManagerModal";
const ModalNodeProperties = dynamic(
  () => import("./components/ModalNodeProperties"),
  { ssr: false },
);

export function CanvasArea() {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const { containerRef, handleMarqueePointerDown } = useCanvasArea();

  const currentJson = useCanvasStore((s) => s.currentJson);
  const isSplit = useCanvasStore((s) => s.isSplit);
  const rightKeys = useCanvasStore((s) => s.rightKeys);
  const toggleSplitMode = useCanvasStore((s) => s.toggleSplitMode);
  const isDonorMode = useCanvasStore((s) => s.isDonorMode);
  const toggleDonorMode = useCanvasStore((s) => s.toggleDonorMode);
  const isTemplateMode = useCanvasStore((s) => s.isTemplateMode);
  const toggleTemplateMode = useCanvasStore((s) => s.toggleTemplateMode);
  const templateSlotKeys = useCanvasStore((s) => s.templateSlotKeys);
  const hudMessage = useCanvasStore((s) => s.hudMessage);
  const clickedKey = useCanvasStore((s) => s.clickedKey);
  const setClickedKey = useCanvasStore((s) => s.setClickedKey);
  const persist = useCanvasStore((s) => s.persist);
  const applyBemClasses = useCanvasStore((s) => s.applyBemClasses);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const leftNodes = useMemo(() => {
    if (!isSplit || rightKeys.size === 0) return currentJson;
    return removeNodesByKeys(currentJson, rightKeys);
  }, [currentJson, rightKeys, isSplit]);

  const rightNodes = useMemo(() => {
    if (!isSplit || rightKeys.size === 0) return [];
    return extractNodesByKeys(currentJson, rightKeys);
  }, [currentJson, rightKeys, isSplit]);

  useEffect(() => {
    if (!isSplit) return;

    const handlePointerUp = (e: PointerEvent) => {
      const state = useCanvasStore.getState();
      const activeKeys = state.draggedKeys;
      if (activeKeys.length === 0) return;

      if (state.dropTarget?.position === "donor") {
        return;
      }

      const leftEl = leftPaneRef.current;
      const rightEl = rightPaneRef.current;

      const isInside = (el: HTMLElement | null) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        );
      };

      if (isInside(rightEl)) {
        useCanvasStore.getState().moveKeysToRightPane(activeKeys);
      } else if (isInside(leftEl)) {
        useCanvasStore.getState().moveKeysToLeftPane(activeKeys);
      }
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [isSplit]);

  const renderNodeList = (nodes: HtmlNode[], panePrefix: string) => {
    return (
      <div className="w-full mx-auto flex flex-col min-h-full">
        {nodes.map((node, index) => (
          <React.Fragment key={`${panePrefix}-${getNodeKey(node) || index}`}>
            {index === 0 && (
              <DropGap
                targetKey={getNodeKey(node)}
                position="before"
                orientation="horizontal"
              />
            )}
            <NodeCard node={node} depth={0} parentIsRow={false} />
            <DropGap
              targetKey={getNodeKey(node)}
              position="after"
              orientation="horizontal"
            />
          </React.Fragment>
        ))}
      </div>
    );
  };
  //  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
  return (
    <div className="w-full flex gap-1 select-none">
      <AsideCanvas />

      <div className="plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
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

        {/* TOP TOOLBAR */}
        <div className="h-7 shrink-0 bg-zinc-900 border-b border-zinc-800 pl-2 pr-1 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono !text-[10px]">Workspace</span>

          <button
            type="button"
            onClick={() => setIsProjectsOpen(true)}
            title="Manage user projects and website folders in Neon DB"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all pointer-pointer border bg-blue-950/40 text-blue-300 hover:text-white hover:bg-blue-600/30 border-blue-700/50"
          >
            <CloudArrowUpIcon className="size-3.5 text-blue-400" />
            <span>Projects</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={applyBemClasses}
              title="Auto-generate BEM classes for section descendants"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all pointer-pointer border bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border-zinc-700/50 hover:border-indigo-500/50"
            >
              <TagIcon className="size-3.5 text-indigo-400" />
              <span>+ class</span>
            </button>

            {/* TEMPLATE MODE BUTTON */}
            <button
              type="button"
              onClick={toggleTemplateMode}
              title={
                isTemplateMode
                  ? "Template mode: ON (click right nodes to set slots [1], [2]..., marquee left nodes to fill)"
                  : "Template mode: OFF"
              }
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all pointer-pointer border ${
                isTemplateMode
                  ? "bg-indigo-600/25 text-indigo-200 border-indigo-500/70 shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border-zinc-700/50"
              }`}
            >
              <Square3Stack3DIcon
                className={`size-3.5 ${
                  isTemplateMode ? "text-indigo-400" : "text-zinc-400"
                }`}
              />
              <span>Template</span>
              {templateSlotKeys.length > 0 && (
                <span className="px-1 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                  {templateSlotKeys.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={toggleDonorMode}
              title={
                isDonorMode
                  ? "Donor mode: ON (dropping onto Pane 2 node merges props and removes donor)"
                  : "Donor mode: OFF (nodes are nested normally)"
              }
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all pointer-pointer border ${
                isDonorMode
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border-zinc-700/50"
              }`}
            >
              <SparklesIcon
                className={`size-3.5 ${
                  isDonorMode ? "text-amber-400" : "text-zinc-400"
                }`}
              />
              <span>Donor</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDonorMode ? "bg-amber-400 animate-pulse" : "bg-zinc-600"
                }`}
              />
            </button>

            <button
              type="button"
              onClick={toggleSplitMode}
              title={isSplit ? "Collapse split panel" : "Expand split panel"}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors pointer-pointer hover:bg-zinc-700 ${
                isSplit ? " text-white" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {isSplit ? (
                <ArrowRightCircleIcon className="size-4" />
              ) : (
                <ArrowLeftCircleIcon className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* WORKSPACE PANELS */}
        <div
          ref={containerRef}
          onPointerDown={handleMarqueePointerDown}
          className="flex-1 flex overflow-hidden"
        >
          {/* LEFT PANEL (PANE 1 - MAIN / DONORS) */}
          <div
            ref={leftPaneRef}
            data-pane="left"
            className="flex-1 h-full overflow-hidden flex flex-col"
          >
            {isSplit && (
              <div className="px-3 py-1 bg-zinc-900/40 text-[11px] font-mono text-zinc-500 border-b border-zinc-800/40 flex justify-between">
                <span>Pane 1 {isTemplateMode && "(Donors Source)"}</span>
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
                <span>Pane 2 {isTemplateMode && "(Template Blueprint)"}</span>
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

        <ModalNodeProperties
          key={clickedKey || "modal-props"}
          clickedKey={clickedKey}
          currentJson={currentJson}
          persist={persist}
          onClose={() => setClickedKey(null)}
        />
      </div>
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
