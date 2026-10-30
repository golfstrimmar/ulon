"use client";

import React, { memo } from "react";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

export interface DropGapProps {
  targetKey: string;
  position: "before" | "after";
  orientation?: "horizontal" | "vertical";
}

function DropGapComponent({
  targetKey,
  position,
  orientation = "horizontal",
}: DropGapProps) {
  // Точечный селектор Zustand: рендерится ТОЛЬКО тот DropGap, на который навели курсор!
  const isTarget = useCanvasStore(
    (s) =>
      s.draggedKeys.length > 0 &&
      s.dropTarget?.key === targetKey &&
      s.dropTarget?.position === position,
  );
  const isDragging = useCanvasStore((s) => s.draggedKeys.length > 0);

  const isVert = orientation === "vertical";

  return (
    <div
      data-gap-key={targetKey}
      data-gap-pos={position}
      className={`relative select-none flex items-center justify-center cursor-default shrink-0 ${
        isVert ? "w-2 h-full min-h-[30px] self-stretch" : "h-2 w-full"
      }`}
    >
      {isDragging && (
        <div
          className={`absolute pointer-events-none z-20 ${
            isVert ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1"
          }`}
        />
      )}

      {isTarget && (
        <div
          className={`absolute flex items-center pointer-events-none z-30 ${
            isVert ? "inset-y-0 flex-col" : "inset-x-0 flex-row"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] shrink-0" />
          <div
            className={`bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8] ${
              isVert ? "w-[2px] flex-1" : "h-[2px] flex-1"
            }`}
          />
        </div>
      )}
    </div>
  );
}

export const DropGap = memo(DropGapComponent);
export default DropGap;
