"use client";

import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import {
  type BreakpointItem,
  BREAKPOINTS,
} from "@/app/plaza/components/PreviewArea/types/breakpoints";

export function useBreakpoint() {
  const activeId = useCanvasStore((s) => s.activeBreakpointId);
  const customWidth = useCanvasStore((s) => s.customBreakpointWidth);
  const isRotated = useCanvasStore((s) => s.isBreakpointRotated);
  const selectBreakpoint = useCanvasStore((s) => s.selectBreakpoint);
  const setCustomWidth = useCanvasStore((s) => s.setCustomBreakpointWidth);
  const toggleRotate = useCanvasStore((s) => s.toggleBreakpointRotate);

  const activeBreakpoint: BreakpointItem =
    activeId === "custom"
      ? {
          id: "custom",
          name: "Custom",
          label: "Custom",
          segment: `${customWidth || 800}px`,
          width: customWidth || 800,
          icon: "⚙️",
          tooltip: `Custom resolution (${customWidth || 800}px)`,
          mediaQuery: `${customWidth || 800}px`,
          deviceType: "Custom",
        }
      : BREAKPOINTS.find((b) => b.id === activeId) || BREAKPOINTS[0];

  let effectiveWidth: number | "100%" = "100%";

  if (activeId === "custom") {
    effectiveWidth = customWidth || 800;
  } else if (activeId !== "full") {
    if (isRotated && activeBreakpoint.rotatedWidth) {
      effectiveWidth = activeBreakpoint.rotatedWidth;
    } else {
      effectiveWidth = activeBreakpoint.width;
    }
  }

  const effectiveWidthStyle =
    effectiveWidth === "100%" ? "100%" : `${effectiveWidth}px`;

  return {
    activeId,
    activeBreakpoint,
    customWidth,
    isRotated,
    isFullWidth: activeId === "full",
    effectiveWidth,
    effectiveWidthStyle,
    selectBreakpoint,
    setCustomWidth,
    toggleRotate,
    breakpoints: BREAKPOINTS,
  };
}
