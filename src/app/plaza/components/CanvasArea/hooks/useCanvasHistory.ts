"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";

interface UseCanvasHistoryOptions {
  currentJsonRef: React.MutableRefObject<HtmlNode[]>;
  setCurrentJson: (nodes: HtmlNode[]) => void;
  saveToStorage: (nodes: HtmlNode[]) => Promise<void>;
}

export function useCanvasHistory({
  currentJsonRef,
  setCurrentJson,
  saveToStorage,
}: UseCanvasHistoryOptions) {
  const historyRef = useRef<HtmlNode[][]>([]);
  const futureRef = useRef<HtmlNode[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const recordSnapshot = useCallback((tree: HtmlNode[]) => {
    const snapshot = JSON.parse(JSON.stringify(tree));
    historyRef.current = [...historyRef.current.slice(-49), snapshot];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const restoreState = useCallback(
    async (targetTree: HtmlNode[]) => {
      setCurrentJson(targetTree);
      currentJsonRef.current = targetTree;
      await saveToStorage(targetTree);
      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes: targetTree, source: "canvas-area" },
        }),
      );
    },
    [currentJsonRef, saveToStorage, setCurrentJson],
  );

  const handleUndo = useCallback(async () => {
    if (historyRef.current.length === 0) return;
    const previousState = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [
      JSON.parse(JSON.stringify(currentJsonRef.current)),
      ...futureRef.current,
    ];
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    await restoreState(previousState);
  }, [currentJsonRef, restoreState]);

  const handleRedo = useCallback(async () => {
    if (futureRef.current.length === 0) return;
    const nextState = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [
      ...historyRef.current.slice(-49),
      JSON.parse(JSON.stringify(currentJsonRef.current)),
    ];
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
    await restoreState(nextState);
  }, [currentJsonRef, restoreState]);

  // Слушатель горячих клавиш (Ctrl+Z / Ctrl+Y / Cmd+Z / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      const key = e.key.toLowerCase();
      if ((key === "z" || key === "я") && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((key === "z" || key === "я") && e.shiftKey) ||
        key === "y" ||
        key === "н"
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  return {
    canUndo,
    canRedo,
    recordSnapshot,
    handleUndo,
    handleRedo,
  };
}
