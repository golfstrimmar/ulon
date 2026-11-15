"use client";

import React, { memo } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { DropGap } from "@/app/plaza/components/CanvasArea/components/DropGap";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import type { NodeCardProps } from "./nodeCard.types";
import { useNodeCard } from "./useNodeCard";

function MiniSvgChild({ node }: { node: HtmlNode }) {
  const Tag = (node.tag || "path").toLowerCase() as any;
  const attrs = node.attributes || {};
  const { class: _cls, style: _stl, ...validAttrs } = attrs;

  return (
    <Tag {...validAttrs}>
      {Array.isArray(node.children) &&
        node.children.map((child, idx) => (
          <MiniSvgChild key={child._key || idx} node={child} />
        ))}
    </Tag>
  );
}

function MiniSvgPreview({ node }: { node: HtmlNode }) {
  const attrs = node.attributes || {};
  const viewBox = attrs.viewBox || attrs.viewbox || "0 0 24 24";

  return (
    <svg
      viewBox={viewBox}
      className="w-full h-full text-zinc-300 pointer-events-none"
      fill={attrs.fill || "currentColor"}
      stroke={attrs.stroke || "none"}
    >
      {Array.isArray(node.children) &&
        node.children.map((child, idx) => (
          <MiniSvgChild key={child._key || idx} node={child} />
        ))}
    </svg>
  );
}

function getPastelTagTheme(rawTag?: string): {
  dot: string;
  badge: string;
} {
  const tag = (rawTag || "").trim().toLowerCase();

  if (
    ["section", "header", "footer", "main", "article", "aside", "nav"].includes(
      tag,
    )
  ) {
    return {
      dot: "bg-amber-200/85 border-amber-100/50",
      badge: "bg-amber-200/10 border-amber-200/35 text-amber-200/90",
    };
  }
  if (tag === "div") {
    return {
      dot: "bg-indigo-200/85 border-indigo-100/50",
      badge: "bg-indigo-200/10 border-indigo-200/35 text-indigo-200/90",
    };
  }
  if (tag === "ul" || tag === "ol" || tag === "li") {
    return {
      dot: "bg-teal-200/85 border-teal-100/50",
      badge: "bg-teal-200/10 border-teal-200/35 text-teal-200/90",
    };
  }
  if (/^h[1-6]$/.test(tag)) {
    return {
      dot: "bg-rose-200/85 border-rose-100/50",
      badge: "bg-rose-200/10 border-rose-200/35 text-rose-200/90",
    };
  }
  if (tag === "p") {
    return {
      dot: "bg-emerald-200/85 border-emerald-100/50",
      badge: "bg-emerald-200/10 border-emerald-200/35 text-emerald-200/90",
    };
  }
  if (["span", "strong", "em", "b", "small"].includes(tag)) {
    return {
      dot: "bg-yellow-200/80 border-yellow-100/50",
      badge: "bg-yellow-200/10 border-yellow-200/35 text-yellow-200/90",
    };
  }
  if (tag === "a") {
    return {
      dot: "bg-sky-200/85 border-sky-100/50",
      badge: "bg-sky-200/10 border-sky-200/35 text-sky-200/90",
    };
  }
  if (tag === "button") {
    return {
      dot: "bg-purple-200/85 border-purple-100/50",
      badge: "bg-purple-200/10 border-purple-200/35 text-purple-200/90",
    };
  }
  if (tag === "img" || tag === "picture" || tag === "video") {
    return {
      dot: "bg-cyan-200/85 border-cyan-100/50",
      badge: "bg-cyan-200/10 border-cyan-200/35 text-cyan-200/90",
    };
  }
  if (tag === "i" || tag === "svg" || tag === "path") {
    return {
      dot: "bg-fuchsia-200/80 border-fuchsia-100/50",
      badge: "bg-fuchsia-200/10 border-fuchsia-200/35 text-fuchsia-200/90",
    };
  }
  if (["form", "input", "textarea", "select", "label"].includes(tag)) {
    return {
      dot: "bg-orange-200/85 border-orange-100/50",
      badge: "bg-orange-200/10 border-orange-200/35 text-orange-200/90",
    };
  }

  return {
    dot: "bg-zinc-300/80 border-zinc-200/40",
    badge: "bg-zinc-700/40 border-zinc-500/40 text-zinc-200",
  };
}

