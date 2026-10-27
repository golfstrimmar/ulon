"use client";

import { useSyncExternalStore, useEffect } from "react";
import {
  type BreakpointId,
  type BreakpointItem,
  BREAKPOINTS,
} from "@/app/plaza/components/PreviewArea/types/breakpoints";

export interface BreakpointState {
  activeId: BreakpointId;
  customWidth: number | null;
  isRotated: boolean;
}

const STORAGE_KEY = "plaza_preview_breakpoint";

const DEFAULT_STATE: BreakpointState = {
  activeId: "full",
  customWidth: null,
  isRotated: false,
};

let currentState: BreakpointState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function updateState(partial: Partial<BreakpointState>) {
  currentState = { ...currentState, ...partial };
  notify();

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.error(e);
    }
  }
}

// Загрузка из localStorage
let isInitialized = false;
function initFromStorage() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.activeId === "string") {
        currentState = {
          activeId: parsed.activeId,
          customWidth:
            typeof parsed.customWidth === "number" ? parsed.customWidth : null,
          isRotated: Boolean(parsed.isRotated),
        };
        notify();
      }
    }
  } catch (e) {
    console.error(e);
  }
}

export function useBreakpoint() {
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
    initFromStorage();
  }, []);

  const activeBreakpoint: BreakpointItem =
    state.activeId === "custom"
      ? {
          id: "custom",
          name: "Custom",
          label: "Custom",
          width: state.customWidth || 800,
          icon: "⚙️",
          tooltip: `Пользовательское разрешение (${state.customWidth || 800}px)`,
          mediaQuery: `${state.customWidth || 800}px`,
          deviceType: "Пользовательское",
        }
      : BREAKPOINTS.find((b) => b.id === state.activeId) || BREAKPOINTS[0];

  // Рассчитываем итоговую ширину (число или "100%")
  let effectiveWidth: number | "100%" = "100%";

  if (state.activeId === "custom") {
    effectiveWidth = state.customWidth || 800;
  } else if (state.activeId !== "full") {
    if (state.isRotated && activeBreakpoint.rotatedWidth) {
      effectiveWidth = activeBreakpoint.rotatedWidth;
    } else {
      effectiveWidth = activeBreakpoint.width;
    }
  }

  const effectiveWidthStyle =
    effectiveWidth === "100%" ? "100%" : `${effectiveWidth}px`;

  const selectBreakpoint = (id: BreakpointId) => {
    updateState({
      activeId: id,
      customWidth: id === "custom" ? currentState.customWidth || 800 : null,
      isRotated: false,
    });
  };

  const setCustomWidth = (width: number) => {
    const clamped = Math.max(280, Math.min(3840, Math.round(width)));
    updateState({
      activeId: "custom",
      customWidth: clamped,
      isRotated: false,
    });
  };

  const toggleRotate = () => {
    updateState({
      isRotated: !currentState.isRotated,
    });
  };

  return {
    activeId: state.activeId,
    activeBreakpoint,
    customWidth: state.customWidth,
    isRotated: state.isRotated,
    isFullWidth: state.activeId === "full",
    effectiveWidth,
    effectiveWidthStyle,
    selectBreakpoint,
    setCustomWidth,
    toggleRotate,
    breakpoints: BREAKPOINTS,
  };
}
