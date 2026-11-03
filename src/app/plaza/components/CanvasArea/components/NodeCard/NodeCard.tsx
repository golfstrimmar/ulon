import React, { memo } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { DropGap } from "@/app/plaza/components/CanvasArea/components/DropGap";
import type { NodeCardProps } from "./nodeCard.types";
import { useNodeCard } from "./useNodeCard";

/**
 * 🔹 Рекурсивный рендерер миниатюрного SVG дерева (для path, circle, rect и т.д.)
 */
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

/**
 * 🔹 Мини-превью для SVG
 */
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

function NodeCardComponent({
  node,
  depth,
  parentIsRow = false,
}: NodeCardProps) {
  const {
    key,
    children,
    hasChildren,
    isCollapsed,
    isRow,
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
    tagBadgeClass,
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

  return (
    <div
      data-node-key={key}
      data-is-row={parentIsRow ? "true" : "false"}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`relative rounded-md select-none border transition-all box-border min-h-[30px] flex flex-col active:cursor-grabbing ${
        isDragged ? "opacity-35 border-dashed" : "opacity-100"
      } ${parentIsRow ? "flex-1 min-w-[120px]" : "w-full"}`}
      style={{
        backgroundColor: bgStyle,
        borderColor: borderStyle,
        boxShadow: shadowStyle,
      }}
    >
      {/* Visual cue for Donor drop */}
      {isDropDonor && (
        <div className="absolute inset-0 z-30 pointer-events-none rounded-md border-2 border-amber-400 bg-amber-500/15 flex items-center justify-center backdrop-blur-[1px]">
          <span className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono font-bold text-[11px] shadow-lg flex items-center gap-1.5 animate-pulse">
            <span className="text-xs">⤓</span> Accept donor properties
          </span>
        </div>
      )}

      {/* Card Header */}
      <div
        data-node-header="true"
        className="h-[28px] px-2 flex items-center justify-between gap-1 rounded-t-md border-b border-zinc-800/60 shrink-0"
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {/* Template Slot Badge [1], [2]... */}
          {slotNumber !== null && (
            <span
              title={`Template Slot #${slotNumber}`}
              className="size-4 rounded-full bg-amber-500 text-zinc-950 font-mono font-black text-[11px] flex items-center justify-center shrink-0 shadow-md ring-2 ring-amber-400/50 animate-in fade-in zoom-in-75 duration-150"
            >
              {slotNumber}
            </span>
          )}

          {/* Template mode hint for unslotted right nodes */}
          {slotNumber === null && isTemplateMode && isRightPaneNode && (
            <span
              title="Click to assign slot number"
              className="size-4 rounded-full border border-dashed border-amber-500/50 text-amber-400/60 font-mono text-[9px] flex items-center justify-center shrink-0 hover:bg-amber-500/20 hover:text-amber-300 transition"
            >
              +
            </span>
          )}

          {/* Marquee Selection Indicator */}
          {isSelected && (
            <span className="w-3.5 h-3.5 rounded-sm bg-sky-500/30 border border-sky-400 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-sky-300">
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

          {hasChildren && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleToggleCollapseClick}
              className="w-4 h-4 rounded bg-zinc-900/90 border border-zinc-700 hover:border-zinc-500 text-cyan-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition"
            >
              {isCollapsed ? "+" : "−"}
            </button>
          )}

          {/* Tag badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[12px] tracking-tight border shrink-0 leading-none ${tagBadgeClass}`}
          >
            {node.tag || "div"}
          </span>

          {/* 🖼️ МИНИ-ПРЕВЬЮ ДЛЯ <img> */}
          {imgSrc && (
            <div
              title={`Image source: ${imgSrc.substring(0, 60)}...`}
              className="size-5 rounded border border-zinc-700/80 bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt=""
                className="max-w-full max-h-full object-contain pointer-events-none"
              />
            </div>
          )}

          {/* ⚡ МИНИ-ПРЕВЬЮ ДЛЯ <svg> */}
          {svgTargetNode && (
            <div
              title="SVG Vector preview"
              className="size-5 rounded border border-zinc-700/80 bg-zinc-950/90 p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
            >
              <MiniSvgPreview node={svgTargetNode} />
            </div>
          )}

          {hasClass && (
            <span
              className="text-[12px] font-mono text-green-300 leading-none"
              title={classStr}
            >
              {classStr}
            </span>
          )}

          {hasText && (
            <span
              className="text-[11px] text-zinc-200 truncate max-w-[180px] font-sans leading-none"
              title={node.text}
            >
              &quot;{node.text}&quot;
            </span>
          )}
        </div>
      </div>

      {/* Children Nodes (Recursive) */}
      {hasChildren && !isCollapsed && (
        <div
          className={`pl-2 w-full flex-1 relative ${
            isRow
              ? "flex flex-row flex-nowrap items-stretch gap-1 overflow-x-auto pb-2"
              : "flex flex-col gap-1 px-1 border-l border-zinc-700/60"
          }`}
        >
          {children.map((child: HtmlNode, idx: number) => (
            <React.Fragment key={child._key || idx}>
              {idx === 0 && (
                <DropGap
                  targetKey={child._key || ""}
                  position="before"
                  orientation={isRow ? "vertical" : "horizontal"}
                />
              )}
              <NodeCard node={child} depth={depth + 1} parentIsRow={isRow} />
              <DropGap
                targetKey={child._key || ""}
                position="after"
                orientation={isRow ? "vertical" : "horizontal"}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export const NodeCard = memo(NodeCardComponent);
export default NodeCard;
