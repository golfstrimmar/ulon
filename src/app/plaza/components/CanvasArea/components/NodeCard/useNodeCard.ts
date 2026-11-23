"use client";

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

  const isClicked = useCanvasStore((s) => s.clickedKey === key);
  const isSelected = useCanvasStore((s) => s.selectedKeys.has(key));
  const isDragged = useCanvasStore((s) => s.draggedKeys.includes(key));
  const isCollapsed = useCanvasStore((s) => s.collapsedKeys.has(key));
  const isDrop = useCanvasStore((s) => s.dropTarget?.key === key);
  const dropPos = useCanvasStore((s) =>
    s.dropTarget?.key === key ? s.dropTarget.position : null,
  );
  const isHovered = useCanvasStore(
    (s) =>
      s.hoveredKey === key && s.clickedKey !== key && !s.selectedKeys.has(key),
  );
  const hasActiveDrag = useCanvasStore((s) => s.draggedKeys.length > 0);

  const isSplit = useCanvasStore((s) => s.isSplit);
  const isTemplateMode = useCanvasStore((s) => s.isTemplateMode);
  const isRightPaneNode = useCanvasStore((s) => s.rightKeys.has(key));
  const slotIdx = useCanvasStore((s) => s.templateSlotKeys.indexOf(key));
  const slotNumber = slotIdx !== -1 ? slotIdx + 1 : null;

  const children: HtmlNode[] = Array.isArray(node.children)
    ? node.children
    : [];
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

  const imgSrc = useMemo(() => {
    const tag = (node.tag || "").toLowerCase();
    if (tag === "img" && node.attributes?.src) {
      return node.attributes.src;
    }
    return null;
  }, [node]);

  const svgTargetNode = useMemo(() => {
    const tag = (node.tag || "").toLowerCase();
    if (tag === "svg") return node;

    if (Array.isArray(node.children)) {
      const svgChild = node.children.find(
        (c) => (c.tag || "").toLowerCase() === "svg",
      );
      if (svgChild) return svgChild;
    }

    return null;
  }, [node]);

  const { borderStyle, bgStyle, shadowStyle } = useMemo(() => {
    let border = DEPTH_BORDER[depthIdx];
    let bg = DEPTH_BG[depthIdx];
    let shadow = "0 1px 3px rgba(0, 0, 0, 0.4)";

    if (slotIdx === 0) {
      border = "#fbbf24";
      bg = "rgba(245, 158, 11, 0.25)";
      shadow = "0 0 16px rgba(251, 191, 36, 0.65)";
    } else if (slotNumber !== null) {
      border = "#f59e0b";
      bg = "rgba(245, 158, 11, 0.14)";
      shadow = "0 0 10px rgba(245, 158, 11, 0.35)";
    } else if (isDrop && dropPos === "donor") {
      border = "#f59e0b";
      bg = "rgba(245, 158, 11, 0.22)";
      shadow = "0 0 16px rgba(245, 158, 11, 0.55)";
    } else if (isDrop && dropPos === "self") {
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
    } else if (hasChildren && isCollapsed) {
      border = "#22d3ee";
      bg = "rgba(8, 145, 178, 0.28)";
      shadow =
        "0 0 14px rgba(34, 211, 238, 0.38), inset 0 2px 0 rgba(103, 232, 249, 0.85)";
    } else if (hasChildren) {
      border = "rgba(139, 92, 246, 0.78)";
      bg = "rgba(109, 40, 217, 0.16)";
      shadow =
        "inset 0 2px 0 rgba(167, 139, 250, 0.75), 0 2px 6px rgba(0, 0, 0, 0.45)";
    }

    return { borderStyle: border, bgStyle: bg, shadowStyle: shadow };
  }, [
    depthIdx,
    slotIdx,
    slotNumber,
    isDrop,
    dropPos,
    isClicked,
    isSelected,
    isHovered,
    hasActiveDrag,
    hasChildren,
    isCollapsed,
  ]);
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
    if (tagLower === "img") {
      return "bg-sky-950/80 border-sky-500/80 text-sky-200";
    }
    if (tagLower === "svg" || tagLower === "i") {
      return "bg-violet-950/80 border-violet-500/80 text-violet-200";
    }
    return "bg-zinc-800/80 border-zinc-600/80 text-zinc-200";
  }, [node.tag]);

  const hasClass = Boolean(node.class && node.class.trim());
  const classStr = hasClass
    ? "." + node.class!.trim().replace(/\s+/g, " .")
    : "";
  const hasText = Boolean(node.text && node.text.trim());

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      useCanvasStore.getState().setHoveredKey(key);
      window.dispatchEvent(
        new CustomEvent("plaza-node-hovered", { detail: key }),
      );
    },
    [key],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();

      const nextTarget =
        e.relatedTarget instanceof Element ? e.relatedTarget : null;
      const parentNode = nextTarget?.closest<HTMLElement>("[data-node-key]");
      const parentKey = parentNode?.getAttribute("data-node-key") || null;

      if (parentKey === key) return;

      useCanvasStore.getState().setHoveredKey(parentKey);
      window.dispatchEvent(
        new CustomEvent("plaza-node-hovered", { detail: parentKey }),
      );
    },
    [key],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        e.stopPropagation();
        const state = useCanvasStore.getState();
        // В Template-режиме и при выборе места маркера не запускаем drag при кликах по нодам
        if (state.isTemplateMode || state.isArmingMarker) {
          return;
        }
        state.startDragNode(key, e.clientX, e.clientY);
      }
    },
    [key],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasActiveDrag || !key) return;

      const state = useCanvasStore.getState();

      // 📍 Если активен режим расстановки маркера: ставим маркер без открытия модалки свойств
      if (state.isArmingMarker) {
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        void state.placeMarkerAtNode(key);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !state.isTemplateMode) {
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        state.setSelectedKeys((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        return;
      }
      if (state.isTemplateMode) {
        const isInRightPane =
          Boolean(
            (e.currentTarget as HTMLElement).closest("[data-pane='right']"),
          ) || state.rightKeys.has(key);

        if (isInRightPane) {
          state.toggleTemplateSlot(key);
          return;
        }

        if (state.templateSlotKeys.length > 0) {
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }
          void state.fillNextTemplateSlot(key);
          return;
        }
      }

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
      const state = useCanvasStore.getState();
      if (state.isTemplateMode) return;

      if (state.selectedKeys.has(key) && state.selectedKeys.size > 1) {
        void state.deleteSelectedNodes();
        return;
      }

      void state.deleteNode(key);
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
    isSplit,
    isDropDonor: isDrop && dropPos === "donor",
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
  };
}
