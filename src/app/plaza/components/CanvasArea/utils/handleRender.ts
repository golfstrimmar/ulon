/**
 * @file handleRender.ts
 * @description Отрисовка дерева узлов HtmlNode на 2D-контексте Canvas с визуальной вложенностью "одна поверх другой".
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

  const HEADER_HEIGHT = 38;
  const PADDING_BOTTOM = 14;
  const GAP_Y = 10;
  const INDENT_X = 18; // Видимый внутренний отступ для эффекта вложенности

  const toggleBtnBounds = hasChildren
    ? { x: x + 10, y: y + 10, w: 18, h: 18 }
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

  // Расчет геометрии вложенных потомков (внутри родительского блока)
  const childX = x + INDENT_X;
  const childWidth = Math.max(120, width - INDENT_X * 2);
  let currentY = y + HEADER_HEIGHT + 6;
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

function flattenBoxes(layout: LayoutResult, result: RenderBox[] = []): RenderBox[] {
  result.push(layout.box);
  for (const child of layout.children) {
    flattenBoxes(child, result);
  }
  return result;
}

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
  const containerHeight = canvas.parentElement?.clientHeight || 600;

  // Если данных нет — холст чист
  if (!currentJson || currentJson.length === 0) {
    if (canvas.width !== parentWidth * dpr || canvas.height !== containerHeight * dpr) {
      canvas.width = parentWidth * dpr;
      canvas.height = containerHeight * dpr;
      canvas.style.width = `${parentWidth}px`;
      canvas.style.height = `${containerHeight}px`;
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, parentWidth, containerHeight);
    boxesRef.current = [];
    ctx.restore();
    return;
  }

  const startX = 24;
  const startY = 24;
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

  const totalContentHeight = Math.max(containerHeight, currentY + 40, visibleMockupHeight);

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

  // Сбор всех блоков
  const allBoxes: RenderBox[] = [];
  for (const l of allLayouts) {
    flattenBoxes(l, allBoxes);
  }
  boxesRef.current = allBoxes;

  // Палитра глубины: каждый вложенный слой становится визуально "выше" (светлее + тень)
  const depthBg = [
    "rgba(18, 18, 23, 0.96)", // depth 0: основание
    "rgba(28, 28, 35, 0.96)", // depth 1: блок поверх основания
    "rgba(38, 38, 48, 0.96)", // depth 2: блок поверх первого
    "rgba(48, 48, 60, 0.96)", // depth 3: блок поверх второго
    "rgba(58, 58, 72, 0.96)", // depth 4+
  ];

  const depthBorder = [
    "rgba(63, 63, 70, 0.8)",   // zinc-700
    "rgba(82, 82, 91, 0.85)",  // zinc-600
    "rgba(113, 113, 122, 0.9)", // zinc-500
    "rgba(161, 161, 170, 0.9)", // zinc-400
    "rgba(212, 212, 216, 0.9)",
  ];

  // Отрисовка каждого блока от родителя к детям
  for (const box of allBoxes) {
    const isHovered = box.key === hoveredKey;
    const isClicked = box.key === clickedKey;
    const isDragged = box.key === draggedKey;
    const isDrop = dropTarget?.key === box.key;
    const depthIdx = Math.min(box.depth, depthBg.length - 1);

    // 1. Тень (придает объем вложенности "одна поверх другой")
    ctx.save();
    if (box.depth > 0 || isHovered || isClicked || isDrop) {
      ctx.shadowColor = isDrop ? "rgba(56, 189, 248, 0.4)" : "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = Math.min(14, 4 + box.depth * 3);
      ctx.shadowOffsetY = Math.min(6, 2 + box.depth * 1.5);
    }

    // 2. Фон блока
    if (isDrop && dropTarget?.position === "self") {
      ctx.fillStyle = "rgba(168, 85, 247, 0.24)"; // фиолетовый для дублирования на самого себя
    } else if (isDrop && dropTarget?.position === "inside") {
      ctx.fillStyle = "rgba(56, 189, 248, 0.18)"; // sky blue для вставки внутрь
    } else if (isDragged) {
      ctx.fillStyle = "rgba(63, 63, 70, 0.3)"; // полупрозрачный для перетаскиваемого
    } else if (isClicked) {
      ctx.fillStyle = "rgba(99, 102, 241, 0.22)";
    } else if (isHovered) {
      ctx.fillStyle = "rgba(99, 102, 241, 0.12)";
    } else {
      ctx.fillStyle = depthBg[depthIdx];
    }

    drawRoundedRect(ctx, box.x, box.y, box.w, box.h, 8);
    ctx.fill();
    ctx.restore();

    // 3. Рамка блока
    if (isDrop && dropTarget?.position === "self") {
      ctx.strokeStyle = "#c084fc"; // purple-400
      ctx.lineWidth = 2.5;
    } else if (isDrop && dropTarget?.position === "inside") {
      ctx.strokeStyle = "#38bdf8"; // sky blue
      ctx.lineWidth = 2.5;
    } else if (isDragged) {
      ctx.strokeStyle = "rgba(161, 161, 170, 0.4)";
      ctx.lineWidth = 1;
    } else if (isClicked) {
      ctx.strokeStyle = "#818cf8"; // indigo-400
      ctx.lineWidth = 2;
    } else if (isHovered) {
      ctx.strokeStyle = "#a5b4fc"; // indigo-300
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = depthBorder[depthIdx];
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // 4. Кнопка сворачивания [+] / [-]
    let textStartX = box.x + 12;
    if (box.hasChildren && box.toggleBtnBounds) {
      const tb = box.toggleBtnBounds;
      ctx.fillStyle = "rgba(24, 24, 27, 0.9)";
      drawRoundedRect(ctx, tb.x, tb.y, tb.w, tb.h, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(113, 113, 122, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#d4d4d8";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(box.isCollapsed ? "+" : "-", tb.x + tb.w / 2, tb.y + tb.h / 2);

      textStartX = tb.x + tb.w + 10;
    }

    // 5. Бейдж тега <tag> с цветовой дифференциацией
    const tagText = `<${box.tag}>`;
    ctx.font = "bold 12px ui-monospace, SFMono-Regular, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const tagWidth = ctx.measureText(tagText).width;

    if (box.tag.toLowerCase() === "div") {
      ctx.fillStyle = "rgba(49, 46, 129, 0.85)"; // indigo
      ctx.strokeStyle = "#6366f1";
    } else if (box.tag.toLowerCase() === "p") {
      ctx.fillStyle = "rgba(6, 78, 59, 0.85)"; // emerald
      ctx.strokeStyle = "#10b981";
    } else {
      ctx.fillStyle = "rgba(39, 39, 42, 0.85)"; // zinc
      ctx.strokeStyle = "#71717a";
    }

    drawRoundedRect(ctx, textStartX, box.y + 8, tagWidth + 12, 22, 5);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = box.tag.toLowerCase() === "div" ? "#c7d2fe" : box.tag.toLowerCase() === "p" ? "#a7f3d0" : "#e4e4e7";
    ctx.fillText(tagText, textStartX + 6, box.y + 19);

    // 6. Текст содержимого (например "Lorem" из p.json)
    if (box.text) {
      const labelX = textStartX + tagWidth + 18;
      const maxTextWidth = Math.max(40, box.w - (labelX - box.x) - 16);

      ctx.font = "13px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#e4e4e7";

      let display = `"${box.text}"`;
      if (ctx.measureText(display).width > maxTextWidth) {
        while (display.length > 4 && ctx.measureText(display + "…").width > maxTextWidth) {
          display = display.slice(0, -1);
        }
        display += "…";
      }

      ctx.fillText(display, labelX, box.y + 19);
    }
  }

  // Отрисовка линии-индикатора для вставки между нодами (before / after)
  if (dropTarget && (dropTarget.position === "before" || dropTarget.position === "after")) {
    const targetBox = allBoxes.find((b) => b.key === dropTarget.key);
    if (targetBox) {
      const lineY = dropTarget.position === "before" ? targetBox.y - 2 : targetBox.y + targetBox.h + 2;
      const startX = targetBox.x;
      const endX = targetBox.x + targetBox.w;

      ctx.save();
      ctx.shadowColor = "rgba(56, 189, 248, 0.9)";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#38bdf8"; // sky-400
      ctx.fillStyle = "#38bdf8";
      ctx.lineWidth = 3;

      // Горизонтальная линия места вставки
      ctx.beginPath();
      ctx.moveTo(startX + 8, lineY);
      ctx.lineTo(endX, lineY);
      ctx.stroke();

      // Точка-маркер в начале линии
      ctx.beginPath();
      ctx.arc(startX + 4, lineY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // Отрисовка "призрака" перетаскиваемого узла рядом с курсором
  if (draggedKey && dragMousePos) {
    const draggedBox = allBoxes.find((b) => b.key === draggedKey);
    if (draggedBox) {
      const ghostW = 140;
      const ghostH = 34;
      const gx = dragMousePos.x + 12;
      const gy = dragMousePos.y + 12;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = "rgba(49, 46, 129, 0.9)"; // indigo-900
      drawRoundedRect(ctx, gx, gy, ghostW, ghostH, 6);
      ctx.fill();

      ctx.strokeStyle = "#818cf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.fillStyle = "#c7d2fe";
      ctx.textBaseline = "middle";
      ctx.fillText(`<${draggedBox.tag}>`, gx + 10, gy + ghostH / 2);

      if (draggedBox.text) {
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#e0e7ff";
        ctx.fillText(`"${draggedBox.text.slice(0, 8)}"`, gx + 60, gy + ghostH / 2);
      }

      ctx.restore();
    }
  }

  ctx.restore();
}
