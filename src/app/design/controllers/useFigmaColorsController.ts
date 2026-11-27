"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  parseFigmaColors,
  generateScss,
  type ColorToken,
} from "@/app/design/utils/figmaColorParser";
import {
  getColorVariables,
  saveColorVariables,
  clearColorVariables,
  appendColorVariables,
  embedColorVariablesIntoScss,
  removeColorVariablesFromScss,
} from "@/store/figmaColorStorage";
import { getGlobalScss, saveGlobalScss } from "@/store/htmlStorage";

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
      const copyVal = text.startsWith("--") ? `var(${text})` : text;
      navigator.clipboard.writeText(copyVal);
      setCopiedVar(id);
      setTimeout(() => setCopiedVar(null), 1800);
    }
  }, []);

  /**
   * По кнопке «+ Дополнить базу»:
   * генерирует `--color-N: #HEX;` без дублей, сохраняет в IndexedDB и обновляет `:root` в `globalScss`.
   */
  const handleSaveToDb = useCallback(async () => {
    if (tokens.length === 0) return;

    try {
      const before = await getColorVariables();
      const mergedVars = await appendColorVariables(tokens);
      const addedCount = mergedVars.length - before.length;

      // Синхронизируем :root { --color-... } в глобальный SCSS
      const currentScss = await getGlobalScss().catch(() => "");
      const nextScss = embedColorVariablesIntoScss(currentScss, mergedVars);
      if (nextScss !== currentScss) {
        await saveGlobalScss(nextScss);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("plaza-styles-updated", { detail: nextScss }),
          );
        }
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("figma_colors:saved", { detail: mergedVars }),
        );
      }

      setCopiedVar(addedCount > 0 ? "all-scss" : "all-scss-duplicate");
      setTimeout(() => setCopiedVar(null), 1800);
    } catch (err) {
      console.error("Error saving color variables:", err);
    }
  }, [tokens]);

  /**
   * По кнопке «Заменить палитру в базе»:
   * очищает старые цвета и сохраняет чистую палитру этого макета в `:root` и в базу.
   */
  const handleReplaceDbPalette = useCallback(async () => {
    if (tokens.length === 0) return;

    try {
      await clearColorVariables();
      const uniqueHexSet = new Set<string>();
      const cleanVars: string[] = [];
      let index = 1;

      for (const token of tokens) {
        if (!token.hex) continue;
        const hex = token.hex.trim().toLowerCase();
        if (uniqueHexSet.has(hex)) continue;
        uniqueHexSet.add(hex);
        cleanVars.push(`--color-${index}: ${token.hex};`);
        index++;
      }

      await saveColorVariables(cleanVars);

      const currentScss = await getGlobalScss().catch(() => "");
      const cleanedScss = removeColorVariablesFromScss(currentScss);
      const nextScss = embedColorVariablesIntoScss(cleanedScss, cleanVars);
      if (nextScss !== currentScss) {
        await saveGlobalScss(nextScss);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("plaza-styles-updated", { detail: nextScss }),
          );
        }
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("figma_colors:saved", { detail: cleanVars }),
        );
      }

      setCopiedVar("replaced-db");
      setTimeout(() => setCopiedVar(null), 1800);
    } catch (err) {
      console.error("Error replacing color variables:", err);
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
    handleReplaceDbPalette,
  };
}
