"use client";

import { useState, useEffect } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import {
  getHtmlJson,
  saveHtmlJson,
  deleteHtmlJson,
  getGlobalScss,
  saveGlobalScss,
  getGlobalJs,
  saveGlobalJs,
} from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import {
  extractStylesAndScriptsFromNodes,
  mergeScssWithoutDuplicates,
  mergeScriptsWithoutDuplicates,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";

function ensureUniqueKeys(nodes: HtmlNode[]): HtmlNode[] {
  return nodes.map((node) => ({
    ...node,
    _key: `${node.tag || "node"}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    children: Array.isArray(node.children)
      ? ensureUniqueKeys(node.children)
      : node.children,
  }));
}

export function useAsideCanvas() {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [hasNodes, setHasNodes] = useState(false);
  // Синхронизируем наличие нод (чтобы кнопка Clear знала, когда отображаться)
  useEffect(() => {
    const checkTree = async () => {
      const data = await getHtmlJson(DB_KEY).catch(() => null);
      setHasNodes(Boolean(data && Array.isArray(data) && data.length > 0));
    };
    checkTree();

    const handleTreeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const nodes = Array.isArray(customEvent.detail)
        ? customEvent.detail
        : customEvent.detail?.nodes;
      setHasNodes(Boolean(nodes && nodes.length > 0));
    };

    window.addEventListener("plaza-tree-updated", handleTreeChange);
    return () =>
      window.removeEventListener("plaza-tree-updated", handleTreeChange);
  }, []);

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  };

  // Команды, управляющие деревом из сайдбара
  const handleClear = async () => {
    await deleteHtmlJson(DB_KEY);
    setHasNodes(false);
    window.dispatchEvent(
      new CustomEvent("plaza-tree-updated", {
        detail: { nodes: [], source: "aside-canvas" },
      }),
    );
  };

  const handleAppendFromPath = async (path: string) => {
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const raw = await res.json();
      const nodes: HtmlNode[] = Array.isArray(raw) ? raw : [raw];

      const { cleanNodes, extractedScss, extractedScripts } =
        extractStylesAndScriptsFromNodes(nodes);

      // 1. Стили
      if (extractedScss) {
        const currentScss = (await getGlobalScss().catch(() => "")) || "";
        const nextScss = mergeScssWithoutDuplicates(currentScss, extractedScss);
        if (nextScss !== currentScss) {
          await saveGlobalScss(nextScss);
          window.dispatchEvent(
            new CustomEvent("plaza-styles-updated", { detail: nextScss }),
          );
        }
      }

      // 2. Скрипты
      if (extractedScripts.length > 0) {
        const currentJs = (await getGlobalJs().catch(() => "")) || "";
        const nextBundle = mergeScriptsWithoutDuplicates(
          currentJs,
          extractedScripts,
        );
        if (nextBundle !== currentJs) {
          await saveGlobalJs(nextBundle);
          window.dispatchEvent(
            new CustomEvent("plaza-scripts-updated", { detail: nextBundle }),
          );
        }
      }

      // 3. Добавление элементов в базу и оповещение холста
      const currentTree = (await getHtmlJson(DB_KEY).catch(() => [])) || [];
      const treeList = Array.isArray(currentTree) ? currentTree : [currentTree];

      const nodesWithUniqueKeys = ensureUniqueKeys(cleanNodes);
      const nextTree = [...treeList, ...nodesWithUniqueKeys];

      await saveHtmlJson(DB_KEY, nextTree);
      setHasNodes(true);

      // Генерируем событие — холст мгновенно отрисует!
      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes: nextTree, source: "aside-canvas" },
        }),
      );
    } catch (e) {
      console.error(`Error adding from ${path}:`, e);
    }
  };

  // Кнопки Undo/Redo/Collapse сайдбар может просто триггерить через системные события
  const triggerUndo = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
    );
  };

  const triggerRedo = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "y", ctrlKey: true }),
    );
  };

  const triggerCollapseAll = () => {
    window.dispatchEvent(new CustomEvent("plaza-toggle-collapse-all"));
  };

  return {
    openFolders,
    hasNodes,
    toggleFolder,
    handleClear,
    handleAppendFromPath,
    triggerUndo,
    triggerRedo,
    triggerCollapseAll,
  };
}
