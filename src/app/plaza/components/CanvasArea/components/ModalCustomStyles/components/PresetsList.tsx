import React from "react";
import { STYLE_PRESETS } from "@/app/plaza/components/CanvasArea/constants/theme";

interface Props {
  onApplySnippet: (snippetCss: string) => void;
}

export function PresetsList({ onApplySnippet }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {STYLE_PRESETS.map((group) => (
        <div key={group.category} className="flex flex-col gap-1">
          <span className="text-[9px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
            {group.category}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.items.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onApplySnippet(preset.css)}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-indigo-600 hover:text-white border border-zinc-750 text-zinc-200 text-[10px] font-mono transition text-left cursor-pointer flex-1 min-w-[95px]  min-h-[20px]"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
