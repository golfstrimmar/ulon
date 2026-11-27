"use client";

import React, { useState, useEffect } from "react";
import type { TokenItem } from "@/app/plaza/components/CanvasArea/components/ModalTokens/tokensModel";

interface TokenRowProps {
  token: TokenItem;
  onChangeValue: (name: string, nextValue: string) => void;
}

export function TokenRow({ token, onChangeValue }: TokenRowProps) {
  const [localVal, setLocalVal] = useState(token.value);
  const isColor = token.type === "color";
  const isDimension = token.type === "dimension";

  useEffect(() => {
    setLocalVal(token.value);
  }, [token.value]);

  const getHexColor = (val: string): string => {
    const clean = val.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
    if (/^#[0-9a-f]{3}$/i.test(clean)) {
      return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
    }
    return "#3b82f6";
  };

  const getDimensionNumber = (val: string): number => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const getDimensionUnit = (val: string): string => {
    const match = val.match(/[a-z%]+$/i);
    return match ? match[0] : "px";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalVal(next);
    onChangeValue(token.name, next);
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalVal(next);
    onChangeValue(token.name, next);
  };

  const handleDimensionSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const unit = getDimensionUnit(localVal);
    const next = `${e.target.value}${unit}`;
    setLocalVal(next);
    onChangeValue(token.name, next);
  };

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isColor && (
            <label className="relative flex items-center justify-center w-5 h-5 rounded border border-zinc-700 shadow-sm cursor-pointer shrink-0 overflow-hidden group">
              <span
                className="absolute inset-0"
                style={{ backgroundColor: localVal }}
              />
              <input
                type="color"
                value={getHexColor(localVal)}
                onChange={handleColorPickerChange}
                className="opacity-0 w-0 h-0 absolute cursor-pointer"
                title="Open native color picker"
              />
            </label>
          )}

          <span
            className="font-mono text-xs text-indigo-300 font-semibold truncate select-all"
            title={token.name}
          >
            {token.name}
          </span>
        </div>

        <input
          type="text"
          value={localVal}
          onChange={handleInputChange}
          className="w-28 sm:w-36 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-750 font-mono text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition shrink-0"
          placeholder="value"
        />
      </div>

      {isColor && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase shrink-0">
            Hue:
          </span>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            onChange={(e) => {
              const h = Number(e.target.value);
              const next = `hsl(${h}, 70%, 50%)`;
              setLocalVal(next);
              onChangeValue(token.name, next);
            }}
            className="w-full h-1.5 accent-indigo-500 cursor-pointer rounded-lg bg-gradient-to-r from-red-500 via-green-500 via-blue-500 to-red-500"
            title="Adjust hue slider"
          />
        </div>
      )}

      {isDimension && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase shrink-0">
            Size:
          </span>
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={getDimensionNumber(localVal)}
            onChange={handleDimensionSliderChange}
            className="w-full h-1.5 accent-indigo-500 cursor-pointer rounded-lg bg-zinc-800"
            title="Adjust dimension slider"
          />
          <span className="text-[10px] font-mono text-zinc-400 w-8 text-right shrink-0">
            {getDimensionNumber(localVal)}
            {getDimensionUnit(localVal)}
          </span>
        </div>
      )}
    </div>
  );
}
