"use client";

import { useRef, useEffect, useMemo } from "react";
import {
  getHtmlJson,
  getGlobalScss,
  getGlobalJs,
  saveGlobalScss,
  saveGlobalJs,
  saveHtmlJson,
} from "@/store/htmlStorage";
import {
  extractStylesAndScriptsFromNodes,
  mergeScssWithoutDuplicates,
  mergeScriptsWithoutDuplicates,
  ensureUniqueKeys,
  getAllCollapsibleKeys,
  findNodeByCriteria,
  isPointInsideElement,
  splitWorkspaceNodes,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import {
  saveColorVariables,
  extractColorVariablesFromScss,
} from "@/store/figmaColorStorage";
import { styleHistory } from "@/lib/styleHistory";
import { scriptsHistory } from "@/lib/scriptsHistory";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import { useCanvasDnD } from "./useCanvasDnD";
import { useCanvasMarquee } from "./useCanvasMarquee";

export function useCanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const currentJson = useCanvasStore((s) => s.currentJson);
  const isSplit = useCanvasStore((s) => s.isSplit);
  const rightKeys = useCanvasStore((s) => s.rightKeys);

  // ─────🔹 Контроллеры DnD и Marquee
  useCanvasDnD();
  const marquee = useCanvasMarquee({ containerRef });

  // ─────🔹 Разделение узлов на Pane 1 / Pane 2 в split-режиме
  const { leftNodes, rightNodes } = useMemo(
    () => splitWorkspaceNodes(currentJson, rightKeys, isSplit),
    [currentJson, rightKeys, isSplit],
  );

  // ─────🔹 Загрузка при монтировании
  const jsonDownload = async () => {
    try {
      const [dbScss, dbJs, data] = await Promise.all([
        getGlobalScss().catch(() => ""),
        getGlobalJs().catch(() => ""),
        getHtmlJson(DB_KEY).catch(() => null),
      ]);

      let currentScss = dbScss || "";
      let currentJs = dbJs || "";

      if (data) {
        const list = Array.isArray(data) ? data : [data];
        const { cleanNodes, extractedScss, extractedScripts } =
          extractStylesAndScriptsFromNodes(list);

        if (extractedScss) {
          currentScss = mergeScssWithoutDuplicates(currentScss, extractedScss);
        }
        if (extractedScripts.length > 0) {
          currentJs = mergeScriptsWithoutDuplicates(
            currentJs,
            extractedScripts,
          );
        }

        const nodesWithKeys = ensureUniqueKeys(cleanNodes);
        useCanvasStore.getState().setCurrentJson(nodesWithKeys);

        styleHistory.init(currentScss);
        scriptsHistory.init(currentJs);

        await Promise.all([
          saveGlobalScss(currentScss),
          saveGlobalJs(currentJs),
          saveHtmlJson(DB_KEY, nodesWithKeys),
        ]);
      } else {
        useCanvasStore.getState().setCurrentJson([]);
        styleHistory.init(currentScss);
        scriptsHistory.init(currentJs);

        await Promise.all([
          saveGlobalScss(currentScss),
          saveGlobalJs(currentJs),
        ]);
      }

      // Синхронизируем цвета из SCSS проекта в локальную базу цветов
      const scssColors = extractColorVariablesFromScss(currentScss);
      if (scssColors.length > 0) {
        await saveColorVariables(scssColors);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("figma_colors:saved", { detail: scssColors }),
          );
        }
      }
    } catch (err) {
      console.error("[useCanvasArea] Mount error:", err);
    }
  };

  useEffect(() => {
    jsonDownload();
  }, []);

  // ─────🔹 Перенос перетаскиваемых узлов между левой и правой панелями в split-режиме
  useEffect(() => {
    if (!isSplit) return;

    const handlePointerUp = (e: PointerEvent) => {
      const state = useCanvasStore.getState();
      const activeKeys = state.draggedKeys;
      if (activeKeys.length === 0) return;

      if (state.dropTarget?.position === "donor") {
        return;
      }

      if (isPointInsideElement(rightPaneRef.current, e.clientX, e.clientY)) {
        state.moveKeysToRightPane(activeKeys);
      } else if (
        isPointInsideElement(leftPaneRef.current, e.clientX, e.clientY)
      ) {
        state.moveKeysToLeftPane(activeKeys);
      }
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [isSplit]);

  // ─────🔹 Слушаем клики из PreviewArea
  useEffect(() => {
    const handleSelectFromPreview = (e: any) => {
      if (e.detail?.source === "modal-properties") return;

      const store = useCanvasStore.getState();
      const currentTree = store.currentJson;
      const target = findNodeByCriteria(currentTree, e.detail || {});

      if (store.armedDonorKey && target?._key) {
        void store.applyArmedDonorToTarget(target._key);
        return;
      }

      if (target && target._key !== store.clickedKey) {
        store.setClickedKey(target._key ?? null);
      }
    };

    window.addEventListener("plaza-node-selected", handleSelectFromPreview);
    return () =>
      window.removeEventListener(
        "plaza-node-selected",
        handleSelectFromPreview,
      );
  }, []);

  // ─────🔹 Внешние события обновления дерева и сворачивания
  useEffect(() => {
    const handleTreeUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.source === "canvas-area") return;

      const nodes = Array.isArray(customEvent.detail)
        ? customEvent.detail
        : customEvent.detail?.nodes;

      if (Array.isArray(nodes)) {
        const withKeys = ensureUniqueKeys(nodes);
        useCanvasStore.getState().setCurrentJson(withKeys);
      } else {
        jsonDownload();
      }
    };

    const handleExternalCollapseAll = () => {
      const allKeys = getAllCollapsibleKeys(
        useCanvasStore.getState().currentJson,
      );
      useCanvasStore.getState().collapseAll(allKeys);
    };

    window.addEventListener("plaza-tree-updated", handleTreeUpdated);
    window.addEventListener(
      "plaza-toggle-collapse-all",
      handleExternalCollapseAll,
    );

    return () => {
      window.removeEventListener("plaza-tree-updated", handleTreeUpdated);
      window.removeEventListener(
        "plaza-toggle-collapse-all",
        handleExternalCollapseAll,
      );
    };
  }, []);

  // ─────🔹 Хоткеи Undo / Redo (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        useCanvasStore.getState().undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        useCanvasStore.getState().redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    containerRef,
    leftPaneRef,
    rightPaneRef,
    leftNodes,
    rightNodes,
    handleMarqueePointerDown: marquee.handleMarqueePointerDown,
  };
}
