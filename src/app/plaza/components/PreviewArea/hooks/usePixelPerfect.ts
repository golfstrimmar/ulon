"use client";

import { useSyncExternalStore, useEffect, useRef } from "react";
import {
  getPixelPerfectSettings,
  savePixelPerfectSettings,
  clearPixelPerfectSettings,
  type PixelPerfectSettingsData,
} from "@/lib/htmlStorage";

export interface PixelPerfectState {
  image: string;
  fileName: string;
  imageWidth: number;
  imageHeight: number;
  previewOpacity: number; // 0 - 100
  overlayOpacity: number; // 0 - 100
  offsetX: number;
  offsetY: number;
  isVisible: boolean;
  align: "left" | "center";
  fitHeight: boolean;
  isModalOpen: boolean;
  isLoaded: boolean;
}

const DEFAULT_STATE: PixelPerfectState = {
  image: "",
  fileName: "",
  imageWidth: 0,
  imageHeight: 0,
  previewOpacity: 50,
  overlayOpacity: 100,
  offsetX: 0,
  offsetY: 0,
  isVisible: true,
  align: "left",
  fitHeight: true,
  isModalOpen: false,
  isLoaded: false,
};

let currentState: PixelPerfectState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function updateState(partial: Partial<PixelPerfectState>, saveToDb = true) {
  currentState = { ...currentState, ...partial };
  notify();

  if (saveToDb && typeof window !== "undefined") {
    debouncedSave();
  }
}

let saveTimeout: any = null;
function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      if (!currentState.image) {
        await clearPixelPerfectSettings();
      } else {
        await savePixelPerfectSettings({
          image: currentState.image,
          fileName: currentState.fileName,
          imageWidth: currentState.imageWidth,
          imageHeight: currentState.imageHeight,
          previewOpacity: currentState.previewOpacity,
          overlayOpacity: currentState.overlayOpacity,
          offsetX: currentState.offsetX,
          offsetY: currentState.offsetY,
          isVisible: currentState.isVisible,
          align: currentState.align,
          fitHeight: currentState.fitHeight,
        });
      }
    } catch (err) {
      console.error("[usePixelPerfect] Failed to save settings to IndexedDB:", err);
    }
  }, 250);
}

// Инициализация из базы данных (только один раз при клиенте)
let isDbInitStarted = false;
async function initFromDb() {
  if (isDbInitStarted || typeof window === "undefined") return;
  isDbInitStarted = true;

  try {
    const saved = await getPixelPerfectSettings();
    if (saved && saved.image) {
      updateState(
        {
          image: saved.image,
          fileName: saved.fileName || "",
          imageWidth: saved.imageWidth || 0,
          imageHeight: saved.imageHeight || 0,
          previewOpacity:
            typeof saved.previewOpacity === "number" ? saved.previewOpacity : 50,
          overlayOpacity:
            typeof saved.overlayOpacity === "number" ? saved.overlayOpacity : 100,
          offsetX: saved.offsetX || 0,
          offsetY: saved.offsetY || 0,
          isVisible: saved.isVisible !== undefined ? saved.isVisible : true,
          align: saved.align || "left",
          fitHeight: saved.fitHeight !== undefined ? saved.fitHeight : true,
          isLoaded: true,
        },
        false,
      );
    } else {
      updateState({ isLoaded: true }, false);
    }
  } catch (err) {
    console.error("[usePixelPerfect] Failed to load settings from IndexedDB:", err);
    updateState({ isLoaded: true }, false);
  }
}

export function usePixelPerfect() {
  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => currentState,
    () => DEFAULT_STATE,
  );

  useEffect(() => {
    initFromDb();
  }, []);

  const loadImageFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Пожалуйста, выберите файл изображения (PNG, JPG, WEBP, SVG)"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          updateState({
            image: dataUrl,
            fileName: file.name,
            imageWidth: img.naturalWidth,
            imageHeight: img.naturalHeight,
            // Если была 100%, поставим 50% для мгновенного эффекта сравнения
            previewOpacity:
              currentState.previewOpacity === 100 ? 50 : currentState.previewOpacity,
            isVisible: true,
          });
          resolve();
        };
        img.onerror = () => {
          updateState({
            image: dataUrl,
            fileName: file.name,
            imageWidth: 0,
            imageHeight: 0,
            previewOpacity:
              currentState.previewOpacity === 100 ? 50 : currentState.previewOpacity,
            isVisible: true,
          });
          resolve();
        };
        img.src = dataUrl;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = async () => {
    updateState(
      {
        image: "",
        fileName: "",
        imageWidth: 0,
        imageHeight: 0,
        offsetX: 0,
        offsetY: 0,
      },
      true,
    );
    try {
      await clearPixelPerfectSettings();
    } catch (e) {
      console.error(e);
    }
  };

  const setPreviewOpacity = (previewOpacity: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(previewOpacity)));
    updateState({ previewOpacity: clamped });
  };

  const setOverlayOpacity = (overlayOpacity: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(overlayOpacity)));
    updateState({ overlayOpacity: clamped });
  };

  const setOffsetX = (offsetX: number) => {
    updateState({ offsetX: Math.round(offsetX) });
  };

  const setOffsetY = (offsetY: number) => {
    updateState({ offsetY: Math.round(offsetY) });
  };

  const setIsVisible = (isVisible: boolean) => {
    updateState({ isVisible });
  };

  const toggleVisible = () => {
    updateState({ isVisible: !currentState.isVisible });
  };

  const setAlign = (align: "left" | "center") => {
    updateState({ align });
  };

  const setFitHeight = (fitHeight: boolean) => {
    updateState({ fitHeight });
  };

  const resetPosition = () => {
    updateState({ offsetX: 0, offsetY: 0 });
  };

  const setIsModalOpen = (isModalOpen: boolean) => {
    updateState({ isModalOpen }, false);
  };

  return {
    ...state,
    hasImage: Boolean(state.image),
    isOverlayActive: Boolean(state.image) && state.isVisible,
    loadImageFile,
    removeImage,
    setPreviewOpacity,
    setOverlayOpacity,
    setOffsetX,
    setOffsetY,
    setIsVisible,
    toggleVisible,
    setAlign,
    setFitHeight,
    resetPosition,
    setIsModalOpen,
  };
}
