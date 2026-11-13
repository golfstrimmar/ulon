"use client";

import React, { memo } from "react";

export interface BoxModelData {
  top: number;
  left: number;
  width: number;
  height: number;
  mt: number;
  mr: number;
  mb: number;
  ml: number;
  pt: number;
  pr: number;
  pb: number;
  pl: number;
  bt: number;
  br: number;
  bb: number;
  bl: number;
  tag: string;
  className: string;
  gap?: number;
}

interface BoxModelOverlayProps {
  data: BoxModelData | null;
}

export const BoxModelOverlay = memo(function BoxModelOverlay({
  data,
}: BoxModelOverlayProps) {
  if (!data) return null;
  const {
    top,
    left,
    width,
    height,
    mt,
    mr,
    mb,
    ml,
    pt,
    pr,
    pb,
    pl,
    bt,
    br,
    bb,
    bl,
    tag,
    className,
    gap = 0,
  } = data;

  const hasMargin = mt > 0 || mr > 0 || mb > 0 || ml > 0;
  const hasPadding = pt > 0 || pr > 0 || pb > 0 || pl > 0;

  const innerTop = top + bt;
  const innerLeft = left + bl;
  const innerW = Math.max(0, width - bl - br);
  const innerH = Math.max(0, height - bt - bb);

  const contentTop = innerTop + pt;
  const contentLeft = innerLeft + pl;
  const contentW = Math.max(0, innerW - pl - pr);
  const contentH = Math.max(0, innerH - pt - pb);

  // 🛡️ Безопасное получение строки классов (защита от SVGAnimatedString и null/undefined)
  const safeClassName =
    typeof className === "string"
      ? className
      : typeof (className as any)?.baseVal === "string"
        ? (className as any).baseVal
        : "";

  const classList = safeClassName
    .trim()
    .split(/\s+/)
    .map((c) => c.replace(/^\./, "").trim())
    .filter((c) => Boolean(c) && !c.startsWith("plaza-"))
    .slice(0, 2);
  const clsStr = classList.length > 0 ? "." + classList.join(".") : "";

  // Безопасное позиционирование тултипа сверху/снизу
  const tooltipTop =
    top - mt >= 32 ? top - mt - 28 : Math.max(6, top + height + mb + 6);
  const tooltipLeft = Math.max(6, left - ml);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-50 overflow-visible"
      style={{
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      {/* 1. 🟧 MARGIN (ВНЕШНИЕ ОТСТУПЫ) - Персиковый цвет DevTools */}
      {hasMargin && (
        <>
          {/* Top Margin */}
          {mt > 0 && (
            <div
              style={{
                position: "absolute",
                top: top - mt,
                left: left - ml,
                width: width + ml + mr,
                height: mt,
                backgroundColor: "rgba(246, 178, 107, 0.68)",
                borderTop: "1px dashed rgba(230, 145, 56, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {mt >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-amber-300 px-1 rounded-sm leading-none shadow-sm">
                  {Math.round(mt)}
                </span>
              )}
            </div>
          )}

          {/* Bottom Margin */}
          {mb > 0 && (
            <div
              style={{
                position: "absolute",
                top: top + height,
                left: left - ml,
                width: width + ml + mr,
                height: mb,
                backgroundColor: "rgba(246, 178, 107, 0.68)",
                borderBottom: "1px dashed rgba(230, 145, 56, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {mb >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-amber-300 px-1 rounded-sm leading-none shadow-sm">
                  {Math.round(mb)}
                </span>
              )}
            </div>
          )}

          {/* Left Margin */}
          {ml > 0 && (
            <div
              style={{
                position: "absolute",
                top,
                left: left - ml,
                width: ml,
                height,
                backgroundColor: "rgba(246, 178, 107, 0.68)",
                borderLeft: "1px dashed rgba(230, 145, 56, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {ml >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-amber-300 px-0.5 rounded-sm leading-none shadow-sm">
                  {Math.round(ml)}
                </span>
              )}
            </div>
          )}

          {/* Right Margin */}
          {mr > 0 && (
            <div
              style={{
                position: "absolute",
                top,
                left: left + width,
                width: mr,
                height,
                backgroundColor: "rgba(246, 178, 107, 0.68)",
                borderRight: "1px dashed rgba(230, 145, 56, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {mr >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-amber-300 px-0.5 rounded-sm leading-none shadow-sm">
                  {Math.round(mr)}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* 2. 🟩 ЗЕЛЕНАЯ ПУНКТИРНАЯ РАМКА ЭЛЕМЕНТА */}
      <div
        style={{
          position: "absolute",
          top,
          left,
          width,
          height,
          boxSizing: "border-box",
          border: "2px dashed rgba(52, 211, 153, 0.95)",
          boxShadow: "0 0 0 2px rgba(52, 211, 153, 0.35)",
        }}
      />

      {/* 3. 🟩 PADDING (ВНУТРЕННИЕ ОТСТУПЫ) - Салатовый цвет DevTools */}
      {hasPadding && (
        <>
          {/* Top Padding */}
          {pt > 0 && (
            <div
              style={{
                position: "absolute",
                top: innerTop,
                left: innerLeft,
                width: innerW,
                height: pt,
                backgroundColor: "rgba(147, 196, 125, 0.68)",
                borderBottom: "1px dashed rgba(106, 168, 79, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {pt >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-emerald-300 px-1 rounded-sm leading-none shadow-sm">
                  {Math.round(pt)}
                </span>
              )}
            </div>
          )}

          {/* Bottom Padding */}
          {pb > 0 && (
            <div
              style={{
                position: "absolute",
                top: innerTop + innerH - pb,
                left: innerLeft,
                width: innerW,
                height: pb,
                backgroundColor: "rgba(147, 196, 125, 0.68)",
                borderTop: "1px dashed rgba(106, 168, 79, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {pb >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-emerald-300 px-1 rounded-sm leading-none shadow-sm">
                  {Math.round(pb)}
                </span>
              )}
            </div>
          )}

          {/* Left Padding */}
          {pl > 0 && (
            <div
              style={{
                position: "absolute",
                top: innerTop + pt,
                left: innerLeft,
                width: pl,
                height: Math.max(0, innerH - pt - pb),
                backgroundColor: "rgba(147, 196, 125, 0.68)",
                borderRight: "1px dashed rgba(106, 168, 79, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {pl >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-emerald-300 px-0.5 rounded-sm leading-none shadow-sm">
                  {Math.round(pl)}
                </span>
              )}
            </div>
          )}

          {/* Right Padding */}
          {pr > 0 && (
            <div
              style={{
                position: "absolute",
                top: innerTop + pt,
                left: innerLeft + innerW - pr,
                width: pr,
                height: Math.max(0, innerH - pt - pb),
                backgroundColor: "rgba(147, 196, 125, 0.68)",
                borderLeft: "1px dashed rgba(106, 168, 79, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {pr >= 6 && (
                <span className="text-[9px] font-bold text-zinc-950 bg-emerald-300 px-0.5 rounded-sm leading-none shadow-sm">
                  {Math.round(pr)}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* 4. 🟦 CONTENT AREA (КОНТЕНТ) */}
      {contentW > 0 && contentH > 0 && (
        <div
          style={{
            position: "absolute",
            top: contentTop,
            left: contentLeft,
            width: contentW,
            height: contentH,
            boxSizing: "border-box",
            backgroundColor: "rgba(111, 168, 220, 0.35)",
          }}
        />
      )}

      {/* 5. 🏷️ БЕЙДЖ С ТОЧНЫМИ ОТСТУПАМИ (mt: 14, pt: 13...) */}
      <div
        style={{
          position: "absolute",
          top: tooltipTop,
          left: tooltipLeft,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(15, 23, 42, 0.96)",
          border: "1px solid rgba(71, 85, 105, 0.85)",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: 11,
          lineHeight: "1.2",
          whiteSpace: "nowrap",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.85)",
          zIndex: 60,
        }}
      >
        <span className="text-cyan-300 font-bold">&lt;{tag}&gt;</span>
        {clsStr && <span className="text-emerald-300 font-mono">{clsStr}</span>}
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-100 font-bold font-mono">
          {Math.round(width)}×{Math.round(height)}
        </span>

        {/* 🎯 ЯВНЫЙ ВЫВОД MARGIN (mt: 14 mb: 0...) */}
        {hasMargin && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/50"
            title="Margin: top right bottom left"
          >
            m: {mt ? `${Math.round(mt)}t ` : ""}
            {mr ? `${Math.round(mr)}r ` : ""}
            {mb ? `${Math.round(mb)}b ` : ""}
            {ml ? `${Math.round(ml)}l` : ""}
          </span>
        )}

        {/* 🎯 ЯВНЫЙ ВЫВОД PADDING (pt: 13 pb: 0...) */}
        {hasPadding && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
            title="Padding: top right bottom left"
          >
            p: {pt ? `${Math.round(pt)}t ` : ""}
            {pr ? `${Math.round(pr)}r ` : ""}
            {pb ? `${Math.round(pb)}b ` : ""}
            {pl ? `${Math.round(pl)}l` : ""}
          </span>
        )}

        {gap > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/50">
            gap: {gap}
          </span>
        )}
      </div>
    </div>
  );
});

export default BoxModelOverlay;
