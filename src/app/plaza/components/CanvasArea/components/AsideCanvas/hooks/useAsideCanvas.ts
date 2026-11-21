"use client";

import { useState, useCallback, useMemo } from "react";
import {
  toggleFolderInSet,
  hasTreeNodes,
  findMarkerKeyInTree,
} from "@/app/plaza/components/CanvasArea/models/canvasModel";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";

export function useAsideCanvas() {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const currentJson = useCanvasStore((s) => s.currentJson);
  const keepMarkerAfterInsert = useCanvasStore((s) => s.keepMarkerAfterInsert);
  const isArmingMarker = useCanvasStore((s) => s.isArmingMarker);

  const hasNodes = useMemo(() => hasTreeNodes(currentJson), [currentJson]);
  const hasMarker = useMemo(
    () => Boolean(findMarkerKeyInTree(currentJson)),
    [currentJson],
  );

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

  const handleInsertMarker = useCallback(async () => {
    await useCanvasStore.getState().insertMarkerNode();
  }, []);

  const handleToggleArmMarker = useCallback(() => {
    useCanvasStore.getState().toggleArmingMarker();
  }, []);

  const handleRemoveMarker = useCallback(async () => {
    await useCanvasStore.getState().removeMarkerNode();
  }, []);

  const handleToggleKeepMarker = useCallback(() => {
    useCanvasStore.getState().toggleKeepMarkerAfterInsert();
  }, []);

  return {
    openFolders,
    hasNodes,
    hasMarker,
    isArmingMarker,
    keepMarkerAfterInsert,
    toggleFolder,
    handleClear,
    handleAppendFromPath,
    triggerUndo,
    triggerRedo,
    triggerCollapseAll,
    handleInsertMarker,
    handleToggleArmMarker,
    handleRemoveMarker,
    handleToggleKeepMarker,
  };
}
