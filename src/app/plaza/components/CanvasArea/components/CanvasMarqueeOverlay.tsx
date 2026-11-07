"use client";

import React, { memo } from "react";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

function CanvasMarqueeOverlayComponent() {
  const selectionBox = useCanvasStore((s) => s.selectionBox);

  if (!selectionBox) return null;

  const left = Math.min(selectionBox.startX, selectionBox.currentX);
  const top = Math.min(selectionBox.startY, selectionBox.currentY);
  const width = Math.abs(selectionBox.currentX - selectionBox.startX);
  const height = Math.abs(selectionBox.currentY - selectionBox.startY);

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width,
        height,
        border: "2px dashed #06b6d4",
        backgroundColor: "rgba(6, 182, 212, 0.2)",
        boxShadow: "0 0 10px rgba(6, 182, 212, 0.4)",
        pointerEvents: "none",
        zIndex: 999999,
      }}
    >
      {/* Бейдж ширины сверху */}
      {width >= 4 && (
        <div
          style={{
            position: "absolute",
            top: top < 24 ? 4 : -22,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
          className="px-1.5 py-0.5 bg-zinc-950/90 text-cyan-300 border border-cyan-500/60 rounded text-[10px] font-mono font-medium shadow-md leading-none whitespace-nowrap"
        >
          {Math.round(width)}px
        </div>
      )}

      {/* Бейдж высоты слева */}
      {height >= 4 && (
        <div
          style={{
            position: "absolute",
            left: left < 44 ? 4 : -6,
            top: "50%",
            transform: left < 44 ? "translateY(-50%)" : "translate(-100%, -50%)",
            pointerEvents: "none",
          }}
          className="px-1.5 py-0.5 bg-zinc-950/90 text-cyan-300 border border-cyan-500/60 rounded text-[10px] font-mono font-medium shadow-md leading-none whitespace-nowrap"
        >
          {Math.round(height)}px
        </div>
      )}
    </div>
  );
}

export const CanvasMarqueeOverlay = memo(CanvasMarqueeOverlayComponent);
