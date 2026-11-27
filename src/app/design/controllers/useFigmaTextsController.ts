"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { getColorVariables } from "@/store/figmaColorStorage";
import { setPixelPerfectImage } from "@/app/plaza/components/PreviewArea/hooks/usePixelPerfect";
import {
  buildColorMap,
  createHtmlNodeFromText,
  createHtmlNodeFromStructureItem,
  extractTextsFromJson,
  extractStructureFromJson,
  flattenStructureTexts,
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
        setIsColorsLoaded(true);
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
          const generatedNodes = structureItems.map((item) =>
            createHtmlNodeFromStructureItem(item, colorMap),
          );

          const sectionPreview = structureItems.find((s) => s.preview)?.preview;
          if (sectionPreview) {
            setPixelPerfectImage(
              sectionPreview,
              structureItems[0]?.name || "Figma Section Preview",
            ).catch(() => {});
          }

          currentTextItemsRef.current =
            textItems.length > 0
              ? textItems
              : flattenStructureTexts(structureItems);

          setNodes(generatedNodes);
          return;
        }

        if (textItems.length === 0) {
          setError(
            "В переданном JSON не найден массив 'structure' или 'texts'",
          );
          setNodes([]);
          currentTextItemsRef.current = [];
          return;
        }

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

  // Добавление одной ноды в дерево (стили и :root переменные синхронизируются в appendNodesToTree)
  const appendSingleNode = async (node: HtmlNode) => {
    if (!node._key) return;
    setSavingKey(node._key);

    try {
      await appendNodesToTree(node);
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
      await appendNodesToTree(nodes);

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
