"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { usePreviewArea } from "@/app/plaza/components/PreviewArea/hooks/usePreviewArea";
import { motion, AnimatePresence } from "framer-motion";
import ButtonCss from "@/app/plaza/components/PreviewArea/components/ButtonCss";
import ButtonJS from "@/app/plaza/components/PreviewArea/components/ButtonJS";
import ButtonFonts from "@/app/plaza/components/PreviewArea/components/ButtonFonts";
import dynamic from "next/dynamic";

const ModalFonts = dynamic(
  () => import("@/app/plaza/components/PreviewArea/components/ModalFonts"),
  { ssr: false },
);

// 🔹 Красный полупрозрачный маркер (outline + glow + bg)
const HIGHLIGHT_STYLE_ID = "plaza-highlight-style";
const HIGHLIGHT_CSS = `
  .plaza-node-selected {
    outline: 4px solid rgba(239, 68, 68, 0.95) !important;
    outline-offset: -2px !important;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3) !important;
    transition: outline 0.1s ease, box-shadow 0.1s ease !important;
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

  const [iframeHeight, setIframeHeight] = useState(140);
  const [activeSelection, setActiveSelection] =
    useState<SelectionPayload | null>(null);
  const activeSelectionRef = useRef<SelectionPayload | null>(null);
  activeSelectionRef.current = activeSelection;

  // 🔹 Умный поиск элемента внутри iframe (по ключу или по классу/тегу/тексту)
  const applyHighlight = useCallback(
    (payload: SelectionPayload | null) => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc || !doc.body) return;

      // Внедряем CSS
      if (!doc.getElementById(HIGHLIGHT_STYLE_ID)) {
        const styleEl = doc.createElement("style");
        styleEl.id = HIGHLIGHT_STYLE_ID;
        styleEl.textContent = HIGHLIGHT_CSS;
        (doc.head || doc.body).appendChild(styleEl);
      }

      // Снимаем подсветку со старых элементов
      doc.querySelectorAll(".plaza-node-selected").forEach((el) => {
        el.classList.remove("plaza-node-selected");
      });

      if (!payload) return;

      let targetEl: Element | null = null;

      // 1. Пытаемся найти по ключу (если есть атрибуты data-node-key, data-key, id)
      if (payload.key) {
        targetEl = doc.querySelector(
          `[data-node-key="${payload.key}"], [data-key="${payload.key}"], [id="${payload.key}"]`,
        );
      }

      // 2. Если по ключу не найдено — ищем по классам
      if (!targetEl && payload.className) {
        const classes = payload.className
          .trim()
          .split(/\s+/)
          .map((c) => c.replace(/^\./, "").trim())
          .filter(Boolean);

        if (classes.length > 0) {
          // Пробуем искать по первому/основному классу
          const selector = `${payload.tag || ""}.${classes[0]}`.trim();
          const candidates = Array.from(doc.querySelectorAll(selector));

          if (candidates.length === 1) {
            targetEl = candidates[0];
          } else if (candidates.length > 1) {
            // Если кандидатов несколько, сверяем по тексту
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

      // 3. Если всё еще не найден, но есть тег и текст
      if (!targetEl && payload.tag && payload.text) {
        const candidates = Array.from(doc.querySelectorAll(payload.tag));
        targetEl =
          candidates.find(
            (el) => el.textContent?.trim() === payload.text?.trim(),
          ) || null;
      }

      // 4. Подсвечиваем найденный элемент
      if (targetEl) {
        targetEl.classList.add("plaza-node-selected");
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [iframeRef],
  );

  // 🔹 Слушаем глобальные события выбора/снятия ноды
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

    // Сразу накладываем подсветку
    applyHighlight(activeSelectionRef.current);

    // Клик внутри самого iframe
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === doc.body || target === doc.documentElement)
        return;

      e.preventDefault();
      e.stopPropagation();

      // Ищем элемент с ключом или ближайшего родителя-ноду
      const nodeEl =
        target.closest<HTMLElement>("[data-node-key], [data-key], [id]") ||
        target;

      const key =
        nodeEl.getAttribute("data-node-key") ||
        nodeEl.getAttribute("data-key") ||
        nodeEl.id ||
        null;

      const payload: SelectionPayload = {
        key,
        tag: nodeEl.tagName.toLowerCase(),
        className: nodeEl.className || "",
        text: nodeEl.textContent?.trim() || "",
      };

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
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-2 text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
            Preview
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ButtonCss />
          <ButtonJS />
          <ButtonFonts />

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

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 0 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="relative w-full bg-white min-h-[140px] "
          >
            {isEmpty ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2 bg-white">
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
                className="w-full border-0 bg-white block "
                onLoad={handleLoad}
                style={{ height: iframeHeight }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
