/**
 * @file handleRender.ts
 * @description Отрисовка дерева узлов HtmlNode на 2D-контексте Canvas в виде вложенных блоков.
 */

import { HtmlNode } from "@/types/HtmlNode";
import { RenderBox } from "./types";

interface LayoutResult {
  box: RenderBox;
  children: LayoutResult[];
  totalHeight: number;
}

/**
 * Рекурсивный расчет геометрии вложенных блоков узлов (Layout Pass)
 */
function computeNodeLayout(
  node: HtmlNode,
  x: number,
  y: number,
  width: number,
  depth: number,
  collapsedKeys: Set<string>
): LayoutResult {
  const key = node._key || `node_${depth}_${Math.random()}`;
  const isCollapsed = collapsedKeys.has(key);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  const HEADER_HEIGHT = 36;
  const PADDING_BOTTOM = 10;
  const GAP_Y = 8;
  const INDENT_X = 14;

  const toggleBtnBounds = hasChildren
    ? { x: x + 8, y: y + 9, w: 18, h: 18 }
    : undefined;

  if (!hasChildren || isCollapsed) {
    const totalHeight = HEADER_HEIGHT;
    return {
      box: {
        key,
        tag: node.tag || "div",
        text: node.text,
        x,
        y,
        w: width,
        h: totalHeight,
        depth,
        hasChildren,
        isCollapsed,
        toggleBtnBounds,
      },
      children: [],
      totalHeight,
    };
  }

  // Расчет вложенных потомков
  const childX = x + INDENT_X;
  const childWidth = Math.max(120, width - INDENT_X * 2);
  let currentY = y + HEADER_HEIGHT + 4;
  const childLayouts: LayoutResult[] = [];

  for (const child of node.children as HtmlNode[]) {
    const childLayout = computeNodeLayout(
      child,
      childX,
      currentY,
      childWidth,
      depth + 1,
      collapsedKeys
    );
    childLayouts.push(childLayout);
    currentY += childLayout.totalHeight + GAP_Y;
  }

  const totalHeight = (currentY - GAP_Y - y) + PADDING_BOTTOM;

  return {
    box: {
      key,
      tag: node.tag || "div",
      text: node.text,
      x,
      y,
      w: width,
      h: totalHeight,
      depth,
      hasChildren,
      isCollapsed,
      toggleBtnBounds,
    },
    children: childLayouts,
    totalHeight,
  };
}

/**
 * Сбор всех рассчитанных блоков в плоский массив для hit-testing
 */
function flattenBoxes(layout: LayoutResult, result: RenderBox[] = []): RenderBox[] {
  result.push(layout.box);
  for (const child of layout.children) {
    flattenBoxes(child, result);
  }
  return result;
}

/**
 * Отрисовка скругленного прямоугольника
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Отрисовка дерева узлов
 */
export default function handleRender(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  boxesRef: React.MutableRefObject<RenderBox[]>,
  currentJson: HtmlNode[],
  hoveredKey: string | null = null,
  draggedKey: string | null = null,
  dropTarget: { key: string; position: string } | null = null,
  dragMousePos: { x: number; y: number } | null = null,
  collapsedKeys: Set<string> = new Set(),
  clickedKey: string | null = null,
  hasVisibleBg: boolean = false,
  targetParentKey: string | null = null,
  visibleMockupHeight: number = 0
): void {
  const dpr = window.devicePixelRatio || 1;
  const parentWidth = canvas.parentElement?.clientWidth || 1000;
  const startX = 20;
  const startY = 20;
  const availableWidth = Math.max(300, parentWidth - startX * 2);

  // Расчет геометрии всех корней
  let currentY = startY;
  const allLayouts: LayoutResult[] = [];

  for (const node of currentJson) {
    const layout = computeNodeLayout(
      node,
      startX,
      currentY,
      availableWidth,
      0,
      collapsedKeys
    );
    allLayouts.push(layout);
    currentY += layout.totalHeight + 16;
  }

  const containerHeight = canvas.parentElement?.clientHeight || 600;
  const totalContentHeight = Math.max(containerHeight, currentY + 40, visibleMockupHeight);

  // Ресайз холста под размер контента с учетом DPR
  if (
    canvas.width !== parentWidth * dpr ||
    canvas.height !== totalContentHeight * dpr
  ) {
    canvas.width = parentWidth * dpr;
    canvas.height = totalContentHeight * dpr;
    canvas.style.width = `${parentWidth}px`;
    canvas.style.height = `${totalContentHeight}px`;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, parentWidth, totalContentHeight);

  // Сбор блоков для мыши
  const allBoxes: RenderBox[] = [];
  for (const l of allLayouts) {
    flattenBoxes(l, allBoxes);
  }
  boxesRef.current = allBoxes;

  // Отрисовка каждого блока (от родителя к детям)
  for (const box of allBoxes) {
    const isHovered = box.key === hoveredKey;
    const isClicked = box.key === clickedKey;
    const isDrop = dropTarget?.key === box.key;

    // 1. Фон блока
    if (isClicked) {
      ctx.fillStyle = "rgba(99, 102, 241, 0.18)";
    } else if (isHovered) {
      ctx.fillStyle = "rgba(99, 102, 241, 0.10)";
    } else {
      // Оттенок зависит от глубины вложенности
      const depthAlpha = Math.max(0.2, 0.7 - box.depth * 0.12);
      ctx.fillStyle = `rgba(24, 24, 27, ${depthAlpha})`;
    }

    drawRoundedRect(ctx, box.x, box.y, box.w, box.h, 8);
    ctx.fill();

    // 2. Рамка блока
    if (isDrop) {
      ctx.strokeStyle = "#38bdf8"; // sky blue для drop target
      ctx.lineWidth = 2;
    } else if (isClicked) {
      ctx.strokeStyle = "#6366f1"; // indigo
      ctx.lineWidth = 2;
    } else if (isHovered) {
      ctx.strokeStyle = "#818cf8";
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = "rgba(63, 63, 70, 0.65)"; // zinc-700
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // 3. Кнопка сворачивания [+] / [-]
    let textStartX = box.x + 12;
    if (box.hasChildren && box.toggleBtnBounds) {
      const tb = box.toggleBtnBounds;
      ctx.fillStyle = "rgba(39, 39, 42, 0.9)";
      drawRoundedRect(ctx, tb.x, tb.y, tb.w, tb.h, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(113, 113, 122, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(box.isCollapsed ? "+" : "-", tb.x + tb.w / 2, tb.y + tb.h / 2);

      textStartX = tb.x + tb.w + 10;
    }

    // 4. Бейдж тега <tag>
    const tagText = `<${box.tag}>`;
    ctx.font = "bold 12px ui-monospace, SFMono-Regular, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const tagWidth = ctx.measureText(tagText).width;

    ctx.fillStyle = "rgba(49, 46, 129, 0.6)"; // indigo-950
    drawRoundedRect(ctx, textStartX, box.y + 7, tagWidth + 12, 22, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#a5b4fc"; // indigo-300
    ctx.fillText(tagText, textStartX + 6, box.y + 18);

    // 5. Текст узла (если есть)
    if (box.text) {
      const labelX = textStartX + tagWidth + 20;
      const maxTextWidth = Math.max(50, box.w - (labelX - box.x) - 16);

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#e4e4e7";

      let display = `"${box.text}"`;
      if (ctx.measureText(display).width > maxTextWidth) {
        while (display.length > 4 && ctx.measureText(display + "…").width > maxTextWidth) {
          display = display.slice(0, -1);
        }
        display += "…";
      }

      ctx.fillText(display, labelX, box.y + 18);
    }
  }

  ctx.restore();
}
