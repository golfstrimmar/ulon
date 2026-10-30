"use client";

import React, { useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeftCircleIcon,
  ArrowRightCircleIcon,
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

const ModalNodeProperties = dynamic(
  () => import("./components/ModalNodeProperties"),
  { ssr: false },
);

export function CanvasArea() {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // ─────🔹 Координатор холста
  const { containerRef, handleMarqueePointerDown } = useCanvasArea();

  // ─────🔹 Атомарные подписки на Zustand стор
  const currentJson = useCanvasStore((s) => s.currentJson);
  const isSplit = useCanvasStore((s) => s.isSplit);
  const rightKeys = useCanvasStore((s) => s.rightKeys);
  const toggleSplitMode = useCanvasStore((s) => s.toggleSplitMode);
  const clickedKey = useCanvasStore((s) => s.clickedKey);
  const setClickedKey = useCanvasStore((s) => s.setClickedKey);
  const persist = useCanvasStore((s) => s.persist);

  // ─────🔹 Разделение нод: левая колонка получает свои, правая — свои
  const leftNodes = useMemo(() => {
    if (!isSplit || rightKeys.size === 0) return currentJson;
    return removeNodesByKeys(currentJson, rightKeys);
  }, [currentJson, rightKeys, isSplit]);

  const rightNodes = useMemo(() => {
    if (!isSplit || rightKeys.size === 0) return [];
    return extractNodesByKeys(currentJson, rightKeys);
  }, [currentJson, rightKeys, isSplit]);

  // ─────🔹 Отслеживаем перенос групп между Pane 1 и Pane 2
  useEffect(() => {
    if (!isSplit) return;

    const handlePointerUp = (e: PointerEvent) => {
      const activeKeys = useCanvasStore.getState().draggedKeys;
      if (activeKeys.length === 0) return;

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

  /** Рендер списка нод со всеми DropGap */
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

  return (
    <div className="w-full flex gap-1 select-none">
      {/* ЛЕВАЯ ПАНЕЛЬ С КНОПКАМИ */}
      <AsideCanvas />

      {/* РАБОЧАЯ ОБЛАСТЬ ХОЛСТА */}
      <div
        ref={containerRef}
        onPointerDown={handleMarqueePointerDown}
        className="plaza-workspace flex-1 relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* ВЕРХНИЙ БАР */}
        <div className="h-7 shrink-0 bg-zinc-900 border-b border-zinc-800 pl-2 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono !text-[10px]">Workspace</span>
          <button
            type="button"
            onClick={toggleSplitMode}
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

        {/* СПЛИТ-ОБЛАСТЬ (PANE 1 И PANE 2) */}
        <div className="flex-1 flex overflow-hidden">
          {/* ЛЕВАЯ КОЛОНКА (PANE 1) */}
          <div
            ref={leftPaneRef}
            className="flex-1 h-full overflow-hidden flex flex-col"
          >
            {isSplit && (
              <div className="px-3 py-1 bg-zinc-900/40 text-[11px] font-mono text-zinc-500 border-b border-zinc-800/40 flex justify-between">
                <span>Pane 1</span>
                <span>{leftNodes.length} items</span>
              </div>
            )}
            <div
              className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1"
              onPointerDown={handleMarqueePointerDown}
            >
              {leftNodes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs font-mono">
                  Empty
                </div>
              ) : (
                renderNodeList(leftNodes, "p1")
              )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА (PANE 2) */}
          {isSplit && (
            <div
              ref={rightPaneRef}
              className="flex-1 h-full overflow-hidden flex flex-col border-l border-zinc-800 bg-zinc-950"
            >
              <div className="px-3 py-1 bg-zinc-900/40 text-[11px] font-mono text-zinc-500 border-b border-zinc-800/40 flex justify-between">
                <span>Pane 2</span>
                <span>{rightNodes.length} items</span>
              </div>

              <div
                className="plaza-inner w-full h-full overflow-auto custom-scrollbar p-1"
                onPointerDown={handleMarqueePointerDown}
              >
                {rightNodes.length === 0 ? (
                  <div className="w-full h-full border border-dashed border-zinc-800/50 rounded flex items-center justify-center text-xs font-mono text-zinc-700">
                    Drop nodes here
                  </div>
                ) : (
                  renderNodeList(rightNodes, "p2")
                )}
              </div>
            </div>
          )}
        </div>

        {/* МОДАЛКА СВОЙСТВ */}
        <ModalNodeProperties
          clickedKey={clickedKey}
          currentJson={currentJson}
          persist={persist}
          onClose={() => setClickedKey(null)}
        />
      </div>

      {/* ИЗОЛИРОВАННЫЙ ОВЕРЛЕЙ ПРИЗРАКА ПЕРЕТАСКИВАНИЯ (0 лишних рендеров холста) */}
      <CanvasDragGhost />

      {/* ИЗОЛИРОВАННЫЙ ОВЕРЛЕЙ РАМКИ ВЫДЕЛЕНИЯ (0 лишних рендеров холста) */}
      <CanvasMarqueeOverlay />
    </div>
  );
}

export default CanvasArea;
