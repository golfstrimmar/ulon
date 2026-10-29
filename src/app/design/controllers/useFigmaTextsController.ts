"use client";

import { useState, useEffect, useCallback } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getColorVariables } from "@/lib/figmaColorStorage";
import {
  buildColorMap,
  createHtmlNodeFromText,
  extractTextsFromJson,
  type ColorVariableMap,
} from "../models/figmaTextNode.model";
import { appendNodesToTree } from "../models/figmaTreeAppender";

export function useFigmaTextsController() {
  const [nodes, setNodes] = useState<HtmlNode[]>([]);
  const [colorMap, setColorMap] = useState<ColorVariableMap>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [isColorsLoaded, setIsColorsLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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
        return;
      }

      try {
        const textItems = extractTextsFromJson(rawJson);

        if (textItems.length === 0) {
          setError("В переданном JSON не найден массив 'texts'");
          setNodes([]);
          return;
        }

        const generatedNodes = textItems.map((item) =>
          createHtmlNodeFromText(item, colorMap),
        );

        setNodes(generatedNodes);
      } catch (err: unknown) {
        console.error("JSON parsing error:", err);
        setError("Ошибка парсинга JSON: проверьте формат входных данных");
        setNodes([]);
      }
    },
    [colorMap],
  );

  // Добавление одной ноды в дерево
  const appendSingleNode = async (node: HtmlNode) => {
    if (!node._key) return;
    setSavingKey(node._key);
    try {
      await appendNodesToTree(node);
      setTimeout(() => setSavingKey(null), 1500);
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
      await appendNodesToTree(nodes);

      setTimeout(() => setSavingKey(null), 1500);
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
