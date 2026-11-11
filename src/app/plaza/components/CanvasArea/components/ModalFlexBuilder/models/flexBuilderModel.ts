import type { HtmlNode } from "@/types/HtmlNode";
import { updateClassInGlobalScss } from "@/lib/scssCompiler";
import type { FlexDirection, SplitterPosition } from "../types/flexBuilder.types";
import { MIN_ITEM_PERCENT } from "../constants/flexBuilderConstants";

/**
 * Делит 100% на N равных частей (с округлением до сотых, сумма строго 100%)
 */
export function divideEqually(count: number): number[] {
  if (count <= 0) return [100];
  const raw = 100 / count;
  const rounded = Math.floor(raw * 100) / 100;
  const arr = Array(count).fill(rounded);
  const sum = rounded * count;
  const diff = Math.round((100 - sum) * 100) / 100;
  arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
  return arr;
}

/**
 * Имя класса: процент всегда округляется до целого числа (flex-33, flex-50 и т.д.)
 */
export function getFlexClass(percent: number): string {
  return `flex-${Math.round(percent)}`;
}

/**
 * Расчет позиций сплиттеров на шкале (%)
 */
export function calculateSplitterPositions(
  percentages: number[],
): SplitterPosition[] {
  const result: SplitterPosition[] = [];
  let accum = 0;
  for (let i = 0; i < percentages.length - 1; i++) {
    accum += percentages[i];
    result.push({ index: i, position: accum });
  }
  return result;
}

/**
 * Пересчет ширин/высот при перемещении сплиттера
 */
export function calculateSplitterDrag(params: {
  isCol: boolean;
  startCoord: number;
  currentCoord: number;
  trackSize: number;
  index: number;
  initialPercentages: number[];
  minPercent?: number;
}): number[] {
  const {
    startCoord,
    currentCoord,
    trackSize,
    index,
    initialPercentages,
    minPercent = MIN_ITEM_PERCENT,
  } = params;

  if (trackSize <= 0) return initialPercentages;

  const deltaPx = currentCoord - startCoord;
  const deltaPercent = (deltaPx / trackSize) * 100;

  const maxDelta = initialPercentages[index + 1] - minPercent;
  const minDelta = -(initialPercentages[index] - minPercent);

  const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaPercent));

  const next = [...initialPercentages];
  const newLeft =
    Math.round((initialPercentages[index] + clampedDelta) * 100) / 100;
  const newRight =
    Math.round((initialPercentages[index + 1] - clampedDelta) * 100) / 100;

  next[index] = Math.max(minPercent, newLeft);
  next[index + 1] = Math.max(minPercent, newRight);

  const currentSum = next.reduce((acc, v) => acc + v, 0);
  const diff = Math.round((100 - currentSum) * 100) / 100;
  next[index + 1] = Math.round((next[index + 1] + diff) * 100) / 100;

  return next;
}

/**
 * Генерация SCSS правила для flex-контейнера
 */
export function generateContainerSnippet(
  className: string,
  direction: FlexDirection,
): string {
  const dirStyle =
    direction === "col"
      ? "flex-direction: column;"
      : "flex-wrap: wrap;";

  return `.${className} {\n  display: flex;\n  ${dirStyle}\n  width: 100%;\n  box-sizing: border-box;\n}`;
}

/**
 * Генерация SCSS правила для дочерней колонки
 */
export function generateChildSnippet(
  className: string,
  percent: number,
): string {
  return `.${className} {\n  flex: 0 0 ${percent}%;\n  box-sizing: border-box;\n}`;
}

/**
 * Построение чистых HtmlNode (без инлайн-стилей)
 */
export function buildFlexHtmlNodes(params: {
  direction: FlexDirection;
  containerClass: string;
  defaultClass: string;
  childExtraClass: string;
  percentages: number[];
}): { parentNode: HtmlNode; children: HtmlNode[] } {
  const {
    containerClass,
    defaultClass,
    childExtraClass,
    percentages,
  } = params;

  const containerKey = `flex_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const children: HtmlNode[] = percentages.map((percent, index) => {
    const childKey = `flex_item_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;
    const autoFlexClass = getFlexClass(percent);
    const fullChildClass = [autoFlexClass, childExtraClass.trim()]
      .filter(Boolean)
      .join(" ");

    return {
      tag: "div",
      text: "",
      class: fullChildClass,
      style: "",
      attributes: {},
      children: [],
      _key: childKey,
    };
  });

  const parentNode: HtmlNode = {
    tag: "div",
    text: "",
    class: containerClass.trim() || defaultClass,
    style: "",
    attributes: {},
    children,
    _key: containerKey,
  };

  return { parentNode, children };
}

/**
 * Синхронизация flex-стилей в общий SCSS код
 */
export function syncFlexStylesToScss(params: {
  globalScss: string;
  primaryContainerClass: string;
  direction: FlexDirection;
  percentages: number[];
}): string {
  const {
    globalScss,
    primaryContainerClass,
    direction,
    percentages,
  } = params;

  let nextScss = globalScss;

  // Контейнер
  const containerSnippet = generateContainerSnippet(
    primaryContainerClass,
    direction,
  );
  nextScss = updateClassInGlobalScss(
    nextScss,
    primaryContainerClass,
    containerSnippet,
  );

  // Дочерние flex-классы
  percentages.forEach((percent) => {
    const cls = getFlexClass(percent);
    const childSnippet = generateChildSnippet(cls, percent);
    nextScss = updateClassInGlobalScss(nextScss, cls, childSnippet);
  });

  return nextScss;
}
