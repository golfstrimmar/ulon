"use client";

import React, { memo } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { DropGap } from "@/app/plaza/components/CanvasArea/components/DropGap";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import { isMarkerNode } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import type { NodeCardProps } from "./nodeCard.types";
import { useNodeCard } from "@/app/plaza/components/CanvasArea/components/NodeCard/useNodeCard";

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

function NodeCardComponent({ node, depth, parentIsRow = true, showBeforeGap = false, showAfterGap = false }: NodeCardProps) {
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

  const isMarker = isMarkerNode(node);
  const isArmingMarker = useCanvasStore((s) => s.isArmingMarker);

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
  if (isArmingMarker && isHovered) {
    stateRing =
      "outline outline-2 outline-rose-400 outline-offset-1 shadow-[0_0_12px_rgba(244,63,94,0.6)]";
  } else if (isTemplateMode && isFirstSlot) {
    stateRing = "outline outline-2 outline-amber-300/95 outline-offset-1";
  } else if ((isTemplateMode && slotNumber !== null) || isDropDonor) {
    stateRing = "outline outline-2 outline-amber-400/70 outline-offset-1";
  } else if (isDropInside) {
    stateRing = "outline outline-2 outline-sky-300/75 outline-offset-1";
  } else if (isClicked) {
    stateRing = "outline outline-2 outline-indigo-300/80 outline-offset-1";
  } else if (isSelected) {
    stateRing = "outline outline-2 outline-sky-300/70 outline-offset-1";
  } else if (isHovered) {
    stateRing = "outline outline-2 outline-emerald-300/60 outline-offset-1";
  } else if (hasChildren && isCollapsed) {
    stateRing = "outline outline-1 outline-cyan-400/75 outline-offset-1";
  }

  const tooltipText = isArmingMarker
    ? "Кликните, чтобы поставить маркер после этой ноды"
    : isMarker
      ? "Маркер вставки: перетащи в нужное место и нажми любую кнопку в AsideCanvas (двойной клик удаляет)"
      : [
          isTemplateMode && slotNumber !== null ? `[Slot #${slotNumber}]` : "",
          hasTag ? `<${node.tag}>` : "<empty>",
          hasClass ? classStr : "",
          hasText ? `"${node.text}"` : "",
        ]
          .filter(Boolean)
          .join("  |  ");

  const classTokens = hasClass ? classStr.split(/\s+/).filter(Boolean) : [];

  return (
    <div
      className={`flex flex-col items-start shrink-0 transition-opacity ${
        isDragged ? "opacity-35" : "opacity-100"
      }`}
    >
      {/* Узел: плашка, строго слева от поддерева */}
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
        className={`relative flex flex-col items-start select-none group ${
          isArmingMarker
            ? "cursor-crosshair"
            : isTemplateMode
              ? "cursor-pointer"
              : "cursor-pointer active:cursor-grabbing"
        }`}
      >
        {isArmingMarker && isHovered && (
          <div className="pointer-events-none absolute -top-3.5 -right-2 z-30 px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[9px] font-bold shadow-lg flex items-center gap-1 animate-bounce">
            <span>📍</span>
            <span>Сюда</span>
          </div>
        )}
        {showBeforeGap && (
          <div className="absolute -left-3.5 top-1 bottom-1 w-3 flex items-center justify-center z-20 pointer-events-auto">
            <DropGap targetKey={key} position="before" orientation="vertical" />
          </div>
        )}
        {showAfterGap && (
          <div className="absolute -right-3.5 top-1 bottom-1 w-3 flex items-center justify-center z-20 pointer-events-auto">
            <DropGap targetKey={key} position="after" orientation="vertical" />
          </div>
        )}
        {isDropDonor && (
          <div className="absolute -inset-1 z-30 pointer-events-none rounded-md border-2 border-amber-400 bg-amber-500/20 flex items-center justify-center">
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono font-bold text-[9px] shadow">
              ⤓ Donor
            </span>
          </div>
        )}

        {isMarker ? (
          <div
            className={`relative mt-1 px-2 py-1.5 rounded border-2 border-dashed border-rose-400 bg-rose-950/55 shadow-[0_0_14px_rgba(251,113,133,0.45)] animate-pulse flex items-center gap-1.5 min-w-[82px] ${stateRing}`}
          >
            <span className="text-[11px] leading-none">📍</span>
            <span className="text-[10px] font-mono font-bold text-rose-200 tracking-wide whitespace-nowrap leading-none">
              MARKER
            </span>
          </div>
        ) : (
          <div
            className={`relative mt-1 px-1.5 py-1 rounded border ${
              hasChildren ? "border-l-[3px]" : ""
            } transition-all flex flex-col items-center gap-0.5 min-w-[46px] ${stateRing}`}
            style={{
              backgroundColor: bgStyle,
              borderColor: borderStyle,
              boxShadow: shadowStyle,
            }}
          >
            {/* Номерок очерёдности слота в режиме Template */}
            {isTemplateMode && slotNumber !== null && (
              <span
                className={`pointer-events-none absolute -top-2 -right-1.5 z-30 min-w-[18px] h-[18px] px-1 rounded-full border font-mono text-[10px] font-bold flex items-center justify-center leading-none transition-all ${
                  isFirstSlot
                    ? "bg-amber-300 text-zinc-950 border-amber-100 shadow-[0_0_12px_rgba(252,211,77,0.95)] scale-110"
                    : "bg-amber-500 text-zinc-950 border-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.75)]"
                }`}
              >
                {slotNumber}
              </span>
            )}

            {/* Подсказка при наведении на неназначенную ноду в правой панели */}
            {isTemplateMode && isRightPaneNode && slotNumber === null && (
              <span className="pointer-events-none absolute -top-2 -right-1.5 z-30 w-4 h-4 rounded-full border border-dashed border-amber-400/60 bg-zinc-900/90 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                +
              </span>
            )}

            {/* Верхняя строка: галочка, тег, превью, сворачивание */}
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
                <div className="w-20 h-10 rounded border border-zinc-700/80 bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt=""
                    className="max-w-full max-h-full object-contain pointer-events-none"
                  />
                </div>
              )}

              {svgTargetNode && (
                <div className="size-6 rounded border border-zinc-700/80 bg-zinc-950/90 p-[1px] flex items-center justify-center overflow-hidden shrink-0">
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
                  className={`px-2 h-6 cursor-pointer rounded border text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition leading-none ${
                    isCollapsed
                      ? "bg-cyan-400 text-zinc-950 border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.65)] hover:bg-cyan-300"
                      : "bg-violet-950/90 border-violet-500/60 hover:border-violet-400 text-violet-200"
                  }`}
                >
                  {isCollapsed ? `+${children.length}` : "−"}
                </button>
              )}
            </div>

            {/* Полные названия классов без обрезки */}
            {classTokens.length > 0 && (
              <div className="flex flex-col items-center gap-y-0.5">
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
        )}
      </div>

      {/* Ортогональные связи + сдвинутый вправо горизонтальный ряд дочерних узлов */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-start">
          <div className="ml-4 w-px h-3 bg-zinc-600/80 shrink-0" />

          <div className="flex flex-row flex-nowrap items-start pl-5">
            {children.map((child: HtmlNode, idx: number) => {
              const isFirst = idx === 0;
              const isLast = idx === children.length - 1;
              const isSingle = children.length === 1;

              return (
                <div
                  key={child._key || idx}
                  className="relative flex flex-col items-start pt-3 px-1.5"
                >
                  {isSingle && (
                    <div className="pointer-events-none absolute top-0 left-[-4px] w-[27px] h-px bg-zinc-600/80" />
                  )}
                  {!isSingle && isFirst && (
                    <div className="pointer-events-none absolute top-0 left-[-4px] right-0 h-px bg-zinc-600/80" />
                  )}
                  {!isSingle && !isFirst && !isLast && (
                    <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-zinc-600/80" />
                  )}
                  {!isSingle && isLast && (
                    <div className="pointer-events-none absolute top-0 left-0 w-[23px] h-px bg-zinc-600/80" />
                  )}

                  <div className="pointer-events-none absolute top-0 left-[22px] h-3 w-px bg-zinc-600/80" />

                  <NodeCard
                    node={child}
                    depth={depth + 1}
                    parentIsRow={true}
                    showBeforeGap={true}
                    showAfterGap={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const NodeCard = memo(NodeCardComponent);
export default NodeCard;
