"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BoxModelData } from "../components/BoxModelOverlay";
import { useCanvasStore } from "@/app/plaza/components/CanvasArea/store/useCanvasStore";
import { findNodeInTree } from "@/app/plaza/components/CanvasArea/models/canvasModel";

interface UseBoxModelHighlightOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function useBoxModelHighlight({
  iframeRef,
  containerRef,
}: UseBoxModelHighlightOptions) {
  const [boxModelData, setBoxModelData] = useState<BoxModelData | null>(null);
  const currentKeyRef = useRef<string | null>(null);
  const hoveredKey = useCanvasStore((s) => s.hoveredKey);
  const measureAndSetKey = useCallback(
    (key: string | null) => {
      currentKeyRef.current = key;

      if (!key) {
        setBoxModelData(null);
        return;
      }

      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!iframe || !doc || !doc.body) {
        setBoxModelData(null);
        return;
      }

      // 🔍 1. Прямой поиск по data-node-key
      let targetEl: Element | null = null;
      try {
        targetEl = doc.querySelector(`[data-node-key="${CSS.escape(key)}"]`);
      } catch {
        try {
          targetEl = doc.querySelector(`[data-node-key="${key}"]`);
        } catch {}
      }

      // 🔍 2. ФОЛЛБЭК: Если прямой ключ в HTML отсутствует, берем ноду из стора
      // и находим элемент в DOM превью по его классу или тегу с текстом!
      if (!targetEl) {
        const currentTree = useCanvasStore.getState().currentJson;
        const matchedNode = findNodeInTree(currentTree, key);

        if (matchedNode) {
          // Поиск по первому валидному классу ноды
          if (matchedNode.class) {
            const classes = matchedNode.class
              .trim()
              .split(/\s+/)
              .filter(Boolean);
            for (const cls of classes) {
              try {
                const el = doc.querySelector(`.${CSS.escape(cls)}`);
                if (el) {
                  targetEl = el;
                  break;
                }
              } catch {}
            }
          }

          // Поиск по тегу и тексту
          if (!targetEl && matchedNode.tag) {
            const tag = matchedNode.tag.toLowerCase();
            const candidates = Array.from(doc.querySelectorAll(tag));
            if (matchedNode.text && matchedNode.text.trim()) {
              const searchText = matchedNode.text.trim();
              targetEl =
                candidates.find((el) =>
                  el.textContent?.trim().includes(searchText),
                ) || null;
            } else if (candidates.length === 1) {
              targetEl = candidates[0];
            }
          }

          // Если нашли элемент фоллбэком — вешаем на него ключ для мгновенных повторных наведений
          if (targetEl && targetEl instanceof Element) {
            targetEl.setAttribute("data-node-key", key);
          }
        }
      }
      if (!targetEl || targetEl.nodeType !== 1) {
        setBoxModelData(null);
        return;
      }
      // alert(targetEl.tagName.toLowerCase());

      const win = doc.defaultView || window;
      const style = win.getComputedStyle(targetEl);
      if (style.display === "none" || style.visibility === "hidden") {
        setBoxModelData(null);
        return;
      }

      const rect = targetEl.getBoundingClientRect();
      const iframeRect = iframe.getBoundingClientRect();

      let containerTop = iframeRect.top;
      let containerLeft = iframeRect.left;

      if (containerRef?.current) {
        const cRect = containerRef.current.getBoundingClientRect();
        containerTop = cRect.top;
        containerLeft = cRect.left;
      }

      // Точные координаты относительно контейнера PreviewArea
      const top = rect.top + iframeRect.top - containerTop;
      const left = rect.left + iframeRect.left - containerLeft;

      const parsePx = (v: string | null): number => {
        if (!v) return 0;
        const n = parseFloat(v);
        return isNaN(n) ? 0 : Math.round(n * 10) / 10;
      };

      // 🎯 Считывание Margin
      const mt = parsePx(style.marginTop);
      const mr = parsePx(style.marginRight);
      const mb = parsePx(style.marginBottom);
      const ml = parsePx(style.marginLeft);

      // 🎯 Считывание Padding
      const pt = parsePx(style.paddingTop);
      const pr = parsePx(style.paddingRight);
      const pb = parsePx(style.paddingBottom);
      const pl = parsePx(style.paddingLeft);

      // 🎯 Считывание Border
      const bt = parsePx(style.borderTopWidth);
      const br = parsePx(style.borderRightWidth);
      const bb = parsePx(style.borderBottomWidth);
      const bl = parsePx(style.borderLeftWidth);

      const gap =
        style.display.includes("flex") || style.display.includes("grid")
          ? parsePx(style.gap)
          : 0;

      const width = Math.max(rect.width, 8);
      const height = Math.max(rect.height, 4);

      setBoxModelData({
        top,
        left,
        width,
        height,
        mt,
        mr,
        mb,
        ml,
        pt,
        pr,
        pb,
        pl,
        bt,
        br,
        bb,
        bl,
        tag: targetEl.tagName.toLowerCase(),
        className: targetEl.className || "",
        gap,
      });
    },
    [iframeRef, containerRef],
  );

  useEffect(() => {
    measureAndSetKey(hoveredKey);
  }, [hoveredKey, measureAndSetKey]);

  useEffect(() => {
    const handleHovered = (event: Event) => {
      const customEvent = event as CustomEvent<string | null>;
      measureAndSetKey(customEvent.detail || null);
    };

    const handleTreeUpdated = () => {
      if (currentKeyRef.current) {
        setTimeout(() => {
          if (currentKeyRef.current) {
            measureAndSetKey(currentKeyRef.current);
          }
        }, 60);
      }
    };

    window.addEventListener("plaza-node-hovered", handleHovered);
    window.addEventListener("plaza-tree-updated", handleTreeUpdated);
    window.addEventListener("plaza-styles-updated", handleTreeUpdated);

    return () => {
      window.removeEventListener("plaza-node-hovered", handleHovered);
      window.removeEventListener("plaza-tree-updated", handleTreeUpdated);
      window.removeEventListener("plaza-styles-updated", handleTreeUpdated);
    };
  }, [measureAndSetKey]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleScrollOrResize = () => {
      if (currentKeyRef.current) {
        measureAndSetKey(currentKeyRef.current);
      }
    };

    const attachListeners = () => {
      const doc = iframe.contentDocument;
      const win = doc?.defaultView;
      if (win) {
        win.addEventListener("scroll", handleScrollOrResize, { passive: true });
        win.addEventListener("resize", handleScrollOrResize, { passive: true });
      }
    };

    iframe.addEventListener("load", attachListeners);
    attachListeners();

    return () => {
      iframe.removeEventListener("load", attachListeners);
      const doc = iframe.contentDocument;
      const win = doc?.defaultView;
      if (win) {
        win.removeEventListener("scroll", handleScrollOrResize);
        win.removeEventListener("resize", handleScrollOrResize);
      }
    };
  }, [iframeRef, measureAndSetKey]);

  return {
    boxModelData,
    measureAndSetKey,
  };
}
