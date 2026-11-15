"use client";

import { useState, useCallback } from "react";
import {
  toggleFolderInSet,
  hasTreeNodes,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

export function useAsideCanvas() {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const hasNodes = useCanvasStore((s) => hasTreeNodes(s.currentJson));

  const toggleFolder = useCallback((folderName: string) => {
    setOpenFolders((prev) => toggleFolderInSet(prev, folderName));
  }, []);

  const handleClear = useCallback(async () => {
    await useCanvasStore.getState().clearCanvasTree();
  }, []);

  const handleAppendFromPath = useCallback(async (path: string) => {
    await useCanvasStore.getState().appendNodesFromPath(path);
  }, []);

  const triggerUndo = useCallback(() => {
    void useCanvasStore.getState().undo();
  }, []);

  const triggerRedo = useCallback(() => {
    void useCanvasStore.getState().redo();
  }, []);

  const triggerCollapseAll = useCallback(() => {
    useCanvasStore.getState().toggleCollapseAll();
  }, []);

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
