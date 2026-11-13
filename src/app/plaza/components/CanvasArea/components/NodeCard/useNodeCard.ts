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

/**
 * Пользовательский хук для управления состоянием, визуальным представлением и поведением карточки узла (NodeCard) на холсте.
 *
 * Вычисляет динамические стили (цвета границы, фон, свечение, бейджи тегов),
 * распознаёт медиа-контент (картинки, SVG), а также предоставляет все необходимые
 * обработчики событий (клик, двойной клик, перетаскивание, ховер, сворачивание).
 */
export function useNodeCard({ node, depth }: UseNodeCardOptions) {
  const key = node._key || "";

  // Селекторы базового состояния узла
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

  // Селекторы режима шаблона
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

  // Очистка таймера клика при размонтировании компонента
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 🖼️ Определение адреса изображения для тега <img>
   */
  const imgSrc = useMemo(() => {
    const tag = (node.tag || "").toLowerCase();
    if (tag === "img" && node.attributes?.src) {
      return node.attributes.src;
    }
    return null;
  }, [node]);

  /**
   * ⚡ Определение целевого SVG-узла (сам узел или его прямой дочерний элемент)
   */
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

  /**
   * Динамическое вычисление стилей рамки, фона и тени в зависимости от приоритета состояний:
   * слот шаблона > цель сброса (drop target) > кликнут > выбран > наведение курсора.
   */
  const { borderStyle, bgStyle, shadowStyle } = useMemo(() => {
    let border = DEPTH_BORDER[depthIdx];
    let bg = DEPTH_BG[depthIdx];
    let shadow = "0 1px 3px rgba(0, 0, 0, 0.4)";

    if (slotNumber !== null) {
      border = "#f59e0b";
      bg = "rgba(245, 158, 11, 0.16)";
      shadow = "0 0 12px rgba(245, 158, 11, 0.4)";
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
    }

    return { borderStyle: border, bgStyle: bg, shadowStyle: shadow };
  }, [
    depthIdx,
    slotNumber,
    isDrop,
    dropPos,
    isClicked,
    isSelected,
    isHovered,
    hasActiveDrag,
  ]);

  /**
   * Подбор цветовой схемы бейджа тега в зависимости от типа HTML-элемента
   */
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

  /**
   * Обработчик наведения курсора: сохраняет ключ узла под ховером в хранилище и генерирует событие
   */
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

  /**
   * Обработчик ухода курсора: корректно передаёт ховер родительской карточке, если курсор остаётся над ней
   */
  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();

      const nextTarget =
        e.relatedTarget instanceof Element ? e.relatedTarget : null;
      const parentNode = nextTarget?.closest<HTMLElement>("[data-node-key]");
      const parentKey = parentNode?.getAttribute("data-node-key") || null;

      // Если мышь все еще внутри этой же карточки — не сбрасываем ховер
      if (parentKey === key) return;

      useCanvasStore.getState().setHoveredKey(parentKey);
      window.dispatchEvent(
        new CustomEvent("plaza-node-hovered", { detail: parentKey }),
      );
    },
    [key],
  );

  /**
   * Обработчик нажатия кнопки мыши: инициирует начало перетаскивания (Drag & Drop) левой кнопкой
   */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        e.stopPropagation();
        useCanvasStore.getState().startDragNode(key, e.clientX, e.clientY);
      }
    },
    [key],
  );

  /**
   * Обработчик одиночного клика:
   * - В режиме шаблона для правой панели переключает статус слота шаблона
   * - В стандартном режиме с небольшой задержкой (для отсеивания даблклика) отмечает узел как активный
   */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasActiveDrag) return;

      // В режиме шаблона клик по узлу правой панели переключает назначение слота
      if (isTemplateMode && isRightPaneNode) {
        useCanvasStore.getState().toggleTemplateSlot(key);
        return;
      }

      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        useCanvasStore.getState().setClickedKey(key);
        clickTimeoutRef.current = null;
      }, 300);
    },
    [hasActiveDrag, isTemplateMode, isRightPaneNode, key],
  );

  /**
   * Обработчик двойного клика: отменяет обработку одиночного клика и удаляет узел из дерева
   */
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

  /**
   * Обработчик клика по иконке/кнопке сворачивания и разворачивания дочерних узлов
   */
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
