"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getGlobalScss, saveGlobalScss } from "@/store/htmlStorage";
import { syncColorsFromScssToDb } from "@/store/figmaColorStorage";
import { styleHistory } from "@/lib/styleHistory";
import {
  extractRootBlock,
  parseTokensFromRootText,
  updateTokenInScss,
  replaceRootInScss,
  type TokenItem,
} from "@/app/plaza/components/CanvasArea/components/ModalTokens/tokensModel";

export function useTokensManager(isOpen: boolean) {
  const [globalScss, setGlobalScss] = useState<string>("");
  const [rootText, setRootText] = useState<string>(":root {\n}");
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const scssRef = useRef<string>("");
  scssRef.current = globalScss;

  // 1. Загрузка данных при открытии модалки
  const loadData = useCallback(async () => {
    try {
      const current = (await getGlobalScss().catch(() => "")) || "";
      setGlobalScss(current);

      const rootInfo = extractRootBlock(current);
      const initialRootText = rootInfo ? rootInfo.rootText : ":root {\n}";
      setRootText(initialRootText);
      setTokens(parseTokensFromRootText(initialRootText));

      setCanUndo(styleHistory.canUndo());
      setCanRedo(styleHistory.canRedo());
    } catch (e) {
      console.error("[useTokensManager] Failed to load SCSS:", e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Подписка на обновление истории стилей
  useEffect(() => {
    const handleHistoryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{
        canUndo: boolean;
        canRedo: boolean;
      }>;
      if (customEvent.detail) {
        setCanUndo(customEvent.detail.canUndo);
        setCanRedo(customEvent.detail.canRedo);
      }
    };

    window.addEventListener("plaza-style-history-changed", handleHistoryUpdate);
    return () => {
      window.removeEventListener(
        "plaza-style-history-changed",
        handleHistoryUpdate,
      );
    };
  }, []);

  // 2. Обновление токена из визуального контрола (слайдер / пикер / инпут)
  const handleUpdateTokenValue = useCallback(
    async (tokenName: string, nextValue: string) => {
      const currentFullScss = scssRef.current;
      const nextFullScss = updateTokenInScss(
        currentFullScss,
        tokenName,
        nextValue,
      );

      setGlobalScss(nextFullScss);
      const rootInfo = extractRootBlock(nextFullScss);
      if (rootInfo) {
        setRootText(rootInfo.rootText);
        setTokens(parseTokensFromRootText(rootInfo.rootText));
      }

      try {
        await saveGlobalScss(nextFullScss);
        styleHistory.record(nextFullScss);
        window.dispatchEvent(
          new CustomEvent("plaza-styles-updated", { detail: nextFullScss }),
        );
        void syncColorsFromScssToDb(nextFullScss);
      } catch (err) {
        console.error("[useTokensManager] Save error:", err);
      }
    },
    [],
  );

  // 3. Изменение текста :root напрямую в Monaco Editor
  const handleMonacoRootChange = useCallback(
    async (newRootText: string) => {
      setRootText(newRootText);
      const parsed = parseTokensFromRootText(newRootText);
      setTokens(parsed);

      const currentFullScss = scssRef.current;
      const nextFullScss = replaceRootInScss(currentFullScss, newRootText);
      setGlobalScss(nextFullScss);

      try {
        await saveGlobalScss(nextFullScss);
        styleHistory.record(nextFullScss);
        window.dispatchEvent(
          new CustomEvent("plaza-styles-updated", { detail: nextFullScss }),
        );
        void syncColorsFromScssToDb(nextFullScss);
      } catch (err) {
        console.error("[useTokensManager] Monaco sync error:", err);
      }
    },
    [],
  );

  // 4. Ручное сохранение
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const currentFullScss = scssRef.current;
      await saveGlobalScss(currentFullScss);
      styleHistory.record(currentFullScss);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: currentFullScss }),
      );
      void syncColorsFromScssToDb(currentFullScss);

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 800);
    } catch (err) {
      console.error("[useTokensManager] Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Undo / Redo
  const handleUndo = async () => {
    const prev = styleHistory.undo();
    if (prev !== null) {
      setGlobalScss(prev);
      const rootInfo = extractRootBlock(prev);
      const rText = rootInfo ? rootInfo.rootText : ":root {\n}";
      setRootText(rText);
      setTokens(parseTokensFromRootText(rText));

      await saveGlobalScss(prev);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: prev }),
      );
      void syncColorsFromScssToDb(prev);
    }
  };

  const handleRedo = async () => {
    const next = styleHistory.redo();
    if (next !== null) {
      setGlobalScss(next);
      const rootInfo = extractRootBlock(next);
      const rText = rootInfo ? rootInfo.rootText : ":root {\n}";
      setRootText(rText);
      setTokens(parseTokensFromRootText(rText));

      await saveGlobalScss(next);
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: next }),
      );
      void syncColorsFromScssToDb(next);
    }
  };

  // 6. Очистить все токены :root
  const handleClearAllTokens = async () => {
    await handleMonacoRootChange(":root {\n}");
  };

  const filteredTokens = tokens.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  return {
    rootText,
    tokens: filteredTokens,
    totalTokensCount: tokens.length,
    searchQuery,
    setSearchQuery,
    isSaving,
    isSaved,
    canUndo,
    canRedo,
    handleUpdateTokenValue,
    handleMonacoRootChange,
    handleSave,
    handleUndo,
    handleRedo,
    handleClearAllTokens,
  };
}
