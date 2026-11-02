"use client";

import React, { useState, useEffect } from "react";
import { useBreakpoint } from "@/app/plaza/components/PreviewArea/hooks/useBreakpoint";

export default function BreakpointControls() {
  const {
    activeId,
    activeBreakpoint,
    effectiveWidth,
    isRotated,
    selectBreakpoint,
    setCustomWidth,
    toggleRotate,
    breakpoints,
  } = useBreakpoint();

  const [inputVal, setInputVal] = useState<string>("");

  useEffect(() => {
    if (effectiveWidth === "100%") {
      setInputVal("");
    } else {
      setInputVal(String(effectiveWidth));
    }
  }, [effectiveWidth]);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputVal, 10);
    if (!isNaN(num) && num > 0) {
      setCustomWidth(num);
    }
  };

  const handleInputBlur = () => {
    const num = parseInt(inputVal, 10);
    if (!isNaN(num) && num > 0) {
      setCustomWidth(num);
    } else if (effectiveWidth !== "100%") {
      setInputVal(String(effectiveWidth));
    }
  };

  const canRotate = Boolean(activeBreakpoint.rotatedWidth);

  return (
    <div className="flex items-center gap-1 bg-zinc-950/70 p-0.5 rounded-lg border border-zinc-800 text-[11px] font-mono">
      {/* Кнопки с отрезками брейкпоинтов */}
      <div className="flex items-center gap-0.5">
        {breakpoints.map((b) => {
          const isActive = activeId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => selectBreakpoint(b.id)}
              title={`${b.name}: ${b.segment} | @media ${b.mediaQuery}`}
              className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 select-none text-[10px] font-mono font-bold whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white border border-indigo-400 shadow-sm"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-800 border border-transparent"
              }`}
            >
              {b.id !== "full" && (
                <span
                  className={`text-[9px] font-normal ${
                    isActive ? "text-indigo-200" : "text-zinc-500"
                  }`}
                >
                  {b.name}
                </span>
              )}
              <span>{b.segment}</span>
            </button>
          );
        })}
      </div>

      {/* Разделитель */}
      <span className="w-px h-3.5 bg-zinc-800 mx-0.5" />

      {/* Поле произвольного ввода ширины */}
      <form onSubmit={handleInputSubmit} className="flex items-center gap-1">
        <input
          type="text"
          value={effectiveWidth === "100%" ? "100%" : inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={handleInputBlur}
          title="Custom width in px (press Enter)"
          className="w-12 px-1 py-0.5 text-center text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:border-indigo-500"
        />
        <span className="text-[10px] text-zinc-400 select-none">px</span>
      </form>

      {/* Поворот ориентации */}
      {canRotate && (
        <button
          type="button"
          onClick={toggleRotate}
          title={`Rotate Orientation (${isRotated ? "Landscape" : "Portrait"})`}
          className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 border ${
            isRotated
              ? "bg-amber-950/80 border-amber-600/70 text-amber-300 font-bold"
              : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-400"
          }`}
        >
          <span className="text-xs">🔄</span>
        </button>
      )}
    </div>
  );
}
