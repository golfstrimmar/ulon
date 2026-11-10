import React from "react";

interface ToggleProps {
  label: string;
  badge: string;
  value: boolean;
  onChange: (v: boolean) => void;
  badgeColor?: "emerald" | "violet";
}

export default function Toggle({
  label,
  badge,
  value,
  onChange,
  badgeColor = "emerald",
}: ToggleProps) {
  const colors = {
    emerald: {
      track: "bg-emerald-600 border-emerald-500",
      badge: "text-emerald-400 bg-emerald-950/60 border-emerald-700/50",
    },
    violet: {
      track: "bg-violet-600 border-violet-500",
      badge: "text-violet-300 bg-violet-950/50 border-violet-700/50",
    },
  };
  const c = colors[badgeColor];

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full border transition-colors cursor-pointer ${
          value ? c.track : "bg-zinc-700 border-zinc-600"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <span className="text-xs font-mono text-zinc-300">{label}</span>
      {value && (
        <span
          className={`text-[10px] font-mono rounded px-1.5 py-0.5 border ${c.badge}`}
        >
          {badge}
        </span>
      )}
    </label>
  );
}
