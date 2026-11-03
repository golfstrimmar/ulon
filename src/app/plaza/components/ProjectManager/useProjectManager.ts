"use client";

import { useState, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  saveHtmlJson,
  saveGlobalScss,
  saveGlobalJs,
  getGlobalScss,
  getGlobalJs,
} from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import type { FolderItem, FullProjectPayload } from "./projectManager.types";

export function useProjectManager() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Загрузка списка папок с бэкенда
  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/folders");
      if (!res.ok) throw new Error("Failed to load folders");
      const data = await res.json();
      setFolders(data.folders || []);

      // Если активная папка еще не выбрана — выбираем первую
      if (!activeFolderId && data.folders?.length > 0) {
        setActiveFolderId(data.folders[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, [activeFolderId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // ─── Операции с папками ───
  const createFolder = async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    setActionError(null);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create folder");

      await fetchFolders();
      setActiveFolderId(data.folder.id);
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  const renameFolder = async (
    id: string,
    newName: string,
  ): Promise<boolean> => {
    if (!newName.trim()) return false;
    try {
      const res = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename folder");
      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  const deleteFolder = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/folders?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete folder");
      if (activeFolderId === id) setActiveFolderId(null);
      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  // ─── Сохранение текущего холста в базу ───
  const saveCurrentCanvasAsProject = async (
    name: string,
    targetFolderId: string,
  ): Promise<boolean> => {
    if (!name.trim() || !targetFolderId) return false;
    setIsSaving(true);
    setActionError(null);

    try {
      // 1. Берем текущие данные холста, стилей и скриптов
      const currentJson = useCanvasStore.getState().currentJson;
      const [currentScss, currentJs] = await Promise.all([
        getGlobalScss().catch(() => ""),
        getGlobalJs().catch(() => ""),
      ]);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          folderId: targetFolderId,
          htmlJson: currentJson,
          scss: currentScss,
          js: currentJs,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save project");

      await fetchFolders();
      useCanvasStore
        .getState()
        .showHud(`Project «${name}» saved successfully!`, "success");
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Извлечение проекта из базы и применение на холст ───
  const loadProjectToCanvas = async (projectId: string): Promise<boolean> => {
    setIsLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      const { project }: { project: FullProjectPayload } = await res.json();

      const nodes = Array.isArray(project.htmlJson) ? project.htmlJson : [];
      const scss = project.scss || "";
      const js = project.js || "";

      // 1. Обновляем Zustand стор
      useCanvasStore.getState().setCurrentJson(nodes);
      useCanvasStore.getState().setRightKeys(new Set());

      // 2. Синхронизируем с локальной БД холста (IndexedDB)
      await Promise.all([
        saveHtmlJson(DB_KEY, nodes),
        saveGlobalScss(scss),
        saveGlobalJs(js),
      ]);

      // 3. Диспатчим события обновления холста и превью
      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes, source: "project-manager" },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("plaza-styles-updated", { detail: scss }),
      );
      window.dispatchEvent(
        new CustomEvent("plaza-scripts-updated", { detail: js }),
      );

      useCanvasStore.getState().showHud(`Loaded: «${project.name}»`, "success");
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Переименование и удаление проектов ───
  const renameProject = async (
    id: string,
    newName: string,
  ): Promise<boolean> => {
    if (!newName.trim()) return false;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename project");
      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  const deleteProject = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;

  return {
    folders,
    activeFolder,
    activeFolderId,
    setActiveFolderId,
    isLoading,
    isSaving,
    actionError,
    fetchFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    saveCurrentCanvasAsProject,
    loadProjectToCanvas,
    renameProject,
    deleteProject,
  };
}
