"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  SparklesIcon,
  TagIcon,
  Square3Stack3DIcon,
  CloudArrowUpIcon,
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
import { ProjectManagerModal } from "@/app/plaza/components/ProjectManager/ProjectManagerModal";

const ModalNodeProperties = dynamic(
  () => import("./components/ModalNodeProperties"),
  { ssr: false },
);

function getHeaderOffset(): number {
  if (typeof document === "undefined") return 56;
  const header = document.querySelector("header");
  if (!header) return 12;
  const rect = header.getBoundingClientRect();
  return Math.max(8, Math.round(rect.bottom + 8));
}

export function CanvasArea() {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

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
  const isCanvasFloating = useCanvasStore((s) => s.isCanvasFloating);
  const toggleCanvasFloating = useCanvasStore((s) => s.toggleCanvasFloating);

  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isInteractingWindow, setIsInteractingWindow] = useState(false);

  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>({
    x: 208,
    y: 56,
  });
  const [floatingSize, setFloatingSize] = useState<{ w: number; h: number }>({
    w: 720,
    h: 460,
  });

  const posRef = useRef<{ x: number; y: number }>({ x: 208, y: 56 });
  const sizeRef = useRef<{ w: number; h: number }>({ w: 720, h: 460 });
  const hasManualMoveRef = useRef(false);

  const dragWindowRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    minTop: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  const resizeWindowRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    maxW: number;
    maxH: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Стартовая позиция и размеры при подъёме канваса поверх превью
  useEffect(() => {
    if (!isCanvasFloating) {
      hasManualMoveRef.current = false;
      dragWindowRef.current = null;
      resizeWindowRef.current = null;
      setIsInteractingWindow(false);
      return;
    }

    const headerTop = getHeaderOffset();
    const isAsideFloating = useCanvasStore.getState().isAsideFloating;
    const defaultW = Math.min(760, Math.max(360, window.innerWidth - 230));
    const defaultH = Math.min(
      460,
      Math.max(240, window.innerHeight - headerTop - 24),
    );
    const defaultX = isAsideFloating
      ? Math.min(208, Math.max(8, window.innerWidth - defaultW - 8))
      : Math.max(8, Math.round((window.innerWidth - defaultW) / 2));

    posRef.current = { x: defaultX, y: headerTop };
    sizeRef.current = { w: defaultW, h: defaultH };
    setFloatingPos({ x: defaultX, y: headerTop });
    setFloatingSize({ w: defaultW, h: defaultH });

    const updateTopOnScroll = () => {
      if (hasManualMoveRef.current) return;
      const nextY = getHeaderOffset();
      posRef.current = { ...posRef.current, y: nextY };
      setFloatingPos({ ...posRef.current });
    };

    window.addEventListener("resize", updateTopOnScroll);
    window.addEventListener("scroll", updateTopOnScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", updateTopOnScroll);
      window.removeEventListener("scroll", updateTopOnScroll);
    };
  }, [isCanvasFloating]);

  const handleWindowDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCanvasFloating) return;
    if (
      (e.target as HTMLElement).closest("button, a, input, select, textarea")
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const minTop = getHeaderOffset();
    const maxX = Math.max(8, window.innerWidth - 240);
    const maxY = Math.max(minTop, window.innerHeight - 80);

    hasManualMoveRef.current = true;
    dragWindowRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
      minTop,
      maxX,
      maxY,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsInteractingWindow(true);
  };

  const handleWindowDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragWindowRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    const nextX = Math.min(drag.maxX, Math.max(8, drag.origX + dx));
    const nextY = Math.min(drag.maxY, Math.max(drag.minTop, drag.origY + dy));

    posRef.current = { x: nextX, y: nextY };

    if (workspaceRef.current) {
      workspaceRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    }
  };

  const handleWindowDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragWindowRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    dragWindowRef.current = null;
    setIsInteractingWindow(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    setFloatingPos({ ...posRef.current });
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCanvasFloating) return;
    e.preventDefault();
    e.stopPropagation();

    hasManualMoveRef.current = true;
    resizeWindowRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origW: sizeRef.current.w,
      origH: sizeRef.current.h,
      maxW: Math.max(360, window.innerWidth - posRef.current.x - 8),
      maxH: Math.max(220, window.innerHeight - posRef.current.y - 8),
    };

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsInteractingWindow(true);
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const res = resizeWindowRef.current;
    if (!res || res.pointerId !== e.pointerId) return;

    const dx = e.clientX - res.startX;
    const dy = e.clientY - res.startY;

    const nextW = Math.min(res.maxW, Math.max(360, res.origW + dx));
    const nextH = Math.min(res.maxH, Math.max(220, res.origH + dy));

    sizeRef.current = { w: nextW, h: nextH };

    if (workspaceRef.current) {
      workspaceRef.current.style.width = `${nextW}px`;
      workspaceRef.current.style.height = `${nextH}px`;
    }
  };

  const handleResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const res = resizeWindowRef.current;
    if (!res || res.pointerId !== e.pointerId) return;

    resizeWindowRef.current = null;
    setIsInteractingWindow(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    setFloatingSize({ ...sizeRef.current });
  };

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
          ? "plaza-workspace fixed z-[43] bg-zinc-950 border border-indigo-500/40 rounded-xl overflow-hidden shadow-2xl flex flex-col select-none will-change-transform"
          : "plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col"
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

      {/* TOP TOOLBAR (drag handle when floating) */}
      <div
        onPointerDown={handleWindowDragStart}
        onPointerMove={handleWindowDragMove}
        onPointerUp={handleWindowDragEnd}
        onPointerCancel={handleWindowDragEnd}
        className={`h-7 shrink-0 bg-zinc-900 border-b border-zinc-800 pl-2 pr-1 flex items-center justify-between text-xs text-zinc-400 ${
          isCanvasFloating
            ? "cursor-grab active:cursor-grabbing touch-none"
            : ""
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono !text-[10px]">
            {isCanvasFloating ? "⋮⋮ Workspace" : "Workspace"}
          </span>

          <button
            type="button"
            onClick={toggleCanvasFloating}
            title={
              isCanvasFloating
                ? "Return Canvas back to bottom"
                : "Float Canvas on top over Preview"
            }
            className={`p-0.5 rounded transition-colors cursor-pointer hover:bg-zinc-700 ${
              isCanvasFloating
                ? "text-indigo-300 bg-indigo-500/20"
                : "text-zinc-300"
            }`}
          >
            {isCanvasFloating ? (
              <ArrowDownCircleIcon className="size-4" />
            ) : (
              <ArrowUpCircleIcon className="size-4" />
            )}
          </button>
        </div>

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
    <div className="w-full flex gap-1 select-none">
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
