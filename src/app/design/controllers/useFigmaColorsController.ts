// useFigmaColorsController.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  parseFigmaColors,
  generateScss,
  type ColorToken,
} from "@/app/design/utils/figmaColorParser";
import { appendColorVariables } from "@/lib/figmaColorStorage"; // <-- используем метод дополнения

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

  // Сохранение с мерджем и дедупликацией
  const handleSaveToDb = useCallback(async () => {
    if (tokens.length === 0) return;

    try {
      // Передаём токены напрямую в appendColorVariables
      const updatedTotalList = await appendColorVariables(tokens);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("figma_colors:saved", { detail: updatedTotalList }),
        );
      }
      setCopiedVar("all-scss");
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
