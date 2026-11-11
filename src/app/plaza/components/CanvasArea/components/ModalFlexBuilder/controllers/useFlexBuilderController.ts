"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  getHtmlJson,
  saveHtmlJson,
  getGlobalScss,
  saveGlobalScss,
} from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import type { HtmlNode } from "@/types/HtmlNode";
import type { FlexDirection } from "../types/flexBuilder.types";
import {
  MIN_ITEMS_COUNT,
  MAX_ITEMS_COUNT,
  DEFAULT_ITEMS_COUNT,
  DEFAULT_ROW_CLASS,
  DEFAULT_COL_CLASS,
  INITIAL_PERCENTAGES,
} from "../constants/flexBuilderConstants";
import {
  divideEqually,
  calculateSplitterPositions,
  calculateSplitterDrag,
  buildFlexHtmlNodes,
  syncFlexStylesToScss,
} from "../models/flexBuilderModel";

interface UseFlexBuilderControllerProps {
  initialDirection?: FlexDirection;
  onSaveNode?: (node: HtmlNode) => void;
  onClose: () => void;
}

export function useFlexBuilderController({
  initialDirection = "row",
  onSaveNode,
  onClose,
}: UseFlexBuilderControllerProps) {
  // Направление: row (f-r) или col (f-c)
  const [direction, setDirection] = useState<FlexDirection>(initialDirection);

  // Количество элементов (1 - 12)
  const [itemsCount, setItemsCount] = useState<number>(DEFAULT_ITEMS_COUNT);

  // Проценты элементов (дробные значения, в сумме строго 100%)
  const [percentages, setPercentages] = useState<number[]>(INITIAL_PERCENTAGES);

  // Классы
  const [containerClass, setContainerClass] = useState<string>(DEFAULT_ROW_CLASS);
  const [childExtraClass, setChildExtraClass] = useState<string>("");

  // Реф трека и активный сплиттер
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeSplitterIndex, setActiveSplitterIndex] = useState<number | null>(
    null,
  );

  const isCol = direction === "col";
  const defaultClass = isCol ? DEFAULT_COL_CLASS : DEFAULT_ROW_CLASS;

  // Смена направления
  const handleDirectionChange = useCallback(
    (newDir: FlexDirection) => {
      setDirection(newDir);
      if (
        containerClass === DEFAULT_ROW_CLASS ||
        containerClass === DEFAULT_COL_CLASS ||
        containerClass === ""
      ) {
        setContainerClass(
          newDir === "col" ? DEFAULT_COL_CLASS : DEFAULT_ROW_CLASS,
        );
      }
    },
    [containerClass],
  );

  // Изменение количества элементов
  const handleCountChange = useCallback((newCount: number) => {
    const clamped = Math.max(
      MIN_ITEMS_COUNT,
      Math.min(MAX_ITEMS_COUNT, newCount),
    );
    setItemsCount(clamped);
    setPercentages(divideEqually(clamped));
  }, []);

  // Применение пресета
  const applyPreset = useCallback((preset: number[]) => {
    setItemsCount(preset.length);
    setPercentages(preset);
  }, []);

  // Равномерное распределение
  const distributeEqually = useCallback(() => {
    setPercentages(divideEqually(itemsCount));
  }, [itemsCount]);

  // Драг сплиттера
  const startDragSplitter = useCallback(
    (index: number, e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setActiveSplitterIndex(index);

      const track = trackRef.current;
      if (!track) return;

      const trackRect = track.getBoundingClientRect();
      const startCoord = isCol ? e.clientY : e.clientX;
      const trackSize = isCol ? trackRect.height : trackRect.width;
      const initialPercentages = [...percentages];

      const onPointerMove = (moveEvent: PointerEvent) => {
        const currentCoord = isCol ? moveEvent.clientY : moveEvent.clientX;
        const next = calculateSplitterDrag({
          isCol,
          startCoord,
          currentCoord,
          trackSize,
          index,
          initialPercentages,
        });
        setPercentages(next);
      };

      const onPointerUp = () => {
        setActiveSplitterIndex(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [isCol, percentages],
  );

  // Позиции сплиттеров (%)
  const splitterPositions = useMemo(
    () => calculateSplitterPositions(percentages),
    [percentages],
  );

  // Сохранение в Canvas (ноды чистые) и SCSS (стили классов)
  const handleSaveToTree = useCallback(async () => {
    const primaryContainerClass = (
      containerClass.trim() || defaultClass
    ).split(/\s+/)[0];

    // 1. Формируем чистые ноды разметки
    const { parentNode } = buildFlexHtmlNodes({
      direction,
      containerClass,
      defaultClass,
      childExtraClass,
      percentages,
    });

    try {
      // 2. Добавляем ноды в дерево IndexedDB
      const existing = await getHtmlJson(DB_KEY).catch(() => null);
      const currentList: HtmlNode[] = existing
        ? Array.isArray(existing)
          ? existing
          : [existing]
        : [];

      const nextList = [...currentList, parentNode];
      await saveHtmlJson(DB_KEY, nextList);

      // 3. Синхронизируем стили классов в общий файл SCSS
      const currentScss = await getGlobalScss().catch(() => "");
      const nextScss = syncFlexStylesToScss({
        globalScss: currentScss,
        primaryContainerClass,
        direction,
        percentages,
      });

      await saveGlobalScss(nextScss);

      // 4. Оповещаем подписчиков через кастомные события
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("plaza-styles-updated", { detail: nextScss }),
        );
        window.dispatchEvent(
          new CustomEvent("plaza-tree-updated", {
            detail: { nodes: nextList, source: "modal-flex-builder" },
          }),
        );
      }

      if (onSaveNode) onSaveNode(parentNode);
      onClose();
    } catch (err) {
      console.error("[useFlexBuilderController] Save error:", err);
    }
  }, [
    containerClass,
    defaultClass,
    direction,
    childExtraClass,
    percentages,
    onSaveNode,
    onClose,
  ]);

  return {
    direction,
    isCol,
    itemsCount,
    percentages,
    containerClass,
    childExtraClass,
    activeSplitterIndex,
    trackRef,
    splitterPositions,
    defaultClass,
    setContainerClass,
    setChildExtraClass,
    handleDirectionChange,
    handleCountChange,
    applyPreset,
    distributeEqually,
    startDragSplitter,
    handleSaveToTree,
  };
}
