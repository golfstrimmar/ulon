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
    />
  );
}

export const CanvasMarqueeOverlay = memo(CanvasMarqueeOverlayComponent);
