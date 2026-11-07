"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getColorVariables } from "@/lib/figmaColorStorage";
import { getGlobalScss, saveGlobalScss } from "@/lib/htmlStorage";
import {
  buildColorMap,
  createHtmlNodeFromText,
  createHtmlNodeFromStructureItem,
  extractTextsFromJson,
  extractStructureFromJson,
  flattenStructureTexts,
  generateScssForTextItems,
  type ColorVariableMap,
  type FigmaTextItem,
} from "../models/figmaTextNode.model";
import { appendNodesToTree } from "../models/figmaTreeAppender";

export function useFigmaTextsController() {
  const [nodes, setNodes] = useState<HtmlNode[]>([]);
  const [colorMap, setColorMap] = useState<ColorVariableMap>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isColorsLoaded, setIsColorsLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Хранилище исходных элементов текущего фрагмента для генерации SCSS
  const currentTextItemsRef = useRef<FigmaTextItem[]>([]);

  const loadColors = useCallback(async () => {
    try {
      const vars = await getColorVariables();
      setColorMap(buildColorMap(vars || []));
      setIsColorsLoaded(true);
    } catch (err) {
      console.error("Failed to load color variables:", err);
      setError("Не удалось загрузить цвета из базы");
    }
  }, []);

  useEffect(() => {
    loadColors();

    const handleColorsSaved = (event: Event) => {
      const customEvent = event as CustomEvent<string[]>;
      if (customEvent.detail) {
        setColorMap(buildColorMap(customEvent.detail));
      } else {
        loadColors();
      }
    };

    window.addEventListener("figma_colors:saved", handleColorsSaved);
    return () => {
      window.removeEventListener("figma_colors:saved", handleColorsSaved);
    };
  }, [loadColors]);

  const processJson = useCallback(
    (rawJson: string) => {
      setError(null);

      if (!rawJson.trim()) {
        setNodes([]);
        currentTextItemsRef.current = [];
        return;
      }

      try {
        const structureItems = extractStructureFromJson(rawJson);
        const textItems = extractTextsFromJson(rawJson);

        if (structureItems.length > 0) {
          // Если есть иерархический блок structure — используем его:
          // 1. Порядок узлов в точности как в дереве
          // 2. Родительские блоки (div) группируют дочерние ноды
          const generatedNodes = structureItems.map((item) =>
            createHtmlNodeFromStructureItem(item, colorMap),
          );

          // Для SCSS сохраняем тексты: из блока texts или рекурсивно из structure
          currentTextItemsRef.current =
            textItems.length > 0 ? textItems : flattenStructureTexts(structureItems);

          setNodes(generatedNodes);
          return;
        }

        if (textItems.length === 0) {
          setError("В переданном JSON не найден массив 'structure' или 'texts'");
          setNodes([]);
          currentTextItemsRef.current = [];
          return;
        }

        // Фоллбэк: если пришел старый формат только с текстами
        currentTextItemsRef.current = textItems;

        const generatedNodes = textItems.map((item) =>
          createHtmlNodeFromText(item, colorMap),
        );

        setNodes(generatedNodes);
      } catch (err: unknown) {
        console.error("JSON parsing error:", err);
        setError("Ошибка парсинга JSON: проверьте формат входных данных");
        setNodes([]);
        currentTextItemsRef.current = [];
      }
    },
    [colorMap],
  );

  // Вспомогательная функция: добавление SCSS в базу Plaza (GlobalScss)
  const syncScssWithPlaza = async (items: FigmaTextItem[]) => {
    const newClassesScss = generateScssForTextItems(items, colorMap);
    if (!newClassesScss.trim()) return;

    const [currentGlobalScss, colorVars] = await Promise.all([
      getGlobalScss().catch(() => ""),
      getColorVariables().catch(() => []),
    ]);

    let updatedScss = currentGlobalScss || "";

    // Добавляем цвета в заголовок, если их еще нет в GlobalScss
    if (colorVars.length > 0 && !updatedScss.includes("$color-")) {
      const colorVarsHeader = colorVars.join("\n");
      updatedScss = `${colorVarsHeader}\n\n${updatedScss}`;
    }

    // Дописываем новые классы
    updatedScss = `${updatedScss.trim()}\n\n/* Figma Generated Classes */\n${newClassesScss}\n`;

    await saveGlobalScss(updatedScss);
  };

  // Добавление одной ноды в дерево
  const appendSingleNode = async (node: HtmlNode) => {
    if (!node._key) return;
    setSavingKey(node._key);

    try {
      // 1. Сохраняем ноду в дерево
      await appendNodesToTree(node);

      // 2. Находим соответствующий элемент и дописываем его SCSS-класс в базу
      const matchedItem = currentTextItemsRef.current.find(
        (item) =>
          (item.id || item.text) === node._key || item.className === node.class,
      );
      if (matchedItem) {
        await syncScssWithPlaza([matchedItem]);
      }

      // 3. Убираем добавленную ноду из буфера экрана
      setNodes((prev) => prev.filter((n) => n._key !== node._key));
      setSavingKey(null);
    } catch (err) {
      console.error("Ошибка сохранения ноды в базу:", err);
      setSavingKey(null);
    }
  };

  // Добавление всех сформированных нод в дерево
  const appendAllNodes = async () => {
    if (nodes.length === 0) return;
    setSavingKey("all");

    try {
      // 1. Сохраняем массив нод в дерево HTML
      await appendNodesToTree(nodes);

      // 2. Дописываем все SCSS-классы текущего фрагмента в GlobalScss плазы
      if (currentTextItemsRef.current.length > 0) {
        await syncScssWithPlaza(currentTextItemsRef.current);
      }

      // 3. Очищаем экран — фрагмент успешно ушел в дерево и стили сохранены
      setTimeout(() => {
        setNodes([]);
        currentTextItemsRef.current = [];
        setSavingKey(null);
      }, 500);
    } catch (err) {
      console.error("Ошибка сохранения всех нод в базу:", err);
      setSavingKey(null);
    }
  };

  return {
    nodes,
    error,
    isColorsLoaded,
    colorMapSize: colorMap.size,
    savingKey,
    processJson,
    appendSingleNode,
    appendAllNodes,
  };
}
