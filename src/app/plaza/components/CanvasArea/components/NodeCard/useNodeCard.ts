import { useMemo, useCallback, useRef, useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { isRowContainer } from "@/app/plaza/components/CanvasArea/models/canvasModel";
import {
  DEPTH_BG,
  DEPTH_BORDER,
} from "@/app/plaza/components/CanvasArea/constants/theme";
import { useCanvasTreeContext } from "@/app/plaza/components/CanvasArea/context/CanvasTreeContext";

export interface UseNodeCardOptions {
  node: HtmlNode;
  depth: number;
}

export function useNodeCard({ node, depth }: UseNodeCardOptions) {
  const {
    clickedKey,
    setClickedKey,
    hoveredKey,
    setHoveredKey,
    collapsedKeys,
    toggleCollapseKey,
    deleteNode,
    startDrag,
    draggedKey,
    dropTarget,
    hasDraggedRef,
  } = useCanvasTreeContext();

  const key = node._key || "";
  const children: HtmlNode[] = Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const isCollapsed = collapsedKeys.has(key);

  const isDragged = draggedKey === key;
  const isClicked = clickedKey === key;
  const isHovered = hoveredKey === key && !isClicked;
  const isDrop = dropTarget?.key === key;
  const dropPos = isDrop ? dropTarget?.position : null;

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
    } else if (isHovered && !draggedKey) {
      border = "#34d399";
      bg = "rgba(52, 211, 153, 0.12)";
      shadow = "0 0 8px rgba(52, 211, 153, 0.25)";
    }

    return { borderStyle: border, bgStyle: bg, shadowStyle: shadow };
  }, [depthIdx, isDrop, dropPos, isClicked, isHovered, draggedKey]);

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

      setHoveredKey(key);
      window.dispatchEvent(
        new CustomEvent("plaza-node-hovered", { detail: key }),
      );
    },
    [isClicked, setHoveredKey, key],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();

      const nextTarget =
        e.relatedTarget instanceof Element ? e.relatedTarget : null;
      const parentNode = nextTarget?.closest<HTMLElement>("[data-node-key]");
      const parentKey = parentNode?.getAttribute("data-node-key") || null;

      const targetKey = parentKey === clickedKey ? null : parentKey;

      setHoveredKey(targetKey);
      window.dispatchEvent(
        new CustomEvent("plaza-node-hovered", { detail: targetKey }),
      );
    },
    [clickedKey, setHoveredKey],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        e.stopPropagation();
        startDrag(e, key);
      }
    },
    [startDrag, key],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasDraggedRef.current) {
        hasDraggedRef.current = false;
        return;
      }
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        setClickedKey(key);
        clickTimeoutRef.current = null;
      }, 300);
    },
    [hasDraggedRef, setClickedKey, key],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      deleteNode(key);
    },
    [deleteNode, key],
  );

  const handleToggleCollapseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleCollapseKey(key);
    },
    [toggleCollapseKey, key],
  );

  return {
    key,
    children,
    hasChildren,
    isCollapsed,
    isRow,
    isDragged,
    draggedKey,
    dropTarget,
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
