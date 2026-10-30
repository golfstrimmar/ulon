import React from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { DropGap } from "@/app/plaza/components/CanvasArea/components/DropGap";
import { isRowContainer } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import {
  DEPTH_BG,
  DEPTH_BORDER,
} from "@/app/plaza/components/CanvasArea/constants/theme";

interface NodeCardProps {
  node: HtmlNode;
  depth: number;
  parentIsRow?: boolean;
  draggedKey: string | null;
  dropTarget: DropTarget | null;
  collapsedKeys: Set<string>;
  clickedKey: string | null;
  hoveredKey: string | null;
  onPointerDownNode: (e: React.PointerEvent, key: string) => void;
  onClickNode: (key: string) => void;
  onDoubleClickNode: (key: string) => void;
  onToggleCollapse: (key: string) => void;
  onHoverNode: (key: string | null) => void;
}

export interface DropTarget {
  key: string;
  position: "self" | "before" | "after" | "inside";
}

export function NodeCard({
  node,
  depth,
  parentIsRow = false,
  draggedKey,
  dropTarget,
  collapsedKeys,
  clickedKey,
  hoveredKey,
  onPointerDownNode,
  onClickNode,
  onDoubleClickNode,
  onToggleCollapse,
  onHoverNode,
}: NodeCardProps) {
  const key = node._key || "";
  const children = Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const isCollapsed = collapsedKeys.has(key);

  const isDragged = draggedKey === key;
  const isClicked = clickedKey === key;
  // Ховер работает только если нода НЕ активна в данный момент
  const isHovered = hoveredKey === key && !isClicked;
  const isDrop = dropTarget?.key === key;
  const dropPos = isDrop ? dropTarget?.position : null;

  const depthIdx = Math.min(depth, DEPTH_BG.length - 1);
  const isRow = isRowContainer(node);

  let borderStyle = DEPTH_BORDER[depthIdx];
  let bgStyle = DEPTH_BG[depthIdx];
  let shadowStyle = `0 1px 3px rgba(0, 0, 0, 0.4)`;

  if (isDrop && dropPos === "self") {
    borderStyle = "#c084fc";
    bgStyle = "rgba(168, 85, 247, 0.22)";
    shadowStyle = "0 0 12px rgba(192, 132, 252, 0.4)";
  } else if (isDrop && dropPos === "inside") {
    borderStyle = "#38bdf8";
    bgStyle = "rgba(56, 189, 248, 0.16)";
    shadowStyle = "0 0 10px rgba(56, 189, 248, 0.4)";
  } else if (isClicked) {
    // Активная нода (Красный акцент под цвет в PreviewArea или индиго)
    borderStyle = "#818cf8";
    bgStyle = "rgba(99, 102, 241, 0.2)";
    shadowStyle = "0 0 10px rgba(129, 140, 248, 0.35)";
  } else if (isHovered && !draggedKey) {
    // 🔹 Зеленоватый цвет при ховере
    borderStyle = "#34d399";
    bgStyle = "rgba(52, 211, 153, 0.12)";
    shadowStyle = "0 0 8px rgba(52, 211, 153, 0.25)";
  }

  const tagLower = (node.tag || "div").toLowerCase();
  let tagBadgeClass = "bg-zinc-800/80 border-zinc-600/80 text-zinc-200";
  if (tagLower === "div") {
    tagBadgeClass = "bg-indigo-950/80 border-indigo-500/80 text-indigo-200";
  } else if (tagLower === "p") {
    tagBadgeClass = "bg-emerald-950/80 border-emerald-500/80 text-emerald-200";
  } else if (["section", "header", "footer"].includes(tagLower)) {
    tagBadgeClass = "bg-amber-950/80 border-amber-500/80 text-amber-200";
  }

  const hasClass = Boolean(node.class && node.class.trim());
  const classStr = hasClass
    ? "." + node.class!.trim().replace(/\s+/g, " .")
    : "";
  const hasText = Boolean(node.text && node.text.trim());

  return (
    <div
      data-node-key={key}
      data-is-row={parentIsRow ? "true" : "false"}
      onPointerEnter={(e) => {
        e.stopPropagation();

        // ⚠️ На активной ноде ховер не нужен
        if (isClicked) return;

        onHoverNode(key);
        window.dispatchEvent(
          new CustomEvent("plaza-node-hovered", {
            detail: key,
          }),
        );
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();

        // Проверяем, куда ушел курсор: если в родительскую ноду — подсвечиваем её,
        // если в пустое место — сбрасываем в null
        const nextTarget =
          e.relatedTarget instanceof Element ? e.relatedTarget : null;
        const parentNode = nextTarget?.closest<HTMLElement>("[data-node-key]");
        const parentKey = parentNode?.getAttribute("data-node-key") || null;

        // Если родитель оказался активной нодой, то ховер на нём тоже не включаем
        const targetKey = parentKey === clickedKey ? null : parentKey;

        onHoverNode(targetKey);
        window.dispatchEvent(
          new CustomEvent("plaza-node-hovered", {
            detail: targetKey,
          }),
        );
      }}
      onPointerDown={(e) => {
        if (e.button === 0) {
          e.stopPropagation();
          onPointerDownNode(e, key);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClickNode(key);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClickNode(key);
      }}
      className={`relative rounded-md select-none border transition-all box-border min-h-[30px] flex flex-col active:cursor-grabbing ${
        isDragged ? "opacity-35 border-dashed" : "opacity-100"
      } ${parentIsRow ? "flex-1 min-w-[120px]" : "w-full"}`}
      style={{
        backgroundColor: bgStyle,
        borderColor: borderStyle,
        boxShadow: shadowStyle,
      }}
    >
      <div className="h-[28px] px-2 flex items-center justify-between gap-1 rounded-t-md border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {hasChildren && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(key);
              }}
              className="w-4 h-4 rounded bg-zinc-900/90 border border-zinc-700 hover:border-zinc-500 text-cyan-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 transition"
            >
              {isCollapsed ? "+" : "−"}
            </button>
          )}

          <span
            className={`px-1.5 py-0.5 rounded text-[12px] tracking-tight border shrink-0 leading-none ${tagBadgeClass}`}
          >
            {node.tag || "div"}
          </span>

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
                  draggedKey={draggedKey}
                  dropTarget={dropTarget}
                />
              )}
              <NodeCard
                node={child}
                depth={depth + 1}
                parentIsRow={isRow}
                draggedKey={draggedKey}
                dropTarget={dropTarget}
                collapsedKeys={collapsedKeys}
                clickedKey={clickedKey}
                hoveredKey={hoveredKey}
                onPointerDownNode={onPointerDownNode}
                onClickNode={onClickNode}
                onDoubleClickNode={onDoubleClickNode}
                onToggleCollapse={onToggleCollapse}
                onHoverNode={onHoverNode}
              />
              <DropGap
                targetKey={child._key || ""}
                position="after"
                orientation={isRow ? "vertical" : "horizontal"}
                draggedKey={draggedKey}
                dropTarget={dropTarget}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
