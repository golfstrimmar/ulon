"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TypographyControl } from "./components/TypographyControl";
import { PresetsList } from "./components/PresetsList";
import { ColorControl } from "./components/ColorControl";
import { DisplayControl } from "./components/DisplayControl";
import { PositionControl } from "./components/PositionControl";
import { TransformControl } from "./components/TransformControl";
import { UnifiedBoxControl } from "./components/UnifiedBoxControl";
import { extractNestedSnippet } from "@/lib/scssCompiler";
import {
  PSEUDO_LIBRARY,
  extractExistingPseudoSelectors,
  type PseudoItem,
} from "./constants/pseudoLibrary";
import {
  QUICK_BREAKPOINTS,
  BREAKPOINT_LIBRARY,
  BREAKPOINT_CATEGORY_LABELS,
  extractExistingMediaQueries,
  normalizeMediaQuery,
  formatMediaQueryInput,
  getSegmentDisplay,
} from "./constants/breakpointLibrary";

interface ModalCustomStylesProps {
  currentClass: string | null;
  currentScssText?: string;
  activeScope?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onScopeChange?: (scope: string) => void;
  onApplySnippet: (snippetCss: string) => void;
}

// Быстрый список основных псевдоэлементов для панельки
const QUICK_PSEUDOS = [
  "&:before",
  "&:after",
  "&:hover",
  "&:active",
  "&:focus",
  "&:first-child",
  "&:last-child",
  "&:nth-child(2)",
];

