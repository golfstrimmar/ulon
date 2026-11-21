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
  // 🚀 Абсолютно бессмертный гэп: рендерится строго ОДИН целевой гэп при наведении мыши
  const isTarget = useCanvasStore(
    (s) =>
      s.dropTarget?.key === targetKey && s.dropTarget?.position === position,
  );

  const isVert = orientation === "vertical";

  return (
    <div
      data-gap-key={targetKey}
      data-gap-pos={position}
      className={`relative select-none flex items-center justify-center cursor-default shrink-0 ${
        isVert ? "w-3 h-full min-h-[30px] self-stretch" : "h-3 w-full"
      }`}
    >
      {isTarget && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          {isVert ? (
            <div className="w-[3px] h-full min-h-[28px] max-h-[38px] bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8,0_0_2px_#ffffff]" />
          ) : (
            <div className="h-[3px] w-full min-w-[28px] max-w-[38px] bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8,0_0_2px_#ffffff]" />
          )}
        </div>
      )}
    </div>
  );
}

export const DropGap = memo(DropGapComponent);
export default DropGap;
