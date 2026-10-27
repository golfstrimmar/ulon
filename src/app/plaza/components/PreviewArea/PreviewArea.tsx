"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { motion, AnimatePresence } from "framer-motion";
import ButtonCss from "@/app/plaza/components/PreviewArea/components/ButtonCss";
import ButtonJS from "@/app/plaza/components/PreviewArea/components/ButtonJS";
import ButtonFonts from "@/app/plaza/components/PreviewArea/components/ButtonFonts";
import ButtonPixelPerfect from "@/app/plaza/components/PreviewArea/components/ButtonPixelPerfect";
import { usePixelPerfect } from "@/app/plaza/components/PreviewArea/hooks/usePixelPerfect";
import ButtonJson from "@/app/plaza/components/PreviewArea/components/ButtonJson";
import BreakpointControls from "@/app/plaza/components/PreviewArea/components/BreakpointControls";
import { useBreakpoint } from "@/app/plaza/components/PreviewArea/hooks/useBreakpoint";
import dynamic from "next/dynamic";

const ModalFonts = dynamic(
  () => import("@/app/plaza/components/PreviewArea/components/ModalFonts"),
  { ssr: false },
);

const ModalPixelPerfect = dynamic(
  () =>
    import("@/app/plaza/components/PreviewArea/components/ModalPixelPerfect"),
  { ssr: false },
);

// 🔹 Раздельные стили: Красный для активной ноды, Зеленый для ховера
const HIGHLIGHT_STYLE_ID = "plaza-highlight-style";
const HIGHLIGHT_CSS = `
  /* Активная нода (Красная) - наивысший приоритет */
  .plaza-node-selected {
    outline: 3px solid rgba(239, 68, 68, 0.95) !important;
    outline-offset: -1px !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3) !important;
    position: relative;
    z-index: 50 !important;
  }

  /* Ховер-нода (Зеленоватая) - работает ТОЛЬКО если элемент НЕ выбран */
  .plaza-node-hovered:not(.plaza-node-selected) {
    outline: 2px dashed rgba(52, 211, 153, 0.9) !important;
    outline-offset: -1px !important;
    box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.25) !important;
    position: relative;
    z-index: 40 !important;
  }
`;

interface SelectionPayload {
  key?: string | null;
  className?: string;
  tag?: string;
  text?: string;
}

