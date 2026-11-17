"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ROOT_TAGS,
  ELEMENT_FOLDERS,
} from "@/app/plaza/components/CanvasArea/lib/elementsManifest";
import ButtonAddImg from "@/app/plaza/components/CanvasArea/components/ButtonAddImg";
import ButtonAddFlex from "@/app/plaza/components/CanvasArea/components/ButtonAddFlex";
import { useAsideCanvas } from "@/app/plaza/components/CanvasArea/components/AsideCanvas/hooks/useAsideCanvas";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
} from "@heroicons/react/24/outline";
import ButtonAddSwiper from "@/app/plaza/components/CanvasArea/components/ButtonAddSwiper";

function getHeaderOffset(): number {
  if (typeof document === "undefined") return 56;
  const header = document.querySelector("header");
  if (!header) return 12;
  const rect = header.getBoundingClientRect();
  return Math.max(8, Math.round(rect.bottom + 8));
}

export default function AsideCanvas() {
  const {
    openFolders,
    hasNodes,
    toggleFolder,
    handleClear,
    handleAppendFromPath,
    triggerUndo,
    triggerRedo,
    triggerCollapseAll,
  } = useAsideCanvas();

  const isAsideFloating = useCanvasStore((s) => s.isAsideFloating);
  const toggleAsideFloating = useCanvasStore((s) => s.toggleAsideFloating);

  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>({
    x: 8,
    y: 56,
  });

  const asideRef = useRef<HTMLElement | null>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: 8, y: 56 });
  const hasManualDragRef = useRef(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    minTop: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // При включении плавающего режима вычисляем стартовую позицию сразу под шапкой
  useEffect(() => {
    if (!isAsideFloating) {
      hasManualDragRef.current = false;
      dragStateRef.current = null;
      setIsDragging(false);
      return;
    }

    const updateTop = () => {
      if (hasManualDragRef.current) return;
      const y = getHeaderOffset();
      const next = { x: posRef.current.x, y };
      posRef.current = next;
      setFloatingPos(next);
    };

    updateTop();
    window.addEventListener("resize", updateTop);
    window.addEventListener("scroll", updateTop, { passive: true });
    return () => {
      window.removeEventListener("resize", updateTop);
      window.removeEventListener("scroll", updateTop);
    };
  }, [isAsideFloating]);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const minTop = getHeaderOffset();
    const maxX = Math.max(8, window.innerWidth - 200);
    const maxY = Math.max(minTop, window.innerHeight - 120);

    hasManualDragRef.current = true;
    dragStateRef.current = {
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
    setIsDragging(true);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    const nextX = Math.min(drag.maxX, Math.max(8, drag.origX + dx));
    const nextY = Math.min(drag.maxY, Math.max(drag.minTop, drag.origY + dy));

    posRef.current = { x: nextX, y: nextY };

    if (asideRef.current) {
      asideRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      asideRef.current.style.maxHeight = `calc(100vh - ${nextY + 12}px)`;
    }
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    dragStateRef.current = null;
    setIsDragging(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    setFloatingPos({ ...posRef.current });
  };

  const asideContent = (
    <aside
      ref={asideRef}
      style={
        isAsideFloating
          ? {
              left: 0,
              top: 0,
              transform: `translate3d(${floatingPos.x}px, ${floatingPos.y}px, 0)`,
              maxHeight: `calc(100vh - ${floatingPos.y + 12}px)`,
            }
          : undefined
      }
      className={
        isAsideFloating
          ? "fixed z-[45] w-48 shrink-0 bg-zinc-900 border border-indigo-500/40 rounded-md p-1 flex flex-col justify-between shadow-2xl select-none overflow-hidden will-change-transform"
          : "w-48 shrink-0 bg-zinc-900 border border-zinc-800 rounded-sm p-1 flex flex-col justify-between shadow-xl select-none overflow-hidden"
      }
    >
      {isAsideFloating && (
        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          title="Drag panel"
          className="h-5 mb-1 rounded bg-zinc-800 hover:bg-zinc-700 cursor-grab active:cursor-grabbing flex items-center justify-center text-[10px] font-mono text-zinc-300 shrink-0 touch-none select-none"
        >
          ⋮⋮ Tools
        </div>
      )}

      <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
        <div className="flex gap-2">
          {hasNodes && (
            <div>
              <button
                type="button"
                onClick={handleClear}
                className="red-btn px-1 flex-1"
              >
                Clear
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleAsideFloating}
            title={
              isAsideFloating
                ? "Return panel back to Canvas"
                : "Float panel on top over Preview"
            }
            className={`grey-btn btn flex-1 ${
              isAsideFloating ? "!border-indigo-500/60 !text-indigo-300" : ""
            }`}
          >
            {isAsideFloating ? (
              <ArrowDownCircleIcon className="size-4" />
            ) : (
              <ArrowUpCircleIcon className="size-4" />
            )}
          </button>
        </div>

        <div className="space-y-1 border-b border-zinc-800 pb-2">
          <div className="grid gap-1 grid-cols-[2fr_1fr_2fr]">
            <button
              type="button"
              onClick={triggerUndo}
              className="grey-btn btn"
            >
              <span>↶</span> Undo
            </button>

            <button
              type="button"
              onClick={triggerCollapseAll}
              className="grey-btn btn flex flex-col !gap-0 !p-0 opacity-100 cursor-pointer"
            >
              <i className="text-[8px]">↓</i>
              <i className="text-[8px]">↑</i>
            </button>

            <button
              type="button"
              onClick={triggerRedo}
              className="grey-btn btn"
            >
              <span>↷</span> Redo
            </button>
          </div>
        </div>

        <ButtonAddImg />
        <ButtonAddFlex />
        <ButtonAddSwiper />
        <div className="space-y-1">
          {ELEMENT_FOLDERS.map((folder) => {
            const isOpen = openFolders.has(folder.name);
            return (
              <div key={folder.name} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleFolder(folder.name)}
                  className="admin-btn !justify-between"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{isOpen ? "📂" : "📁"}</span>
                    <span className="font-mono">{folder.name}</span>
                  </span>
                  <span className="text-[12px] text-zinc-500 font-mono">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: 0 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="pl-3 py-0.5 space-y-1 border-l border-zinc-800/80"
                    >
                      <div className="flex flex-col gap-1">
                        {folder.items.map((item) => (
                          <button
                            type="button"
                            key={item.path}
                            onClick={() => handleAppendFromPath(item.path)}
                            className="admin-btn"
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="space-y-1 pt-1.5 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-1">
            {ROOT_TAGS.map((tag) => (
              <button
                type="button"
                key={tag.path}
                onClick={() => handleAppendFromPath(tag.path)}
                className="admin-btn !font-bold !text-[11px]"
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );

  if (isAsideFloating && mounted) {
    return createPortal(
      <>
        {isDragging && (
          <div className="fixed inset-0 z-[44] cursor-grabbing select-none" />
        )}
        {asideContent}
      </>,
      document.body,
    );
  }

  return <div>{asideContent}</div>;
}
