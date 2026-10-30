"use client";

import React, { memo } from "react";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import { findNodeByKey } from "@/lib/htmlTree";
import type { HtmlNode } from "@/types/HtmlNode";

function CanvasDragGhostComponent() {
  const dragMousePos = useCanvasStore((s) => s.dragMousePos);
  const draggedKeys = useCanvasStore((s) => s.draggedKeys);
  const currentJson = useCanvasStore((s) => s.currentJson);

  if (!dragMousePos || draggedKeys.length === 0) return null;

  // Находим объекты перетаскиваемых нод для отображения призрака
  const draggedNodes: HtmlNode[] = [];
  for (const key of draggedKeys) {
    for (const root of currentJson) {
      const found = findNodeByKey(root, key);
      if (found) {
        draggedNodes.push(found);
        break;
      }
    }
  }

  const primaryNode = draggedNodes[0] || null;
  if (!primaryNode) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: dragMousePos.x + 14,
        top: dragMousePos.y + 14,
        pointerEvents: "none",
        zIndex: 99999,
      }}
      className="flex flex-col items-start select-none"
    >
      {/* Стопка карточек при групповом перетаскивании */}
      {draggedNodes.length > 1 && (
        <div className="relative mb-1" style={{ width: 180, height: 36 }}>
          {/* Тени карточек в стопке */}
          <div
            className="absolute rounded-md bg-indigo-950/50 border border-indigo-400/40 backdrop-blur-sm"
            style={{ width: 180, height: 28, top: 8, left: 8 }}
          />
          <div
            className="absolute rounded-md bg-indigo-950/70 border border-indigo-400/50 backdrop-blur-sm"
            style={{ width: 180, height: 28, top: 4, left: 4 }}
          />
          {/* Верхняя карточка — первый элемент группы */}
          <div
            className="absolute px-2.5 py-1 rounded-md bg-indigo-950/90 border border-indigo-400 text-white shadow-2xl flex items-center gap-2 backdrop-blur-sm"
            style={{ width: 180, height: 28, top: 0, left: 0 }}
          >
            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono uppercase bg-indigo-900 border border-indigo-500 text-indigo-200 leading-none">
              {primaryNode.tag || "div"}
            </span>
            <span className="text-[11px] font-mono text-zinc-300 leading-none">
              ×{draggedNodes.length}
            </span>
          </div>
        </div>
      )}

      {/* Одиночная карточка */}
      {draggedNodes.length === 1 && (
        <div className="px-2.5 py-1 rounded-md bg-indigo-950/90 border border-indigo-400 text-white shadow-2xl flex items-center gap-2 backdrop-blur-sm">
          <span className="px-1.5 py-0.5 rounded text-[11px] font-mono uppercase bg-indigo-900 border border-indigo-500 text-indigo-200 leading-none">
            {primaryNode.tag || "div"}
          </span>

          {primaryNode.class && (
            <span className="text-[11px] font-mono text-green-300 max-w-[140px] truncate leading-none">
              .{primaryNode.class.trim().replace(/\s+/g, " .")}
            </span>
          )}

          {primaryNode.text && (
            <span className="text-[11px] text-zinc-300 max-w-[100px] truncate leading-none font-sans">
              &quot;{primaryNode.text}&quot;
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const CanvasDragGhost = memo(CanvasDragGhostComponent);