function NodeCardComponent({ node, depth, parentIsRow = true }: NodeCardProps) {
  const {
    key,
    children,
    hasChildren,
    isCollapsed,
    isDragged,
    isSelected,
    isDropDonor,
    isTemplateMode,
    isRightPaneNode,
    slotNumber,
    imgSrc,
    svgTargetNode,
    borderStyle,
    bgStyle,
    shadowStyle,
    hasClass,
    classStr,
    hasText,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerDown,
    handleClick,
    handleDoubleClick,
    handleToggleCollapseClick,
  } = useNodeCard({ node, depth });

  const isClicked = useCanvasStore((s) => s.clickedKey === key);
  const isHovered = useCanvasStore(
    (s) =>
      s.hoveredKey === key && s.clickedKey !== key && !s.selectedKeys.has(key),
  );
  const isDropInside = useCanvasStore(
    (s) => s.dropTarget?.key === key && s.dropTarget?.position === "inside",
  );
  const isFirstSlot = useCanvasStore((s) => s.templateSlotKeys[0] === key);

  const hasTag = Boolean(node.tag && node.tag.trim());
  const pastelTheme = getPastelTagTheme(node.tag);

  let stateRing = "";
  if (isFirstSlot) {
    stateRing =
      "ring-2 ring-amber-300/90 shadow-[0_0_8px_rgba(252,211,77,0.75)]";
  } else if (slotNumber !== null || isDropDonor) {
    stateRing = "ring-2 ring-amber-300/60";
  } else if (isDropInside) {
    stateRing = "ring-2 ring-sky-300/75";
  } else if (isClicked) {
    stateRing = "ring-2 ring-indigo-300/80";
  } else if (isSelected) {
    stateRing = "ring-2 ring-sky-300/70";
  } else if (isHovered) {
    stateRing = "ring-2 ring-emerald-300/60";
  }

  const tooltipText = [
    hasTag ? `<${node.tag}>` : "<empty>",
    hasClass ? classStr : "",
    hasText ? `"${node.text}"` : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  const classTokens = hasClass ? classStr.split(/\s+/).filter(Boolean) : [];

  return (
    <div
      className={`flex flex-col items-center shrink-0 transition-opacity ${
        isDragged ? "opacity-35" : "opacity-100"
      }`}
    >
      {/* Узел: 10px пастельная точка + плашка под ней */}
      <div
        data-node-key={key}
        data-node-header="true"
        data-is-row={parentIsRow ? "true" : "false"}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={tooltipText}
        className="relative flex flex-col items-center select-none cursor-pointer active:cursor-grabbing group"
      >
        {isDropDonor && (
          <div className="absolute -inset-1 z-30 pointer-events-none rounded-md border-2 border-amber-400 bg-amber-500/20 flex items-center justify-center">
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono font-bold text-[9px] shadow">
              ⤓ Donor
            </span>
          </div>
        )}

        <div
          className="mt-1 px-1.5 py-1 rounded border transition-all flex flex-col items-center gap-0.5 min-w-[46px]"
          style={{
            backgroundColor: bgStyle,
            borderColor: borderStyle,
            boxShadow: shadowStyle,
          }}
        >
          {/* Верхняя строка: галочка, тег, 16x16 превью, сворачивание */}
          <div className="flex items-center justify-center gap-1">
            {isSelected && (
              <span className="w-3 h-3 rounded-sm bg-sky-500/30 border border-sky-400 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 12 12" className="w-2 h-2 text-sky-300">
                  <path
                    d="M2.5 6l2.5 2.5 4.5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}

            <span
              className={`px-1 py-[1px] rounded text-[10px] font-mono tracking-tight border shrink-0 leading-none ${
                hasTag
                  ? pastelTheme.badge
                  : "border-dashed border-zinc-600 bg-zinc-900/90 text-zinc-400"
              }`}
            >
              {hasTag ? node.tag : "empty"}
            </span>

            {imgSrc && (
              <div className="size-4 rounded border border-zinc-700/80 bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt=""
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              </div>
            )}

            {svgTargetNode && (
              <div className="size-4 rounded border border-zinc-700/80 bg-zinc-950/90 p-[1px] flex items-center justify-center overflow-hidden shrink-0">
                <MiniSvgPreview node={svgTargetNode} />
              </div>
            )}

            {hasChildren && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleToggleCollapseClick}
                title={
                  isCollapsed
                    ? `Expand (${children.length})`
                    : `Collapse (${children.length})`
                }
                className="px-1 h-3.5 rounded bg-zinc-900/90 border border-zinc-700 hover:border-zinc-500 text-cyan-300 text-[9px] font-mono font-bold flex items-center justify-center shrink-0 transition leading-none"
              >
                {isCollapsed ? `+${children.length}` : "−"}
              </button>
            )}
          </div>

          {/* Полные названия классов без обрезки */}
          {classTokens.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
              {classTokens.map((cls, i) => (
                <span
                  key={`${cls}-${i}`}
                  className="text-[9px] font-mono text-emerald-200/90 whitespace-nowrap leading-tight"
                >
                  {cls}
                </span>
              ))}
            </div>
          )}

          {/* Подрезанный текст */}
          {hasText && (
            <span className="text-[9px] text-zinc-300 truncate max-w-[130px] leading-tight font-sans">
              &quot;{node.text}&quot;
            </span>
          )}
        </div>
      </div>

      {/* Ортогональные связи + горизонтальный ряд дочерних узлов */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center">
          {/* Вертикальный стебель от родителя вниз */}
          <div className="w-px h-3 bg-zinc-600/80 shrink-0" />

          <div className="flex flex-row flex-nowrap items-start">
            {children.map((child: HtmlNode, idx: number) => (
              <div
                key={child._key || idx}
                className="relative flex flex-col items-center pt-3 px-1.5"
              >
                {/* Горизонтальная перекладина над детьми */}
                {children.length > 1 && idx > 0 && (
                  <div className="pointer-events-none absolute top-0 left-0 right-1/2 h-px bg-zinc-600/80" />
                )}
                {children.length > 1 && idx < children.length - 1 && (
                  <div className="pointer-events-none absolute top-0 left-1/2 right-0 h-px bg-zinc-600/80" />
                )}

                {/* Вертикальная веточка в 10px точку ребёнка */}
                <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-3 w-px bg-zinc-600/80" />

                {/* Вертикальный DropGap слева (для первого) */}
                {idx === 0 && (
                  <div className="absolute -left-1 top-3 h-[42px] flex items-stretch z-20">
                    <DropGap
                      targetKey={child._key || ""}
                      position="before"
                      orientation="vertical"
                    />
                  </div>
                )}

                <NodeCard node={child} depth={depth + 1} parentIsRow={true} />

                {/* Вертикальный DropGap справа */}
                <div className="absolute -right-1 top-3 h-[42px] flex items-stretch z-20">
                  <DropGap
                    targetKey={child._key || ""}
                    position="after"
                    orientation="vertical"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const NodeCard = memo(NodeCardComponent);
export default NodeCard;
