"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  XMarkIcon,
  CheckIcon,
  TrashIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import { collectAllDescendantKeys } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import {
  compileWireframeBoxesToTree,
  type WireframeBox,
} from "../models/wireframeTreeCompiler";

interface TracingWireframeOverlayProps {
  isActive: boolean;
  onClose: () => void;
  viewportWidth: number | string;
  viewportHeight: number;
}

const SNAP_GRID = 8;
const AVAILABLE_TAGS = [
  "",
  "section",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "p",
  "span",
  "a",
  "button",
  "is",
  "ul",
  "li",
  "i",
] as const;

export default function TracingWireframeOverlay({
  isActive,
  onClose,
  viewportWidth,
  viewportHeight,
}: TracingWireframeOverlayProps) {
  const [boxes, setBoxes] = useState<WireframeBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [useSnap, setUseSnap] = useState(true);

  const [currentBox, setCurrentBox] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const snap = useCallback(
    (val: number) =>
      useSnap ? Math.round(val / SNAP_GRID) * SNAP_GRID : Math.round(val),
    [useSnap],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-wireframe-ui]")) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = snap(e.clientX - rect.left);
    const y = snap(e.clientY - rect.top);

    setIsDrawing(true);
    setCurrentBox({ startX: x, startY: y, curX: x, curY: y });
    setSelectedBoxId(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentBox || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const curX = snap(e.clientX - rect.left);
    const curY = snap(e.clientY - rect.top);

    setCurrentBox((prev) => (prev ? { ...prev, curX, curY } : null));
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);

    const x = Math.min(currentBox.startX, currentBox.curX);
    const y = Math.min(currentBox.startY, currentBox.curY);
    const width = Math.abs(currentBox.curX - currentBox.startX);
    const height = Math.abs(currentBox.curY - currentBox.startY);

    setCurrentBox(null);

    if (width >= 16 && height >= 16) {
      const newBox: WireframeBox = {
        id: `box_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        x,
        y,
        width,
        height,
        tag: "", // По умолчанию пустой
      };
      setBoxes((prev) => [...prev, newBox]);
      setSelectedBoxId(newBox.id);
    }
  };

  const deleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  const updateBoxTag = (id: string, tag: string) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, tag } : b)));
  };

  const handleCommitToCanvas = async () => {
    if (boxes.length === 0) return;

    const generatedNodes = compileWireframeBoxesToTree(boxes);
    const store = useCanvasStore.getState();
    const currentTree = store.currentJson;
    const nextTree = [...currentTree, ...generatedNodes];

    if (store.isSplit) {
      const newKeys: string[] = [];
      for (const node of generatedNodes) {
        newKeys.push(...collectAllDescendantKeys(node));
      }
      store.setRightKeys((prev) => {
        const next = new Set(prev);
        newKeys.forEach((k) => next.add(k));
        return next;
      });
      store.showHud(
        `Created ${boxes.length} frame(s) in Template Pane 2!`,
        "success",
      );
    } else {
      store.showHud(`Created ${boxes.length} frame(s) on Canvas!`, "success");
    }

    await store.persist(nextTree);
    onClose();
  };

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute inset-0 z-40 select-none cursor-crosshair overflow-hidden bg-black/40 backdrop-blur-[1px]"
      style={{
        width: viewportWidth,
        minWidth: viewportWidth,
        height: viewportHeight,
        minHeight: viewportHeight,
      }}
    >
      {/* Верхняя панель */}
      <div
        data-wireframe-ui="true"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 px-3 rounded-xl bg-zinc-950/90 border border-cyan-500/50 shadow-2xl backdrop-blur-md cursor-default text-xs font-mono"
      >
        <span className="text-cyan-400 font-bold flex items-center gap-1.5">
          <ArrowsPointingOutIcon className="w-4 h-4" />
          <span>Tracing Mode</span>
        </span>

        <span className="w-px h-3.5 bg-zinc-800" />

        <button
          type="button"
          onClick={() => setUseSnap(!useSnap)}
          className={`px-2 py-0.5 rounded border transition ${
            useSnap
              ? "bg-cyan-950/80 border-cyan-500/70 text-cyan-300 font-bold"
              : "bg-zinc-800 border-zinc-700 text-zinc-400"
          }`}
        >
          {useSnap ? "Snap 8px: ON" : "Snap: OFF"}
        </button>

        <span className="text-zinc-400">{boxes.length} box(es)</span>

        {boxes.length > 0 && (
          <button
            type="button"
            onClick={() => setBoxes([])}
            className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition"
            title="Clear all"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}

        <span className="w-px h-3.5 bg-zinc-800" />

        <button
          type="button"
          disabled={boxes.length === 0}
          onClick={handleCommitToCanvas}
          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-lg transition shadow-md shadow-cyan-950 flex items-center gap-1 cursor-pointer"
        >
          <CheckIcon className="w-4 h-4" />
          <span>Commit to Canvas</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
          title="Exit"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Рисуемая рамка в моменте */}
      {currentBox && (
        <div
          className="absolute border-2 border-dashed border-cyan-400 bg-cyan-500/15 pointer-events-none"
          style={{
            left: Math.min(currentBox.startX, currentBox.curX),
            top: Math.min(currentBox.startY, currentBox.curY),
            width: Math.abs(currentBox.curX - currentBox.startX),
            height: Math.abs(currentBox.curY - currentBox.startY),
          }}
        />
      )}

      {/* Нарисованные коробки */}
      {boxes.map((box) => {
        const isSelected = box.id === selectedBoxId;

        return (
          <div
            key={box.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBoxId(box.id);
            }}
            className={`absolute border-2 transition-all cursor-pointer ${
              isSelected
                ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.4)] z-30"
                : "border-cyan-500/60 bg-cyan-950/20 hover:border-cyan-400/90 z-20"
            }`}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
          >
            {/* Бейдж выбранного тега */}
            <div className="absolute top-1 left-1 flex items-center gap-1 font-mono text-[10px]">
              <span
                className={`px-1.5 py-0.2 rounded font-bold border ${
                  box.tag
                    ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                    : "bg-zinc-900/90 border-dashed border-zinc-500 text-zinc-400"
                }`}
              >
                {box.tag || "empty"}
              </span>
            </div>

            {/* 🎯 ПАНЕЛЬ ВЫБОРА ТЕГА НАД ВЫБРАННОЙ РАМКОЙ */}
            {isSelected && (
              <div
                data-wireframe-ui="true"
                className="absolute top-full left-0 flex items-center gap-1 bg-zinc-950 border border-zinc-700 p-0.5 rounded-lg shadow-xl z-40 text-[10px] font-mono"
              >
                {AVAILABLE_TAGS.map((t) => (
                  <button
                    key={t || "empty"}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateBoxTag(box.id, t);
                    }}
                    className={`px-1.5 py-0.2 rounded border transition ${
                      box.tag === t
                        ? "bg-cyan-600 text-white font-bold border-cyan-400"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {t || "empty"}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={(e) => deleteBox(box.id, e)}
                  className="px-1 text-red-400 hover:text-white rounded hover:bg-red-900/40 ml-1"
                  title="Delete box"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
