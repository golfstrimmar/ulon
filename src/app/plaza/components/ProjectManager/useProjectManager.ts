"use client";

import { useState, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  saveHtmlJson,
  saveGlobalScss,
  saveGlobalJs,
  getHtmlJson,
  getGlobalScss,
  getGlobalJs,
} from "@/lib/htmlStorage";
import { DB_KEY } from "@/app/plaza/components/CanvasArea/constants/theme";
import {
  ensureUniqueKeys,
  mergeScssWithoutDuplicates,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import type { FolderItem } from "./projectManager.types";
import {
  getFoldersAction,
  createFolderAction,
  renameFolderAction,
  deleteFolderAction,
  saveProjectAction,
  loadProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from "./projectManager.actions";

export interface ActiveCloudProject {
  id: string;
  name: string;
  folderId: string;
}

let globalActiveProject: ActiveCloudProject | null = null;
const activeProjectListeners = new Set<() => void>();

function notifyActiveProjectChange() {
  activeProjectListeners.forEach((fn) => fn());
}

export function useProjectManager() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeCloudProject, setActiveCloudProject] =
    useState<ActiveCloudProject | null>(globalActiveProject);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const listener = () => setActiveCloudProject(globalActiveProject);
    activeProjectListeners.add(listener);
    return () => {
      activeProjectListeners.delete(listener);
    };
  }, []);

  const setGlobalActive = (proj: ActiveCloudProject | null) => {
    globalActiveProject = proj;
    setActiveCloudProject(proj);
    notifyActiveProjectChange();
  };

  // ─── Загрузка списка папок ───
  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await getFoldersAction();
      if (!res.success) throw new Error(res.error);

      const list = res.folders || [];
      setFolders(list);

      if (!activeFolderId && list.length > 0) {
        if (globalActiveProject?.folderId) {
          setActiveFolderId(globalActiveProject.folderId);
        } else {
          setActiveFolderId(list[0].id);
        }
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to load folders");
    } finally {
      setIsLoading(false);
    }
  }, [activeFolderId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // ─── Папки ───
  const createFolder = async (name: string): Promise<boolean> => {
    setActionError(null);
    try {
      const res = await createFolderAction(name);
      if (!res.success) throw new Error(res.error);

      await fetchFolders();
      if (res.folder?.id) setActiveFolderId(res.folder.id);
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
    try {
      const res = await renameFolderAction(id, newName);
      if (!res.success) throw new Error(res.error);
      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  const deleteFolder = async (id: string): Promise<boolean> => {
    try {
      const res = await deleteFolderAction(id);
      if (!res.success) throw new Error(res.error);

      if (activeFolderId === id) setActiveFolderId(null);
      if (globalActiveProject?.folderId === id) setGlobalActive(null);
      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  // ─── Сохранить как НОВЫЙ проект ───
  const saveCurrentCanvasAsProject = async (
    name: string,
    targetFolderId: string,
  ): Promise<boolean> => {
    setIsSaving(true);
    setActionError(null);

    try {
      const currentJson = useCanvasStore.getState().currentJson;
      const [currentScss, currentJs] = await Promise.all([
        getGlobalScss().catch(() => ""),
        getGlobalJs().catch(() => ""),
      ]);

      const res = await saveProjectAction({
        name,
        folderId: targetFolderId,
        htmlJson: currentJson,
        scss: currentScss,
        js: currentJs,
      });

      if (!res.success) throw new Error(res.error);

      setGlobalActive({
        id: res.project.id,
        name: res.project.name,
        folderId: res.project.folderId,
      });

      await fetchFolders();
      useCanvasStore
        .getState()
        .showHud(`Project «${name}» saved to Neon DB!`, "success");
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── ОБНОВИТЬ / ПЕРЕЗАПИСАТЬ СУЩЕСТВУЮЩИЙ ПРОЕКТ ───
  const updateProjectWithCurrentCanvas = async (
    projectId: string,
    customName?: string,
  ): Promise<boolean> => {
    setIsSaving(true);
    setActionError(null);

    try {
      // 🎯 Читаем текущую версию напрямую из локальной базы IndexedDB
      const [dbJson, currentScss, currentJs] = await Promise.all([
        getHtmlJson(DB_KEY).catch(() => null),
        getGlobalScss().catch(() => ""),
        getGlobalJs().catch(() => ""),
      ]);

      const currentJson =
        dbJson && Array.isArray(dbJson)
          ? dbJson
          : dbJson
            ? [dbJson]
            : useCanvasStore.getState().currentJson;

      const res = await updateProjectAction(projectId, {
        name: customName,
        htmlJson: currentJson,
        scss: currentScss,
        js: currentJs,
      });

      if (!res.success) throw new Error(res.error);

      if (customName && globalActiveProject?.id === projectId) {
        setGlobalActive({ ...globalActiveProject, name: customName.trim() });
      }

      await fetchFolders();
      useCanvasStore
        .getState()
        .showHud(`Project updated in Neon DB!`, "success");
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── 🚀 ДОБАВИТЬ ПРОЕКТ ИЗ БАЗЫ В КОНЕЦ ТЕКУЩЕГО ХОЛСТА (БЕЗ ПЕРЕЗАТИРАНИЯ) ───
  const loadProjectToCanvas = async (projectId: string): Promise<boolean> => {
    setIsLoading(true);
    setActionError(null);

    try {
      const res = await loadProjectAction(projectId);
      if (!res.success || !res.project)
        throw new Error(res.error || "Failed to load");

      const project = res.project;
      const incomingRawNodes = Array.isArray(project.htmlJson)
        ? project.htmlJson
        : [];
      const incomingScss = (project.scss || "").trim();
      const incomingJs = (project.js || "").trim();

      // 1. Гарантируем уникальные ключи для входящих нод (исключаем коллизии с уже стоящими на холсте)
      const incomingNodes = ensureUniqueKeys(incomingRawNodes);

      // 2. 🎯 ДОБАВЛЯЕМ В КОНЕЦ: объединяем текущее дерево с новыми нодами
      const currentTree = useCanvasStore.getState().currentJson;
      const nextTree = [...currentTree, ...incomingNodes];

      // 3. Берем текущие стили и скрипты и объединяем их без дубликатов
      const [currentScss, currentJs] = await Promise.all([
        getGlobalScss().catch(() => ""),
        getGlobalJs().catch(() => ""),
      ]);

      const nextScss = incomingScss
        ? mergeScssWithoutDuplicates(currentScss, incomingScss)
        : currentScss;

      const nextJs =
        incomingJs && !currentJs.includes(incomingJs)
          ? `${currentJs ? `${currentJs}\n\n` : ""}${incomingJs}`
          : currentJs;

      // 4. Обновляем Zustand стор и локальную базу IndexedDB объединенными данными
      useCanvasStore.getState().setCurrentJson(nextTree);

      await Promise.all([
        saveHtmlJson(DB_KEY, nextTree),
        saveGlobalScss(nextScss),
        saveGlobalJs(nextJs),
      ]);

      // 5. Запоминаем проект как активный в рабочей сессии
      setGlobalActive({
        id: project.id,
        name: project.name,
        folderId: project.folderId,
      });

      // 6. Оповещаем все компоненты и iframe превью об обновлении
      window.dispatchEvent(
        new CustomEvent("plaza-tree-updated", {
          detail: { nodes: nextTree, source: "project-manager" },
        }),
      );

      if (nextScss !== currentScss) {
        window.dispatchEvent(
          new CustomEvent("plaza-styles-updated", { detail: nextScss }),
        );
      }
      if (nextJs !== currentJs) {
        window.dispatchEvent(
          new CustomEvent("plaza-scripts-updated", { detail: nextJs }),
        );
      }

      useCanvasStore
        .getState()
        .showHud(
          `Appended: «${project.name}» (${incomingNodes.length} nodes)`,
          "success",
        );
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Переименование и удаление ───
  const renameProject = async (
    id: string,
    newName: string,
  ): Promise<boolean> => {
    try {
      const res = await updateProjectAction(id, { name: newName });
      if (!res.success) throw new Error(res.error);

      if (globalActiveProject?.id === id) {
        setGlobalActive({ ...globalActiveProject, name: newName.trim() });
      }

      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  const deleteProject = async (id: string): Promise<boolean> => {
    try {
      const res = await deleteProjectAction(id);
      if (!res.success) throw new Error(res.error);

      if (globalActiveProject?.id === id) setGlobalActive(null);
      await fetchFolders();
      return true;
    } catch (err: any) {
      setActionError(err.message);
      return false;
    }
  };

  const unlinkActiveProject = () => setGlobalActive(null);

  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;

  return {
    folders,
    activeFolder,
    activeFolderId,
    setActiveFolderId,
    activeCloudProject,
    isLoading,
    isSaving,
    actionError,
    fetchFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    saveCurrentCanvasAsProject,
    updateProjectWithCurrentCanvas,
    loadProjectToCanvas,
    renameProject,
    deleteProject,
    unlinkActiveProject,
  };
}
