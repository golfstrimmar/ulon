"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export const HIGHLIGHT_STYLE_ID = "plaza-highlight-style";
export const HIGHLIGHT_CSS = `
  .plaza-node-selected {
    outline: 3px solid rgba(239, 68, 68, 0.95) !important;
    outline-offset: -1px !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3) !important;
    position: relative;
    z-index: 50 !important;
  }
  .plaza-node-hovered:not(.plaza-node-selected) {
    outline: 2px dashed rgba(52, 211, 153, 0.9) !important;
    outline-offset: -1px !important;
    box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.25) !important;
    position: relative;
    z-index: 40 !important;
  }
`;

export interface SelectionPayload {
  key?: string | null;
  className?: string;
  tag?: string;
  text?: string;
}

interface UsePreviewHighlightOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  srcDoc: string;
}

export function usePreviewHighlight({
  iframeRef,
  srcDoc,
}: UsePreviewHighlightOptions) {
  const [activeSelection, setActiveSelection] =
    useState<SelectionPayload | null>(null);
  const activeSelectionRef = useRef<SelectionPayload | null>(null);
  activeSelectionRef.current = activeSelection;

  const ensureStylesInjected = useCallback((doc: Document) => {
    if (!doc.getElementById(HIGHLIGHT_STYLE_ID)) {
      const styleEl = doc.createElement("style");
      styleEl.id = HIGHLIGHT_STYLE_ID;
      styleEl.textContent = HIGHLIGHT_CSS;
      (doc.head || doc.body).appendChild(styleEl);
    }
  }, []);

  const applyHighlight = useCallback(
    (payload: SelectionPayload | null) => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc || !doc.body) return;

      ensureStylesInjected(doc);

      doc.querySelectorAll(".plaza-node-selected").forEach((el) => {
        el.classList.remove("plaza-node-selected");
      });

      if (!payload) return;

      let targetEl: Element | null = null;
      if (payload.key) {
        targetEl = doc.querySelector(`[data-node-key="${payload.key}"]`);
      }

      if (!targetEl && payload.className) {
        const classes = payload.className
          .trim()
          .split(/\s+/)
          .map((c) => c.replace(/^\./, "").trim())
          .filter(Boolean);

        if (classes.length > 0) {
          const selector = `${payload.tag || ""}.${classes[0]}`.trim();
          const candidates = Array.from(doc.querySelectorAll(selector));

          if (candidates.length === 1) {
            targetEl = candidates[0];
          } else if (candidates.length > 1) {
            targetEl =
              candidates.find((el) =>
                payload.text
                  ? el.textContent?.trim().includes(payload.text.trim())
                  : false,
              ) || candidates[0];
          }
        }
      }

      if (targetEl) {
        targetEl.classList.remove("plaza-node-hovered");
        targetEl.classList.add("plaza-node-selected");
      }
    },
    [iframeRef, ensureStylesInjected],
  );

  // Hover sync from canvas
  useEffect(() => {
    const handlePlazaNodeHovered = (event: Event) => {
      const customEvent = event as CustomEvent<string | null>;
      const key = customEvent.detail;
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc || !doc.body) return;

      ensureStylesInjected(doc);

      doc.querySelectorAll(".plaza-node-hovered").forEach((el) => {
        el.classList.remove("plaza-node-hovered");
      });

      if (!key || activeSelectionRef.current?.key === key) return;

      const targetEl = doc.querySelector(`[data-node-key="${key}"]`);
      if (targetEl && !targetEl.classList.contains("plaza-node-selected")) {
        targetEl.classList.add("plaza-node-hovered");
      }
    };

    window.addEventListener("plaza-node-hovered", handlePlazaNodeHovered);
    return () => {
      window.removeEventListener("plaza-node-hovered", handlePlazaNodeHovered);
    };
  }, [iframeRef, ensureStylesInjected]);

  // Selection sync from canvas/modal
  useEffect(() => {
    const handleNodeSelected = (e: CustomEvent<SelectionPayload>) => {
      setActiveSelection(e.detail || null);
      applyHighlight(e.detail || null);
    };

    const handleNodeDeselected = () => {
      setActiveSelection(null);
      applyHighlight(null);
    };

    window.addEventListener(
      "plaza-node-selected",
      handleNodeSelected as EventListener,
    );
    window.addEventListener("plaza-node-deselected", handleNodeDeselected);

    return () => {
      window.removeEventListener(
        "plaza-node-selected",
        handleNodeSelected as EventListener,
      );
      window.removeEventListener("plaza-node-deselected", handleNodeDeselected);
    };
  }, [applyHighlight]);

  useEffect(() => {
    applyHighlight(activeSelectionRef.current);
  }, [srcDoc, applyHighlight]);

  // Iframe click interceptor
  const initHighlighting = useCallback(
    (doc: Document) => {
      applyHighlight(activeSelectionRef.current);

      const handleDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || target === doc.body || target === doc.documentElement) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const nodeEl = target.closest<HTMLElement>("[data-node-key]") || target;
        const key = nodeEl.getAttribute("data-node-key") || null;

        const payload: SelectionPayload = {
          key,
          tag: nodeEl.tagName.toLowerCase(),
          className: nodeEl.className || "",
          text: nodeEl.textContent?.trim() || "",
        };

        nodeEl.classList.remove("plaza-node-hovered");
        setActiveSelection(payload);
        applyHighlight(payload);

        window.dispatchEvent(
          new CustomEvent("plaza-node-selected", { detail: payload }),
        );
      };

      doc.addEventListener("click", handleDocClick);
      return () => doc.removeEventListener("click", handleDocClick);
    },
    [applyHighlight],
  );

  const clearSelection = useCallback(() => {
    setActiveSelection(null);
    applyHighlight(null);
  }, [applyHighlight]);

  return {
    initHighlighting,
    clearSelection,
    activeSelection,
  };
}
