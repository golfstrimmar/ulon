"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  parseFigmaColors,
  generateScss,
  type ColorToken,
} from "@/app/design/utils/figmaColorParser";
import { getColorVariables, saveColorVariables } from "@/lib/figmaColorStorage";

export function useFigmaColorsController(initialRawJson: string = "") {
  const [tokens, setTokens] = useState<ColorToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const processJson = useCallback((json: string) => {
    if (!json || !json.trim()) {
      setTokens([]);
      setError(null);
      return;
    }
    const result = parseFigmaColors(json);
    setTokens(result.tokens);
    setError(result.error);
  }, []);

  useEffect(() => {
    processJson(initialRawJson);
  }, [initialRawJson, processJson]);

  const handleCopySingle = useCallback((text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedVar(id);
      setTimeout(() => setCopiedVar(null), 1800);
    }
  }, []);

  /**
   * Сохранение цветов в базу с проверкой на дубликаты.
   * Если цвет (HEX) уже есть в базе — повторно не добавляем.
   */
  const handleSaveToDb = useCallback(async () => {
    if (tokens.length === 0) return;

    try {
      // 1. Читаем существующие цвета из базы IndexedDB
      const existingVars = await getColorVariables();

      // 2. Извлекаем существующие HEX (lowercase) и определяем максимальный индекс $color-N
      const existingHexSet = new Set<string>();
      let maxColorIndex = 0;

      existingVars.forEach((entry) => {
        const match = entry.match(/^(\$[a-zA-Z0-9_-]+):\s*(#[a-zA-Z0-9]+);?/);
        if (match) {
          const varName = match[1];
          const hex = match[2].trim().toLowerCase();
          existingHexSet.add(hex);

          const numMatch = varName.match(/^\$color-(\d+)$/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            if (num > maxColorIndex) {
              maxColorIndex = num;
            }
          }
        }
      });

      // 3. Отбираем новые уникальные токены, которых ещё нет в базе
      const newEntriesToAdd: string[] = [];
      let nextIndex = maxColorIndex + 1;

      for (const token of tokens) {
        const hex = token.hex.trim().toLowerCase();
        if (existingHexSet.has(hex)) {
          // Уже есть на базе — пропускаем дублирование
          continue;
        }

        existingHexSet.add(hex);
        const newVarName = `$color-${nextIndex}`;
        nextIndex++;
        newEntriesToAdd.push(`${newVarName}: ${token.hex};`);
      }

      // 4. Объединяем и сохраняем только при наличии изменений
      const mergedVars = [...existingVars, ...newEntriesToAdd];
      if (newEntriesToAdd.length > 0 || existingVars.length === 0) {
        await saveColorVariables(mergedVars);
      }

      // 5. Оповещаем подписчиков через событие
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("figma_colors:saved", { detail: mergedVars }),
        );
      }

      // Индикация статуса: если все цвета уже были — пишем "already-in-db"
      setCopiedVar(newEntriesToAdd.length > 0 ? "all-scss" : "all-scss-duplicate");
      setTimeout(() => setCopiedVar(null), 1800);
    } catch (err) {
      console.error("Error saving color variables:", err);
    }
  }, [tokens]);

  const scssOutput = useMemo(() => generateScss(tokens), [tokens]);

  return {
    tokens,
    error,
    copiedVar,
    scssOutput,
    processJson,
    handleCopySingle,
    handleSaveToDb,
  };
}
