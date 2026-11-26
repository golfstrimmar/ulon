"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import ModalActiveScopeStyles from "../ModalActiveScopeStyles";
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

// Quick list of main pseudo-elements for the panel
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
//  ─────🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹──────
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

  // Dropdowns
  const [isPseudoDropdownOpen, setIsPseudoDropdownOpen] = useState(false);
  const [isBpDropdownOpen, setIsBpDropdownOpen] = useState(false);

  // Координаты для Portal (выпадашки открываются вверх и рендерятся в document.body поверх всех модалок)
  const [pseudoCoords, setPseudoCoords] = useState<{
    left: number;
    bottom: number;
    maxHeight: number;
  } | null>(null);
  const [bpCoords, setBpCoords] = useState<{
    left: number;
    bottom: number;
    maxHeight: number;
  } | null>(null);

  // Custom inputs
  const [customSelectorInput, setCustomSelectorInput] = useState("");
  const [customBpInput, setCustomBpInput] = useState("");

  const pseudoButtonRef = useRef<HTMLButtonElement>(null);
  const bpButtonRef = useRef<HTMLButtonElement>(null);
  const pseudoDropdownContentRef = useRef<HTMLDivElement>(null);
  const bpDropdownContentRef = useRef<HTMLDivElement>(null);

  const activeScope = externalScope ?? internalScope;

  const updatePseudoCoords = useCallback(() => {
    if (!pseudoButtonRef.current || typeof window === "undefined") return;
    const rect = pseudoButtonRef.current.getBoundingClientRect();
    const dropdownWidth = 260;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - dropdownWidth - 8),
    );
    const bottom = window.innerHeight - rect.top + 4;
    const maxHeight = Math.min(380, Math.max(160, rect.top - 16));
    setPseudoCoords({ left, bottom, maxHeight });
  }, []);

  const updateBpCoords = useCallback(() => {
    if (!bpButtonRef.current || typeof window === "undefined") return;
    const rect = bpButtonRef.current.getBoundingClientRect();
    const dropdownWidth = 290;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - dropdownWidth - 8),
    );
    const bottom = window.innerHeight - rect.top + 4;
    const maxHeight = Math.min(420, Math.max(160, rect.top - 16));
    setBpCoords({ left, bottom, maxHeight });
  }, []);

  const togglePseudoDropdown = useCallback(() => {
    if (!isPseudoDropdownOpen) {
      updatePseudoCoords();
      setIsBpDropdownOpen(false);
      setIsPseudoDropdownOpen(true);
    } else {
      setIsPseudoDropdownOpen(false);
    }
  }, [isPseudoDropdownOpen, updatePseudoCoords]);

  const toggleBpDropdown = useCallback(() => {
    if (!isBpDropdownOpen) {
      updateBpCoords();
      setIsPseudoDropdownOpen(false);
      setIsBpDropdownOpen(true);
    } else {
      setIsBpDropdownOpen(false);
    }
  }, [isBpDropdownOpen, updateBpCoords]);

  const handleSelectScope = (scope: string) => {
    setInternalScope(scope);
    if (onScopeChange) {
      onScopeChange(scope);
    }
    // Clicking a scope opens the modal for it
    setIsOpen(true);
    setIsPseudoDropdownOpen(false);
    setIsBpDropdownOpen(false);
  };

  // Close dropdowns when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isPseudoDropdownOpen &&
        pseudoDropdownContentRef.current &&
        !pseudoDropdownContentRef.current.contains(target) &&
        pseudoButtonRef.current &&
        !pseudoButtonRef.current.contains(target)
      ) {
        setIsPseudoDropdownOpen(false);
      }
      if (
        isBpDropdownOpen &&
        bpDropdownContentRef.current &&
        !bpDropdownContentRef.current.contains(target) &&
        bpButtonRef.current &&
        !bpButtonRef.current.contains(target)
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

  // Пересчет позиции при скролле или ресайзе
  useEffect(() => {
    if (!isPseudoDropdownOpen && !isBpDropdownOpen) return;
    const handleScrollOrResize = () => {
      if (isPseudoDropdownOpen) updatePseudoCoords();
      if (isBpDropdownOpen) updateBpCoords();
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [
    isPseudoDropdownOpen,
    isBpDropdownOpen,
    updatePseudoCoords,
    updateBpCoords,
  ]);

  if (!currentClass) return null;

  // Extract pseudo-selectors and media queries already present in the class code
  const presentPseudos = extractExistingPseudoSelectors(currentScssText);
  const presentMediaQueries = extractExistingMediaQueries(currentScssText);

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

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap">
      {/* ── QUICK PSEUDO-ELEMENT BUTTONS ON THE PANEL ── */}
      <div className="flex items-center gap-1 flex-wrap">
        {/*{QUICK_PSEUDOS.map((pseudo) => {
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
                title={`Open customization for ${pseudo}`}
              >
                <span>{pseudo}</span>
                {isPresent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}*/}

        {/* Additional pseudo-selectors already present in the class code (but not in quick) */}
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

        {/* Dropdown "▾ Pseudo" for the full list of pseudo-elements */}
        <div className="relative inline-block">
          <button
            ref={pseudoButtonRef}
            type="button"
            onClick={togglePseudoDropdown}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer flex items-center gap-1 ${
              isPseudoDropdownOpen
                ? "bg-amber-600 border-amber-400 text-white font-bold"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800"
            }`}
            title="Choose another pseudo-element or pseudo-class"
          >
            <span>▾ Pseudo</span>
          </button>

          {isPseudoDropdownOpen &&
            pseudoCoords &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={pseudoDropdownContentRef}
                style={{
                  left: pseudoCoords.left,
                  bottom: 0,
                }}
                className="fixed z-[99999] w-64 bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-2xl p-2 flex flex-col gap-1.5 backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar pr-0.5">
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
                        <span className="text-[9px] text-zinc-400 truncate max-w-[120px]">
                          {item.label.replace(item.selector, "")}
                        </span>
                        {isPresent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Enter your own custom selector */}
                <form
                  onSubmit={handleAddCustomPseudo}
                  className="pt-1.5 border-t border-zinc-800 flex items-center gap-1 shrink-0"
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
              </div>,
              document.body,
            )}
        </div>
      </div>

      {/* ── BREAKPOINTS / MEDIA QUERIES BY SEGMENTS ── */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Quick buttons for screen segments (2XL, XL, LG, MD, SM, XS, XXS) */}
        {/*{QUICK_BREAKPOINTS.map((bp) => {
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
          })}*/}

        {/* Additional media queries already present in the SCSS (but not in QUICK) */}
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

        {/* Dropdown "▾ Media" */}
        <div className="relative inline-block">
          <button
            ref={bpButtonRef}
            type="button"
            onClick={toggleBpDropdown}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer flex items-center gap-1 ${
              isBpDropdownOpen
                ? "bg-sky-600 border-sky-400 text-white font-bold"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-sky-300 hover:bg-zinc-800"
            }`}
            title="Choose a media query or set up a custom segment"
          >
            <span>▾ Media</span>
          </button>

          {isBpDropdownOpen &&
            bpCoords &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={bpDropdownContentRef}
                style={{
                  left: bpCoords.left,
                  bottom: 0,
                }}
                className="fixed z-[99999] w-72 bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-2xl p-2 flex flex-col gap-1.5 backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-100"
              >
                <span className="text-[10px] font-mono text-zinc-400 font-bold px-1">
                  Select a media query (breakpoint):
                </span>

                <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 ">
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
                              <span className="text-[9px] text-zinc-400 truncate max-w-[110px] ml-1">
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

                {/* Enter your own custom media query */}
                <form
                  onSubmit={handleAddCustomBreakpoint}
                  className="pt-1.5 border-t border-zinc-800 flex items-center gap-1 shrink-0"
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
              </div>,
              document.body,
            )}
        </div>
      </div>

      {/* ── STYLE CUSTOMIZATION MODAL (opens for the active scope) ── */}
      <ModalActiveScopeStyles
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentClass={currentClass}
        activeScope={activeScope}
        currentScssText={currentScssText}
        onApplySnippet={onApplySnippet}
        onSelectScope={handleSelectScope}
      />
    </div>
  );
}
