"use client";

import { useState, useEffect, useRef } from "react";
import type { HtmlNode } from "@/types/HtmlNode";
import { findNodeByKey, updateNodeByKey } from "@/lib/htmlTree";
import {
  getGlobalScss,
  saveGlobalScss,
  getGlobalJs,
  saveGlobalJs,
} from "@/lib/htmlStorage";
import {
  mergeScriptsWithoutDuplicates,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { styleHistory } from "@/lib/styleHistory";
import { scriptsHistory } from "@/lib/scriptsHistory";

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface UseModalNodePropertiesOptions {
  /** Ключ выбранной ноды (из useCanvasArea) */
  clickedKey: string | null;
  /** Текущее дерево нод (из useCanvasArea) */
  currentJson: HtmlNode[];
  /** Сохранить и распространить новое дерево (из useCanvasArea) */
  persist: (next: HtmlNode[]) => Promise<void>;
}

// ─── Хук ─────────────────────────────────────────────────────────────────────

export function useModalNodeProperties({
  clickedKey,
  currentJson,
  persist,
}: UseModalNodePropertiesOptions) {
  // ref-копия для использования внутри замыканий без пересоздания эффектов
  const currentJsonRef = useRef<HtmlNode[]>(currentJson);
  currentJsonRef.current = currentJson;

  // ── Поля редактирования ───────────────────────────────────────────────────
  const [editTag, setEditTag] = useState<string>("div");
  const [editClass, setEditClass] = useState<string>("");
  const [editText, setEditText] = useState<string>("");

  // ── Глобальные стили / скрипты ────────────────────────────────────────────
  const [globalScss, setGlobalScss] = useState<string>("");
  const globalScssRef = useRef<string>("");
  globalScssRef.current = globalScss;

  const [globalJs, setGlobalJs] = useState<string>("");
  const globalJsRef = useRef<string>("");
  globalJsRef.current = globalJs;

  // ── Загрузка глобальных стилей/скриптов при монтировании ─────────────────
  useEffect(() => {
    Promise.all([
      getGlobalScss().catch(() => ""),
      getGlobalJs().catch(() => ""),
    ]).then(([scss, js]) => {
      setGlobalScss(scss || "");
      globalScssRef.current = scss || "";
      setGlobalJs(js || "");
      globalJsRef.current = js || "";
    });
  }, []);

  // ── Слушаем обновления стилей / скриптов из шины событий ─────────────────
  useEffect(() => {
    const handleStyles = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      const next = typeof detail === "string" ? detail : "";
      setGlobalScss(next);
      globalScssRef.current = next;
    };
    const handleScripts = (e: Event) => {
      const detail = (e as CustomEvent<string | Record<string, string>>).detail;
      const next =
        typeof detail === "string"
          ? detail
          : detail && typeof detail === "object"
            ? (detail as any).__bundle__ ??
              Object.values(detail).join("\n\n")
            : "";
      setGlobalJs(next);
      globalJsRef.current = next;
    };

    window.addEventListener("plaza-styles-updated", handleStyles);
    window.addEventListener("plaza-scripts-updated", handleScripts);
    return () => {
      window.removeEventListener("plaza-styles-updated", handleStyles);
      window.removeEventListener("plaza-scripts-updated", handleScripts);
    };
  }, []);

  // ── Находим выбранную ноду ────────────────────────────────────────────────
  let selectedNode: HtmlNode | null = null;
  if (clickedKey) {
    for (const root of currentJson) {
      const found = findNodeByKey(root, clickedKey);
      if (found) {
        selectedNode = found;
        break;
      }
    }
  }

  // ── Синхронизируем поля при смене выбранной ноды ─────────────────────────
  useEffect(() => {
    if (selectedNode) {
      setEditTag(selectedNode.tag || "div");
      setEditClass(selectedNode.class || "");
      setEditText(selectedNode.text || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedKey, selectedNode?._key]);

  // ─── Обработчики ─────────────────────────────────────────────────────────

  const handleSaveNodeField = async (
    field: "tag" | "class" | "text" | "attributes",
    value: any,
  ) => {
    if (!clickedKey) return;
    const patch: Partial<HtmlNode> = { [field]: value };
    const next = currentJsonRef.current.map((root) =>
      updateNodeByKey(root, clickedKey, patch),
    );
    await persist(next);
  };

  const handleSaveScriptJs = async (targetName: string, jsCode: string) => {
    const nextBundle = mergeScriptsWithoutDuplicates(globalJsRef.current, [
      { name: targetName, code: jsCode },
    ]);
    await updateAndPersistJs(nextBundle);
  };

  const handleAddClassToNode = async (newCls: string) => {
    const clean = newCls.trim().replace(/^\./, "");
    if (!clean || !clickedKey || !selectedNode) return;

    const source = editClass !== undefined && editClass !== null ? editClass : selectedNode.class || "";
    const currentClasses = source
      .split(/\s+/)
      .filter(Boolean);
    if (!currentClasses.includes(clean)) {
      const updatedClassStr = [...currentClasses, clean].join(" ");
      setEditClass(updatedClassStr);
      await handleSaveNodeField("class", updatedClassStr);
    }
  };

  const updateAndPersistScss = async (nextScss: string) => {
    try {
      styleHistory.record(nextScss);
      await saveGlobalScss(nextScss);
      setGlobalScss(nextScss);
      globalScssRef.current = nextScss;
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: nextScss }),
      );
    } catch (e) {
      console.error("[useModalNodeProperties] Error saving SCSS:", e);
    }
  };

  const updateAndPersistJs = async (nextJs: string) => {
    try {
      scriptsHistory.record(nextJs);
      await saveGlobalJs(nextJs);
      setGlobalJs(nextJs);
      globalJsRef.current = nextJs;
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: nextJs }),
      );
    } catch (e) {
      console.error("[useModalNodeProperties] Error saving JS:", e);
    }
  };

  return {
    // Данные
    selectedNode,
    editTag,
    editClass,
    editText,
    globalScss,
    globalJs,
    // Сеттеры
    setEditTag,
    setEditClass,
    setEditText,
    // Действия
    handleSaveNodeField,
    handleSaveScriptJs,
    handleAddClassToNode,
    updateAndPersistScss,
  };
}
