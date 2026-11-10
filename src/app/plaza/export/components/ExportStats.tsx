"use client";

import React from "react";

interface ExportStatsProps {
  stats: {
    htmlBytes: number;
    cssBytes: number;
    jsBytes: number;
    assetsBytes?: number;
    assetsCount?: number;
    htmlLines: number;
    cssLines: number;
    jsLines: number;
    cssRulesKept: number;
    cssRulesRemoved: number;
  } | null;
  isPurgeOn: boolean;
  isDedupOn: boolean;
  isBuilding: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ExportStats({
  stats,
  isPurgeOn,
  isDedupOn,
  isBuilding,
}: ExportStatsProps) {
  if (isBuilding) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 animate-pulse">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping inline-block" />
        Building production bundle…
      </div>
    );
  }

  if (!stats) return null;

  const totalBytes =
    stats.htmlBytes +
    stats.cssBytes +
    stats.jsBytes +
    (stats.assetsBytes || 0);
  const totalRules = stats.cssRulesKept + stats.cssRulesRemoved;
  const purgePercent =
    totalRules > 0 ? Math.round((stats.cssRulesRemoved / totalRules) * 100) : 0;

  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
      {/* Файлы */}
      {(
        [
          { label: "HTML", bytes: stats.htmlBytes, lines: stats.htmlLines, color: "text-orange-300" },
          { label: "CSS",  bytes: stats.cssBytes,  lines: stats.cssLines,  color: "text-sky-300"    },
          { label: "JS",   bytes: stats.jsBytes,   lines: stats.jsLines,   color: "text-amber-300"  },
        ] as const
      ).map(({ label, bytes, lines, color }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-700/80"
        >
          <span className="text-zinc-500">{label}</span>
          <span className={`font-bold ${color}`}>{formatBytes(bytes)}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">{lines} lines</span>
        </div>
      ))}

      {/* Assets */}
      {Boolean(stats.assetsCount && stats.assetsCount > 0) && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-700/80">
          <span className="text-zinc-500">Assets</span>
          <span className="font-bold text-teal-300">
            {formatBytes(stats.assetsBytes || 0)}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">
            {stats.assetsCount} {stats.assetsCount === 1 ? "img" : "imgs"}
          </span>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-600/80">
        <span className="text-zinc-500">Total</span>
        <span className="text-emerald-300 font-bold">{formatBytes(totalBytes)}</span>
      </div>

      {/* Purge */}
      {isPurgeOn && totalRules > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/50">
          <span className="text-emerald-400 text-xs">✂</span>
          <span className="text-zinc-400">Purge:</span>
          <span className="text-emerald-300 font-bold">{stats.cssRulesKept} kept</span>
          <span className="text-zinc-600">/</span>
          <span className="text-red-400 font-bold">{stats.cssRulesRemoved} cut</span>
          {purgePercent > 0 && (
            <span className="text-emerald-400 font-bold">-{purgePercent}%</span>
          )}
        </div>
      )}

      {/* Dedup badge */}
      {isDedupOn && (
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-violet-950/50 border border-violet-700/50 text-violet-300">
          <span className="text-xs">⬡</span>
          <span>Dedup ON</span>
        </div>
      )}
    </div>
  );
}
