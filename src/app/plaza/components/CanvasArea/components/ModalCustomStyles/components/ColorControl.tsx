import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useColorControl,
  areColorsEqual,
  type ColorTarget,
} from "../hooks/useColorControl";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

export function ColorControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  const {
    target,
    setTarget,
    handleClose,
    dbTokens,
    githubTokens,
    allTokens,
    activeColors,
    loading,
    error,
    handleSelectColor,
    handleSelectTransparent,
    getColorPreviewValue,
  } = useColorControl({ currentClass, currentScssText, onApplySnippet });

  const colorTargets = useMemo(
    () => [
      {
        id: "color" as const,
        label: "color",
        activeClass: "bg-sky-500/50 text-white shadow-rose-500/30",
      },
      {
        id: "background" as const,
        label: "Bg",
        activeClass: "bg-indigo-500/50 text-white shadow-purple-500/30",
      },
      {
        id: "border" as const,
        label: "border",
        activeClass: "bg-amber-500/50 text-white shadow-amber-500/30",
      },
    ],
    [],
  );

  const currentActiveToken = target ? activeColors[target] : null;

  const renderPalette = () => {
    const isTransSelected = areColorsEqual(currentActiveToken, "transparent");

    return (
      <div className="max-h-[160px] overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 p-1 bg-zinc-900/60 rounded border border-zinc-850">
        {/* 1. Transparent */}
        <button
          type="button"
          onClick={handleSelectTransparent}
          title="transparent (прозрачный)"
          className={`w-5 h-5 rounded transition-all cursor-pointer relative shrink-0 border ${
            isTransSelected
              ? "scale-115 border-white shadow-[0_0_8px_rgba(255,255,255,0.7)] z-10"
              : "border-zinc-700 hover:scale-110 hover:border-white/80"
          }`}
          style={{
            background:
              "repeating-conic-gradient(#555 0% 25%, #222 0% 50%) 50% / 8px 8px",
          }}
        >
          {isTransSelected && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black drop-shadow text-white select-none">
              ✓
            </span>
          )}
        </button>

        {/* 2. Цвета из IndexedDB (Figma) */}
        {dbTokens.map((token) => {
          const isSelected =
            Boolean(currentActiveToken) &&
            (areColorsEqual(currentActiveToken, token.name) ||
              areColorsEqual(currentActiveToken, token.varName) ||
              areColorsEqual(currentActiveToken, token.value));

          return (
            <button
              key={`db-${token.varName}`}
              type="button"
              onClick={() => handleSelectColor(token)}
              title={`[DB] ${token.varName}\n${token.value}`}
              className={`w-5 h-5 rounded transition-all cursor-pointer relative shrink-0 border ring-1 ring-blue-500/40 ${
                isSelected
                  ? "scale-115 border-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 ring-2 ring-white/60"
                  : "border-black/50 hover:scale-110 hover:border-white/80"
              }`}
              style={{ backgroundColor: token.value }}
            >
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black drop-shadow text-white select-none">
                  ✓
                </span>
              )}
            </button>
          );
        })}

        {/* Разделитель между базой и GitHub */}
        {dbTokens.length > 0 && githubTokens.length > 0 && (
          <div className="w-[1px] h-5 bg-zinc-700/80 mx-0.5 shrink-0 self-center" />
        )}

        {/* 3. Цвета из GitHub */}
        {githubTokens.map((token) => {
          const isSelected =
            Boolean(currentActiveToken) &&
            (areColorsEqual(currentActiveToken, token.name) ||
              areColorsEqual(currentActiveToken, token.varName) ||
              areColorsEqual(currentActiveToken, token.value));

          return (
            <button
              key={token.varName}
              type="button"
              onClick={() => handleSelectColor(token)}
              title={`${token.varName}\n${token.value}`}
              className={`w-5 h-5 rounded transition-all cursor-pointer relative shrink-0 border ${
                isSelected
                  ? "scale-115 border-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 ring-2 ring-white/40"
                  : "border-black/40 hover:scale-110 hover:border-white/80"
              }`}
              style={{ backgroundColor: token.value }}
            >
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black drop-shadow text-white select-none">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
      {/* Шапка: Выбор режима */}
      <div className="flex items-center">
        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
          Colors:
        </span>

        <div className="flex items-center ml-3 gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
          {colorTargets.map((t) => {
            const hasColorOnNode = Boolean(activeColors[t.id]);
            const previewColor = getColorPreviewValue(activeColors[t.id]);
            const isTargetActive = target === t.id;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTarget(t.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  isTargetActive
                    ? `${t.activeClass} shadow`
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
                title={
                  hasColorOnNode
                    ? `${t.label}: ${activeColors[t.id]}`
                    : `${t.label} (не задан)`
                }
              >
                {hasColorOnNode && (
                  <span
                    className="w-2 h-2 rounded-full border border-white/60 shadow-sm shrink-0"
                    style={{
                      backgroundColor:
                        previewColor === "transparent" ? "#555" : previewColor,
                    }}
                  />
                )}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {target && (
          <div className="ml-auto">
            <button
              type="button"
              onClick={handleClose}
              title="Свернуть палитру"
              className="w-5 h-5 rounded bg-zinc-800 hover:bg-red-600 border border-zinc-700 text-white text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Палитра */}
      {loading && allTokens.length === 0 ? (
        <div className="py-4 text-center text-[10px] font-mono text-zinc-500 animate-pulse">
          Загрузка цветов...
        </div>
      ) : error && allTokens.length === 0 ? (
        <div className="py-3 text-center text-[10px] font-mono text-rose-400 bg-rose-950/20 rounded border border-rose-900/40">
          Не удалось загрузить палитру
        </div>
      ) : (
        <AnimatePresence>
          {target && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="pl-2 py-0.5 space-y-1 border-l-2 border-indigo-500/50 overflow-hidden"
            >
              {renderPalette()}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