export function PreviewArea() {
  const { iframeRef, srcDoc, isEmpty, isCollapsed, setIsCollapsed } =
    usePreviewArea();

  const {
    image: overlayImage,
    hasImage,
    isOverlayActive,
    previewOpacity,
    overlayOpacity,
    offsetX,
    offsetY,
    align,
    fitHeight,
    imageHeight: overlayHeight,
    setPreviewOpacity,
  } = usePixelPerfect();

  const {
    effectiveWidthStyle,
    effectiveWidth,
    isFullWidth,
    activeBreakpoint,
    isRotated,
  } = useBreakpoint();

  const [iframeHeight, setIframeHeight] = useState(140);
  const [activeSelection, setActiveSelection] =
    useState<SelectionPayload | null>(null);
  const activeSelectionRef = useRef<SelectionPayload | null>(null);
  activeSelectionRef.current = activeSelection;

  const effectiveHeight =
    hasImage && isOverlayActive && fitHeight && overlayHeight
      ? Math.max(iframeHeight, overlayHeight + Math.max(0, offsetY))
      : iframeHeight;

  // Вспомогательная функция для инъекции CSS в iframe
  const ensureStylesInjected = (doc: Document) => {
    if (!doc.getElementById(HIGHLIGHT_STYLE_ID)) {
      const styleEl = doc.createElement("style");
      styleEl.id = HIGHLIGHT_STYLE_ID;
      styleEl.textContent = HIGHLIGHT_CSS;
      (doc.head || doc.body).appendChild(styleEl);
    }
  };

  // 🔹 Подсветка АКТИВНОГО элемента (Красный)
  const applyHighlight = useCallback(
    (payload: SelectionPayload | null) => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc || !doc.body) return;

      ensureStylesInjected(doc);

      // Снимаем класс активности со старых элементов
      doc.querySelectorAll(".plaza-node-selected").forEach((el) => {
        el.classList.remove("plaza-node-selected");
      });

      if (!payload) return;

      let targetEl: Element | null = null;

      // 1. Поиск по data-node-key
      if (payload.key) {
        targetEl = doc.querySelector(`[data-node-key="${payload.key}"]`);
      }

      // 2. Фолбэк по классу + тегу
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
            if (payload.text) {
              targetEl =
                candidates.find((el) =>
                  el.textContent?.trim().includes(payload.text!.trim()),
                ) || candidates[0];
            } else {
              targetEl = candidates[0];
            }
          }
        }
      }

      // 3. Активируем ноду
      if (targetEl) {
        // Убираем ховер, если он был на этом элементе
        targetEl.classList.remove("plaza-node-hovered");
        targetEl.classList.add("plaza-node-selected");
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [iframeRef],
  );

  // 🔹 Подсветка элемента по ХОВЕРУ (Зелёный)
  useEffect(() => {
    const handlePlazaNodeHovered = (event: Event) => {
      const customEvent = event as CustomEvent<string | null>;
      const key = customEvent.detail;
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc || !doc.body) return;

      ensureStylesInjected(doc);

      // Очищаем предыдущий ховер со всех элементов
      doc.querySelectorAll(".plaza-node-hovered").forEach((el) => {
        el.classList.remove("plaza-node-hovered");
      });

      // Если ховер сброшен (null/empty) — выходим
      if (!key) return;

      // ⚠️ ВАЖНО: Если наведённый элемент совпадает с текущим активным — игнорируем ховер!
      if (activeSelectionRef.current?.key === key) {
        return;
      }

      const targetEl = doc.querySelector(`[data-node-key="${key}"]`);
      if (targetEl && !targetEl.classList.contains("plaza-node-selected")) {
        targetEl.classList.add("plaza-node-hovered");
      }
    };

    window.addEventListener("plaza-node-hovered", handlePlazaNodeHovered);

    return () => {
      window.removeEventListener("plaza-node-hovered", handlePlazaNodeHovered);
    };
  }, [iframeRef]);

  // 🔹 Слушаем глобальные события выбора/снятия активной ноды
  useEffect(() => {
    const handleNodeSelected = (e: CustomEvent<SelectionPayload>) => {
      const detail = e.detail;
      setActiveSelection(detail || null);
      applyHighlight(detail || null);
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

  // 🔹 При обновлении srcDoc повторно подсвечиваем активный элемент
  useEffect(() => {
    applyHighlight(activeSelectionRef.current);
  }, [srcDoc, applyHighlight]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    // Сразу накладываем активную подсветку
    applyHighlight(activeSelectionRef.current);

    // Клик внутри самого iframe
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === doc.body || target === doc.documentElement)
        return;

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

      // Снимаем ховер при клике
      nodeEl.classList.remove("plaza-node-hovered");

      setActiveSelection(payload);
      applyHighlight(payload);

      // Оповещаем CanvasArea, чтобы открылась модалка
      window.dispatchEvent(
        new CustomEvent("plaza-node-selected", { detail: payload }),
      );
    };

    doc.addEventListener("click", handleDocClick);

    // Расчет высоты
    const update = () => {
      if (!doc.body || !doc.documentElement) return;
      const win = doc.defaultView;
      if (!win) return;

      const children = Array.from(doc.body.children).filter(
        (el) =>
          !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName),
      );

      let maxBottom = 0;

      if (children.length > 0) {
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
      } else {
        maxBottom = doc.body.getBoundingClientRect().height;
      }

      const bodyPaddingBottom =
        parseFloat(win.getComputedStyle(doc.body).paddingBottom) || 0;

      const finalHeight = Math.max(
        140,
        Math.ceil(maxBottom + bodyPaddingBottom + 16),
      );

      setIframeHeight((prev) => (prev !== finalHeight ? finalHeight : prev));
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

    return () => {
      doc.removeEventListener("click", handleDocClick);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("plaza-styles-updated", handleLiveStyle);
      window.removeEventListener("plaza-live-style", handleLiveStyle);
    };
  }, [iframeRef, applyHighlight]);

  return (
    <div className="w-full flex flex-col border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 shadow-xl">
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800 bg-zinc-900/80 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-1 text-[11px] font-mono text-zinc-400 uppercase tracking-widest hidden sm:inline">
                Preview
              </span>
            </div>
            {hasImage && isOverlayActive && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-[10px] font-mono text-zinc-400"
                title="Прозрачность верстки (превью) для сравнения с подложкой"
              >
                <span className="text-zinc-400">Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={previewOpacity}
                  onChange={(e) => setPreviewOpacity(Number(e.target.value))}
                  className="w-26 h-1 accent-indigo-500 cursor-pointer"
                />
                <span className="w-7 text-right text-indigo-300 font-bold">
                  {previewOpacity}%
                </span>
              </div>
            )}
            <ButtonPixelPerfect />
            <ButtonCss />
            <ButtonJS />
            <ButtonFonts />
            <BreakpointControls />
            <ButtonJson />
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            title={isCollapsed ? "Развернуть" : "Свернуть"}
            className="text-zinc-500 hover:text-zinc-200 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer"
          >
            <img
              src="/chevron-down.svg"
              alt=""
              className={`w-5 h-5 transition-transform duration-200 ease-out ${
                isCollapsed ? "rotate-0" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>
      <ModalFonts />
      <ModalPixelPerfect />

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 0 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className={`relative w-full overflow-x-auto custom-scrollbar transition-colors ${
              isFullWidth
                ? "bg-white"
                : "bg-zinc-950/90 p-2 sm:p-4 flex flex-col items-center"
            }`}
          >
            <div
              className={`relative bg-white transition-[width] duration-200 ease-out overflow-hidden ${
                isFullWidth
                  ? "w-full"
                  : "shadow-2xl rounded-lg border border-zinc-700/70 ring-1 ring-zinc-800 shrink-0"
              }`}
              style={{
                width: effectiveWidthStyle,
                minWidth: isFullWidth ? "100%" : effectiveWidthStyle,
                minHeight: effectiveHeight,
              }}
            >
              {!isFullWidth && (
                <div className="relative z-200 flex items-center justify-center px-3 py-1.5 bg-zinc-900 border-b border-zinc-700/80 text-xs font-mono select-none flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{activeBreakpoint.icon}</span>
                    <span className="font-bold text-zinc-100 text-xs tracking-tight">
                      {activeBreakpoint.name}
                    </span>
                    <span className="text-zinc-300 text-[11px] font-medium">
                      ({activeBreakpoint.deviceType})
                    </span>

                    <span
                      title="CSS Media Query"
                      className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-amber-300 font-mono text-[10px] font-semibold"
                    >
                      @{activeBreakpoint.mediaQuery}
                    </span>

                    {activeBreakpoint.tailwindPrefix && (
                      <span
                        title="Tailwind breakpoint class prefix"
                        className="px-1.5 py-0.5 rounded bg-indigo-950/90 border border-indigo-700/70 text-indigo-300 font-mono text-[10px] font-bold"
                      >
                        {activeBreakpoint.tailwindPrefix}
                      </span>
                    )}

                    {isRotated && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-medium flex items-center gap-1">
                        🔄 Landscape
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-zinc-400">Ширина:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 font-bold">
                      {effectiveWidth}px
                    </span>
                  </div>
                </div>
              )}

              {hasImage && isOverlayActive && (
                <div
                  className="absolute top-0 pointer-events-none select-none z-0"
                  style={{
                    left: align === "center" ? "50%" : 0,
                    transform:
                      align === "center"
                        ? `translateX(calc(-50% + ${offsetX}px)) translateY(${offsetY}px)`
                        : `translate(${offsetX}px, ${offsetY}px)`,
                  }}
                >
                  <img
                    src={overlayImage}
                    alt="Pixel Perfect Reference"
                    className="max-w-none block pointer-events-none select-none"
                    draggable={false}
                    style={{
                      opacity: overlayOpacity / 100,
                    }}
                  />
                </div>
              )}

              {isEmpty ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2 bg-white z-10"
                  style={{
                    opacity:
                      hasImage && isOverlayActive ? previewOpacity / 100 : 1,
                    transition: "opacity 0.05s ease-out",
                  }}
                >
                  <span className="text-2xl">🖼️</span>
                  <p className="text-sm font-medium text-zinc-400">
                    There are no elements to display
                  </p>
                  <p className="text-xs text-zinc-500">
                    Add the blocks to the canvas — they will appear here
                  </p>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  srcDoc={srcDoc}
                  title="iframe Prev"
                  sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
                  className="w-full border-0 bg-white block relative z-10"
                  onLoad={handleLoad}
                  style={{
                    height: effectiveHeight,
                    opacity:
                      hasImage && isOverlayActive ? previewOpacity / 100 : 1,
                    transition: "opacity 0.05s ease-out",
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
