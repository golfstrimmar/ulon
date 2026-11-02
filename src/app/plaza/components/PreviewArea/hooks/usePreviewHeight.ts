"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UsePreviewHeightOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  isEmpty: boolean;
  overlayImage?: string | null;
  hasImage?: boolean;
  overlayHeight?: number;
  offsetY?: number;
}

export function usePreviewHeight({
  iframeRef,
  isEmpty,
  overlayImage,
  hasImage,
  overlayHeight,
  offsetY = 0,
}: UsePreviewHeightOptions) {
  const [iframeHeight, setIframeHeight] = useState(140);
  const [naturalImgHeight, setNaturalImgHeight] = useState<number>(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Measure prototype reference natural height
  useEffect(() => {
    if (!overlayImage) {
      setNaturalImgHeight(0);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setNaturalImgHeight(img.naturalHeight);
    };
    img.src = overlayImage;
  }, [overlayImage]);

  const activeImageHeight = overlayHeight || naturalImgHeight;

  // Calculate prototype target height
  const prototypeHeight =
    hasImage && activeImageHeight > 0
      ? activeImageHeight + Math.max(0, offsetY)
      : null;

  const effectiveHeight = prototypeHeight
    ? Math.max(isEmpty ? 140 : iframeHeight, prototypeHeight)
    : isEmpty
      ? 140
      : iframeHeight;

  // Reset when workspace is emptied
  useEffect(() => {
    if (isEmpty) {
      setIframeHeight(140);
    }
  }, [isEmpty]);

  // Height measurement observer runner
  const initHeightMeasurement = useCallback((doc: Document) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const update = () => {
      if (!doc.body || !doc.documentElement) return;
      const win = doc.defaultView;
      if (!win) return;

      const children = Array.from(doc.body.children).filter(
        (el) =>
          !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName),
      );

      if (children.length === 0) {
        setIframeHeight(140);
        return;
      }

      let maxBottom = 0;
      const scrollY = win.scrollY || doc.documentElement.scrollTop || 0;

      children.forEach((child) => {
        const style = win.getComputedStyle(child);
        if (style.display === "none" || style.visibility === "hidden") return;

        const rect = child.getBoundingClientRect();
        const marginBottom = parseFloat(style.marginBottom) || 0;
        const bottom = rect.bottom + scrollY + marginBottom;

        if (bottom > maxBottom) {
          maxBottom = bottom;
        }
      });

      const bodyPaddingBottom =
        parseFloat(win.getComputedStyle(doc.body).paddingBottom) || 0;

      const finalHeight = Math.max(
        140,
        Math.ceil(maxBottom + bodyPaddingBottom + 16),
      );

      setIframeHeight((prev) => {
        if (prev !== finalHeight) {
          const delta = finalHeight - prev;
          if (typeof window !== "undefined" && window.scrollY > 150) {
            requestAnimationFrame(() => {
              window.scrollBy({ top: delta, behavior: "instant" });
            });
          }
        }
        return prev !== finalHeight ? finalHeight : prev;
      });
    };

    update();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    resizeObserver.observe(doc.body);
    resizeObserver.observe(doc.documentElement);

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(update);
    });
    mutationObserver.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const images = doc.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", update, { once: true });
        img.addEventListener("error", update, { once: true });
      }
    });

    if (doc.fonts) {
      doc.fonts.ready.then(update).catch(() => {});
    }

    const handleLiveStyle = () => requestAnimationFrame(update);
    window.addEventListener("plaza-styles-updated", handleLiveStyle);
    window.addEventListener("plaza-live-style", handleLiveStyle);

    cleanupRef.current = () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("plaza-styles-updated", handleLiveStyle);
      window.removeEventListener("plaza-live-style", handleLiveStyle);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return {
    effectiveHeight,
    initHeightMeasurement,
    setNaturalImgHeight,
  };
}