export default function ModalCustomStyles({
  currentClass,
  currentScssText = "",
  activeScope: externalScope,
  isOpen: externalIsOpen,
  onOpenChange,
  onScopeChange,
  onApplySnippet,
}: ModalCustomStylesProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const setIsOpen = useCallback(
    (openOrFn: boolean | ((prev: boolean) => boolean)) => {
      const nextOpen =
        typeof openOrFn === "function" ? openOrFn(isOpen) : openOrFn;
      setInternalIsOpen(nextOpen);
      if (onOpenChange) {
        onOpenChange(nextOpen);
      }
    },
    [isOpen, onOpenChange],
  );

  const [internalScope, setInternalScope] = useState<string>("base");

  // Дропдауны
  const [isPseudoDropdownOpen, setIsPseudoDropdownOpen] = useState(false);
  const [isBpDropdownOpen, setIsBpDropdownOpen] = useState(false);

  // Кастомные инпуты
  const [customSelectorInput, setCustomSelectorInput] = useState("");
  const [customBpInput, setCustomBpInput] = useState("");

  const pseudoDropdownRef = useRef<HTMLDivElement>(null);
  const bpDropdownRef = useRef<HTMLDivElement>(null);

  const activeScope = externalScope ?? internalScope;

  const handleSelectScope = (scope: string) => {
    setInternalScope(scope);
    if (onScopeChange) {
      onScopeChange(scope);
    }
    // По клику на скоуп открываем модалку для него
    setIsOpen(true);
    setIsPseudoDropdownOpen(false);
    setIsBpDropdownOpen(false);
  };

  // Закрытие выпадающих списков при клике вне их
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pseudoDropdownRef.current &&
        !pseudoDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPseudoDropdownOpen(false);
      }
      if (
        bpDropdownRef.current &&
        !bpDropdownRef.current.contains(e.target as Node)
      ) {
        setIsBpDropdownOpen(false);
      }
    };
    if (isPseudoDropdownOpen || isBpDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPseudoDropdownOpen, isBpDropdownOpen]);

  if (!currentClass) return null;

  // Извлекаем уже существующие псевдоселекторы и медиа-запросы в коде класса
  const presentPseudos = extractExistingPseudoSelectors(currentScssText);
  const presentMediaQueries = extractExistingMediaQueries(currentScssText);

  // Оборачивает свойства в активный скоуп (псевдоэлемент или медиа-запрос)
  const handleScopedApplySnippet = (snippet: string) => {
    const trimmed = snippet.trim();
    if (!trimmed) return;

    if (
      activeScope === "base" ||
      trimmed.startsWith("&") ||
      trimmed.startsWith("@media") ||
      trimmed.startsWith(".")
    ) {
      onApplySnippet(trimmed);
      return;
    }

    // Для &:before и &:after добавляем content: "" если его ещё нет
    let body = trimmed;
    if (
      (activeScope === "&:before" || activeScope === "&:after") &&
      !currentScssText.includes(activeScope) &&
      !body.includes("content:")
    ) {
      body = `content: "";\n  ${body}`;
    }

    const wrapped = `${activeScope} {\n  ${body.split("\n").join("\n  ")}\n}`;
    onApplySnippet(wrapped);
  };

  const handleAddCustomPseudo = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = customSelectorInput.trim();
    if (!raw) return;

    const formatted = raw.startsWith("&") ? raw : `&:${raw.replace(/^:+/, "")}`;
    handleSelectScope(formatted);
    setCustomSelectorInput("");
  };

  const handleAddCustomBreakpoint = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = customBpInput.trim();
    if (!raw) return;

    const formatted = formatMediaQueryInput(raw);
    if (formatted) {
      handleSelectScope(formatted);
      setCustomBpInput("");
    }
  };

  const effectiveScssText =
    activeScope === "base"
      ? currentScssText
      : extractNestedSnippet(currentScssText, activeScope) || currentScssText;

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap">
      {/* ── Кнопка + Presets (Базовый класс) ── */}
      <button
        type="button"
        onClick={() => {
          if (isOpen && activeScope === "base") {
            setIsOpen(false);
          } else {
            handleSelectScope("base");
          }
        }}
        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
          isOpen && activeScope === "base"
            ? "bg-indigo-600 border-indigo-400 text-white shadow"
            : "bg-zinc-900 border-zinc-700 text-indigo-300 hover:bg-zinc-800 hover:border-indigo-500"
        }`}
        title={`Настроить базовый класс .${currentClass}`}
      >
        <span>🎨</span>
        <span>+ Presets</span>
      </button>

      {/* ── БЫСТРЫЕ КНОПКИ ПСЕВДОЭЛЕМЕНТОВ НА ПАНЕЛЬКЕ ── */}
      <div className="flex items-center gap-1 flex-wrap">
        {QUICK_PSEUDOS.map((pseudo) => {
          const isCurrentActive = isOpen && activeScope === pseudo;
          const isPresent = presentPseudos.includes(pseudo);

          return (
            <button
              key={pseudo}
              type="button"
              onClick={() => handleSelectScope(pseudo)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer flex items-center gap-1 ${
                isCurrentActive
                  ? "bg-amber-600 border-amber-400 text-white font-bold shadow"
                  : isPresent
                    ? "bg-zinc-900 border-amber-700/80 text-amber-300 hover:bg-zinc-800"
                    : "bg-zinc-900 border-zinc-750 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
              title={`Открыть кастомизацию для ${pseudo}`}
            >
              <span>{pseudo}</span>
              {isPresent && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}

        {/* Дополнительные псевдоселекторы, которые уже есть в коде класса (но не в quick) */}
        {presentPseudos
          .filter((p) => !QUICK_PSEUDOS.includes(p))
          .map((pseudo) => {
            const isCurrentActive = isOpen && activeScope === pseudo;
            return (
              <button
                key={pseudo}
                type="button"
                onClick={() => handleSelectScope(pseudo)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer flex items-center gap-1 ${
                  isCurrentActive
                    ? "bg-amber-600 border-amber-400 text-white font-bold shadow"
                    : "bg-zinc-900 border-amber-700/80 text-amber-300 hover:bg-zinc-800"
                }`}
              >
                <span>{pseudo}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </button>
            );
          })}

        {/* Дропдаун «▾ Псевдо» для полного списка псевдоэлементов */}
        <div ref={pseudoDropdownRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setIsPseudoDropdownOpen((prev) => !prev)}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition cursor-pointer flex items-center gap-1"
            title="Выбрать другой псевдоэлемент или псевдокласс"
          >
            <span>▾ Pseudo</span>
          </button>

          {isPseudoDropdownOpen && (
            <div className="absolute left-0 top-full mb-1 z-50 w-64 max-h-30 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2 flex flex-col gap-1.5 custom-scrollbar backdrop-blur-md">
              <span className="text-[10px] font-mono text-zinc-500 font-bold px-1">
                Выберите псевдоселектор:
              </span>

              <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {PSEUDO_LIBRARY.map((item) => {
                  const isPresent = presentPseudos.includes(item.selector);
                  const isCurrentActive =
                    isOpen && activeScope === item.selector;
                  return (
                    <button
                      key={item.selector}
                      type="button"
                      onClick={() => handleSelectScope(item.selector)}
                      className={`px-2 py-1 rounded text-left text-[10px] font-mono transition cursor-pointer flex items-center justify-between ${
                        isCurrentActive
                          ? "bg-amber-600 text-white font-bold"
                          : "text-zinc-300 hover:text-white hover:bg-amber-600/80"
                      }`}
                    >
                      <span className="font-bold text-amber-300">
                        {item.selector}
                      </span>
                      <span className="text-[9px] text-zinc-500 truncate max-w-[120px]">
                        {item.label.replace(item.selector, "")}
                      </span>
                      {isPresent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Ввод своего кастомного селектора */}
              <form
                onSubmit={handleAddCustomPseudo}
                className="pt-1.5 border-t border-zinc-800 flex items-center gap-1"
              >
                <input
                  type="text"
                  value={customSelectorInput}
                  onChange={(e) => setCustomSelectorInput(e.target.value)}
                  placeholder="&:nth-child(3)..."
                  className="flex-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!customSelectorInput.trim()}
                  className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-mono font-bold transition cursor-pointer"
                >
                  OK
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── БРЕЙКПОИНТЫ / МЕДИА-ЗАПРОСЫ ПО КОРИДОРАМ ── */}
      <div className="flex items-center gap-1 flex-wrap ml-[100px]">
        {/* Быстрые кнопки отрезков экранов (2XL, XL, LG, MD, SM, XS, XXS) */}
        {QUICK_BREAKPOINTS.map((bp) => {
          const isCurrentActive =
            isOpen &&
            normalizeMediaQuery(activeScope) ===
              normalizeMediaQuery(bp.mediaQuery);
          const isPresent = presentMediaQueries.some(
            (q) =>
              normalizeMediaQuery(q) === normalizeMediaQuery(bp.mediaQuery),
          );

          return (
            <button
              key={bp.id}
              type="button"
              onClick={() => handleSelectScope(bp.mediaQuery)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer flex items-center gap-1 ${
                isCurrentActive
                  ? "bg-sky-600 border-sky-400 text-white font-bold shadow"
                  : isPresent
                    ? "bg-zinc-900 border-sky-600/80 text-sky-300 hover:bg-zinc-800"
                    : "bg-zinc-900 border-zinc-750 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
              title={`${bp.title} — ${bp.mediaQuery}`}
            >
              <span className="font-bold">{bp.label}</span>
              <span
                className={`text-[9px] font-normal tracking-tight ${
                  isCurrentActive
                    ? "text-sky-100"
                    : isPresent
                      ? "text-sky-400/90"
                      : "text-zinc-400"
                }`}
              >
                {bp.segment}
              </span>
              {isPresent && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 ml-0.5" />
              )}
            </button>
          );
        })}

        {/* Дополнительные медиа-запросы, которые уже есть в SCSS (но не в QUICK) */}
        {presentMediaQueries
          .filter(
            (q) =>
              !QUICK_BREAKPOINTS.some(
                (bp) =>
                  normalizeMediaQuery(bp.mediaQuery) === normalizeMediaQuery(q),
              ),
          )
          .map((query) => {
            const isCurrentActive =
              isOpen &&
              normalizeMediaQuery(activeScope) === normalizeMediaQuery(query);
            const seg = getSegmentDisplay(query);
            return (
              <button
                key={query}
                type="button"
                onClick={() => handleSelectScope(query)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer flex items-center gap-1 max-w-[140px] truncate ${
                  isCurrentActive
                    ? "bg-sky-600 border-sky-400 text-white font-bold shadow"
                    : "bg-zinc-900 border-sky-600/80 text-sky-300 hover:bg-zinc-800"
                }`}
                title={query}
              >
                <span className="truncate font-bold">
                  {seg.name ? `${seg.name} ${seg.segment}` : seg.segment}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              </button>
            );
          })}

        {/* Дропдаун «▾ Media» */}
        <div ref={bpDropdownRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setIsBpDropdownOpen((prev) => !prev)}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-sky-300 hover:bg-zinc-800 transition cursor-pointer flex items-center gap-1"
            title="Выбрать медиа-запрос или настроить свой коридор"
          >
            <span>▾ Media</span>
          </button>

          {isBpDropdownOpen && (
            <div className="absolute left-0 top-full mb-1 z-50 w-72 max-h-30 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2 flex flex-col gap-1.5 custom-scrollbar backdrop-blur-md">
              <span className="text-[10px] font-mono text-zinc-500 font-bold px-1">
                Выберите медиа-запрос (брейкпоинт):
              </span>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {(
                  [
                    "corridors",
                    "max_width",
                    "min_width",
                    "orientation",
                  ] as const
                ).map((cat) => {
                  const items = BREAKPOINT_LIBRARY.filter(
                    (it) => it.category === cat,
                  );
                  if (items.length === 0) return null;

                  return (
                    <div key={cat} className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-sky-400/80 font-bold px-1 pt-1 border-t border-zinc-800/80 first:border-0 first:pt-0">
                        {BREAKPOINT_CATEGORY_LABELS[cat]}
                      </span>

                      {items.map((item) => {
                        const isPresent = presentMediaQueries.some(
                          (q) =>
                            normalizeMediaQuery(q) ===
                            normalizeMediaQuery(item.selector),
                        );
                        const isCurrentActive =
                          isOpen &&
                          normalizeMediaQuery(activeScope) ===
                            normalizeMediaQuery(item.selector);

                        return (
                          <button
                            key={item.selector}
                            type="button"
                            onClick={() => handleSelectScope(item.selector)}
                            className={`px-2 py-1 rounded text-left text-[10px] font-mono transition cursor-pointer flex items-center justify-between ${
                              isCurrentActive
                                ? "bg-sky-600 text-white font-bold"
                                : "text-zinc-300 hover:text-white hover:bg-sky-600/80"
                            }`}
                            title={`${item.selector} — ${item.description}`}
                          >
                            <span className="font-bold text-sky-300 flex items-center gap-1 truncate">
                              {item.icon && <span>{item.icon}</span>}
                              <span>{item.label}</span>
                              <span className="text-[9px] font-normal text-sky-400/80">
                                ({item.segment})
                              </span>
                            </span>
                            <span className="text-[9px] text-zinc-500 truncate max-w-[110px] ml-1">
                              {item.description}
                            </span>
                            {isPresent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Ввод своего кастомного медиа-запроса */}
              <form
                onSubmit={handleAddCustomBreakpoint}
                className="pt-1.5 border-t border-zinc-800 flex items-center gap-1"
              >
                <input
                  type="text"
                  value={customBpInput}
                  onChange={(e) => setCustomBpInput(e.target.value)}
                  placeholder="max-width: 900px..."
                  className="flex-1 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-200 text-[10px] font-mono focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={!customBpInput.trim()}
                  className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-mono font-bold transition cursor-pointer"
                >
                  OK
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── МОДАЛКА КАСТОМИЗАЦИИ СТИЛЕЙ (открывается для активного скоупа) ── */}
      {isOpen && (
        <div className="fixed right-0 bottom-0 mb-1 z-50 w-[420px] max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2.5 flex flex-col gap-2.5 backdrop-blur-md select-none">
          {/* Шапка модалки */}
          <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
            <div className="">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono text-zinc-400 tracking-wider font-semibold flex  gap-2">
                  {activeScope === "base" ? (
                    <code className="text-emerald-400 font-bold">
                      .{currentClass}
                    </code>
                  ) : activeScope.startsWith("@media") ? (
                    (() => {
                      const seg = getSegmentDisplay(activeScope);
                      return (
                        <span className="font-mono text-sky-400 font-bold flex items-center gap-1.5 flex-wrap">
                          <code>.{currentClass}</code>
                          <span className="text-sky-300 bg-sky-950/80 border border-sky-600/70 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                            {seg.name && (
                              <span className="font-bold text-sky-400">
                                {seg.name}
                              </span>
                            )}
                            <span className="font-semibold text-white">
                              {seg.segment}
                            </span>
                            <span className="text-[9px] text-zinc-400 opacity-80 font-mono ml-1">
                              {activeScope}
                            </span>
                          </span>
                        </span>
                      );
                    })()
                  ) : (
                    <span className="font-mono text-amber-400 font-bold">
                      .{currentClass}{" "}
                      <span className="text-amber-300 bg-amber-950/80 border border-amber-600/70 px-1 py-0.5 rounded text-[10px]">
                        {activeScope}
                      </span>
                    </span>
                  )}
                </span>
              </div>
              {activeScope !== "base" && (
                <button
                  type="button"
                  onClick={() => handleSelectScope("base")}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 cursor-pointer transition"
                  title="Переключиться на редактирование базового класса"
                >
                  ← Base
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white text-xs cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>

          {/* Контейнер с подкомпонентами стилей */}
          <div className="overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-0.5">
            <DisplayControl
              currentClass={currentClass}
              currentScssText={effectiveScssText}
              onApplySnippet={handleScopedApplySnippet}
            />
            <UnifiedBoxControl
              currentClass={currentClass}
              currentScssText={effectiveScssText}
              onApplySnippet={handleScopedApplySnippet}
            />
            <ColorControl
              currentClass={currentClass}
              currentScssText={effectiveScssText}
              onApplySnippet={handleScopedApplySnippet}
            />

            <TypographyControl
              currentClass={currentClass}
              currentScssText={effectiveScssText}
              onApplySnippet={handleScopedApplySnippet}
            />

            <PositionControl
              currentClass={currentClass}
              currentScssText={effectiveScssText}
              onApplySnippet={handleScopedApplySnippet}
            />

            <TransformControl
              currentClass={currentClass}
              currentScssText={effectiveScssText}
              onApplySnippet={handleScopedApplySnippet}
            />

            <PresetsList onApplySnippet={handleScopedApplySnippet} />
          </div>
        </div>
      )}
    </div>
  );
}
