import { useMemo, useCallback, useRef, useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { isRowContainer } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import {
  DEPTH_BG,
  DEPTH_BORDER,
} from "@/app/plaza/components/CanvasArea/constants/theme";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

export interface UseNodeCardOptions {
  node: HtmlNode;
  depth: number;
}

export function useNodeCard({ node, depth }: UseNodeCardOptions) {
  const key = node._key || "";

  // ── Точечные селекторы-булеаны: рендер ТОЛЬКО для этой конкретной ноды ──
  const isClicked = useCanvasStore((s) => s.clickedKey === key);
  const isSelected = useCanvasStore((s) => s.selectedKeys.has(key));
  const isDragged = useCanvasStore((s) => s.draggedKeys.includes(key));
  const isCollapsed = useCanvasStore((s) => s.collapsedKeys.has(key));
  const isDrop = useCanvasStore((s) => s.dropTarget?.key === key);
  const dropPos = useCanvasStore((s) =>
    s.dropTarget?.key === key ? s.dropTarget.position : null,
  );
  const isHovered = useCanvasStore(
    (s) => s.hoveredKey === key && s.clickedKey !== key && !s.selectedKeys.has(key),
  );
  const hasActiveDrag = useCanvasStore((s) => s.draggedKeys.length > 0);

  const children: HtmlNode[] = Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;

  const depthIdx = Math.min(depth, DEPTH_BG.length - 1);
  const isRow = isRowContainer(node);

  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // ── Стили карточки ────────────────────────────────────────────────────────
  const { borderStyle, bgStyle, shadowStyle } = useMemo(() => {
    let border = DEPTH_BORDER[depthIdx];
    let bg = DEPTH_BG[depthIdx];
    let shadow = "0 1px 3px rgba(0, 0, 0, 0.4)";

    if (isDrop && dropPos === "self") {
      border = "#c084fc";
      bg = "rgba(168, 85, 247, 0.22)";
      shadow = "0 0 12px rgba(192, 132, 252, 0.4)";
    } else if (isDrop && dropPos === "inside") {
      border = "#38bdf8";
      bg = "rgba(56, 189, 248, 0.16)";
      shadow = "0 0 10px rgba(56, 189, 248, 0.4)";
    } else if (isClicked) {
      border = "#818cf8";
      bg = "rgba(99, 102, 241, 0.2)";
      shadow = "0 0 10px rgba(129, 140, 248, 0.35)";
    } else if (isSelected) {
      border = "#38bdf8";
      bg = "rgba(56, 189, 248, 0.18)";
      shadow = "0 0 10px rgba(56, 189, 248, 0.3)";
    } else if (isHovered && !hasActiveDrag) {
      border = "#34d399";
      bg = "rgba(52, 211, 153, 0.12)";
      shadow = "0 0 8px rgba(52, 211, 153, 0.25)";
    }

    return { borderStyle: border, bgStyle: bg, shadowStyle: shadow };
  }, [depthIdx, isDrop, dropPos, isClicked, isSelected, isHovered, hasActiveDrag]);

  // ── Бейдж тега ────────────────────────────────────────────────────────────
  const tagBadgeClass = useMemo(() => {
    const tagLower = (node.tag || "div").toLowerCase();
    if (tagLower === "div") {
      return "bg-indigo-950/80 border-indigo-500/80 text-indigo-200";
    }
    if (tagLower === "p") {
      return "bg-emerald-950/80 border-emerald-500/80 text-emerald-200";
    }
    if (["section", "header", "footer"].includes(tagLower)) {
      return "bg-amber-950/80 border-amber-500/80 text-amber-200";
    }
    return "bg-zinc-800/80 border-zinc-600/80 text-zinc-200";
  }, [node.tag]);

  const hasClass = Boolean(node.class && node.class.trim());
  const classStr = hasClass
    ? "." + node.class!.trim().replace(/\s+/g, " .")
    : "";
  const hasText = Boolean(node.text && node.text.trim());

  // ── Обработчики действий ноды ─────────────────────────────────────────────
  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (isClicked) return;

      useCanvasStore.getState().setHoveredKey(key);
      window.dispatchEvent(
        new CustomEvent("plaza-node-hovered", { detail: key }),
      );
    },
    [isClicked, key],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();

      const nextTarget =
        e.relatedTarget instanceof Element ? e.relatedTarget : null;
      const parentNode = nextTarget?.closest<HTMLElement>("[data-node-key]");
      const parentKey = parentNode?.getAttribute("data-node-key") || null;

      const targetKey = parentKey === (isClicked ? key : null) ? null : parentKey;

      useCanvasStore.getState().setHoveredKey(targetKey);
      window.dispatchEvent(
        new CustomEvent("plaza-node-hovered", { detail: targetKey }),
      );
    },
    [isClicked, key],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        e.stopPropagation();
        useCanvasStore.getState().startDragNode(key, e.clientX, e.clientY);
      }
    },
    [key],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasActiveDrag) return;
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        useCanvasStore.getState().setClickedKey(key);
        clickTimeoutRef.current = null;
      }, 300);
    },
    [hasActiveDrag, key],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      useCanvasStore.getState().deleteNode(key);
    },
    [key],
  );

  const handleToggleCollapseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      useCanvasStore.getState().toggleCollapseKey(key);
    },
    [key],
  );

  return {
    key,
    children,
    hasChildren,
    isCollapsed,
    isRow,
    isDragged,
    isSelected,
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
  };
}
