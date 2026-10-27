import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";
import { motion, AnimatePresence } from "framer-motion";

interface ColorToken {
  name: string;
  varName: string;
  value: string;
}

type ColorTarget = "color" | "background" | "border";

interface Props {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

// 🔹 Преобразование цвета (hex, rgb, rgba, transparent) в нормализованную строку rgba
function colorToRgba(color: string | null | undefined): string {
  if (!color) return "";
  const c = color.trim().toLowerCase();
  if (c === "transparent") return "transparent";

  // 3-значный hex #abc
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    const r = parseInt(c[1] + c[1], 16);
    const g = parseInt(c[2] + c[2], 16);
    const b = parseInt(c[3] + c[3], 16);
    return `rgba(${r},${g},${b},1)`;
  }

  // 6-значный hex #aabbcc
  if (/^#[0-9a-f]{6}$/i.test(c)) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},1)`;
  }

  // 8-значный hex #aabbccff
  if (/^#[0-9a-f]{8}$/i.test(c)) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const a = +(parseInt(c.slice(7, 9), 16) / 255).toFixed(3);
    return `rgba(${r},${g},${b},${a})`;
  }

  // rgb(...) или rgba(...)
  const rgbMatch = c.match(
    /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    return `rgba(${r},${g},${b},${a})`;
  }

  return c;
}

// 🔹 Сравнение двух цветов (по имени переменной, по hex или по rgba)
function areColorsEqual(
  color1: string | null | undefined,
  color2: string | null | undefined,
): boolean {
  if (!color1 || !color2) return false;
  const c1 = color1.trim().toLowerCase().replace(/^--/, "");
  const c2 = color2.trim().toLowerCase().replace(/^--/, "");

  if (c1 === c2) return true;

  const rgba1 = colorToRgba(c1);
  const rgba2 = colorToRgba(c2);
  if (rgba1 && rgba2 && rgba1 === rgba2) return true;

  return false;
}

// 🔹 Фоллбэк: извлечение вычисленного цвета элемента из DOM (iframe или основной документ)
function getComputedColorFromDom(
  className: string,
  targetProp: "color" | "background" | "border",
): string | null {
  if (typeof window === "undefined" || !className) return null;
  try {
    const clean = className.trim().replace(/^\./, "");
    const candidates: Element[] = [];

    document.querySelectorAll("iframe").forEach((iframe) => {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const found = doc.querySelector(`.${clean}`);
          if (found) candidates.push(found);
        }
      } catch {}
    });

    if (candidates.length === 0) {
      const found = document.querySelector(`.${clean}`);
      if (found) candidates.push(found);
    }

    if (candidates.length === 0) return null;

    const el = candidates[0];
    const win = el.ownerDocument.defaultView || window;
    const computed = win.getComputedStyle(el);

    if (targetProp === "color") {
      const val = computed.color;
      return val && val !== "rgba(0, 0, 0, 0)" ? val : null;
    }

    if (targetProp === "background") {
      const val = computed.backgroundColor;
      return val && val !== "rgba(0, 0, 0, 0)" && val !== "transparent"
        ? val
        : null;
    }

    if (targetProp === "border") {
      const width = parseFloat(computed.borderWidth) || 0;
      if (width > 0 && computed.borderStyle !== "none") {
        const val = computed.borderColor;
        return val && val !== "rgba(0, 0, 0, 0)" && val !== "transparent"
          ? val
          : null;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

export function ColorControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: Props) {
  // Палитра закрыта по умолчанию — открывается только явным кликом
  const [target, setTarget] = useState<ColorTarget | null>(null);
  const [tokens, setTokens] = useState<ColorToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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

  const [activeColors, setActiveColors] = useState<{
    color: string | null;
    background: string | null;
    border: string | null;
  }>({
    color: null,
    background: null,
    border: null,
  });

  const { applyLiveStyle } = useLiveStyle();

  // 🔹 Умный поиск текущего цвета в SCSS (ищет var(--...), HEX, RGB, transparent)
  const extractTokenFromScss = useCallback(
    (prop: "color" | "background" | "border", scss: string): string | null => {
      if (!scss) return null;

      // 1. Поиск var(--...)
      let varRegex: RegExp;
      if (prop === "border") {
        varRegex =
          /(?:^|\s|;)border(?:-color)?\s*:[^;]*var\(\s*--([a-zA-Z0-9_-]+)\s*\)/i;
      } else if (prop === "background") {
        varRegex =
          /(?:^|\s|;)background(?:-color)?\s*:[^;]*var\(\s*--([a-zA-Z0-9_-]+)\s*\)/i;
      } else {
        varRegex =
          /(?:^|\s|;)(?<!-)color\s*:[^;]*var\(\s*--([a-zA-Z0-9_-]+)\s*\)/i;
      }
      const varMatch = scss.match(varRegex);
      if (varMatch) return varMatch[1].trim();

      // 2. Поиск transparent
      let transRegex: RegExp;
      if (prop === "border") {
        transRegex = /(?:^|\s|;)border(?:-color)?\s*:[^;]*\btransparent\b/i;
      } else if (prop === "background") {
        transRegex = /(?:^|\s|;)background(?:-color)?\s*:[^;]*\btransparent\b/i;
      } else {
        transRegex = /(?:^|\s|;)(?<!-)color\s*:[^;]*\btransparent\b/i;
      }
      if (transRegex.test(scss)) return "transparent";

      // 3. Поиск прямого HEX (#fff, #1e293b) или RGB
      let rawRegex: RegExp;
      if (prop === "border") {
        rawRegex =
          /(?:^|\s|;)border(?:-color)?\s*:[^;]*\b(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i;
      } else if (prop === "background") {
        rawRegex =
          /(?:^|\s|;)background(?:-color)?\s*:[^;]*\b(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i;
      } else {
        rawRegex =
          /(?:^|\s|;)(?<!-)color\s*:[^;]*\b(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i;
      }
      const rawMatch = scss.match(rawRegex);
      if (rawMatch) return rawMatch[1].trim();

      return null;
    },
    [],
  );

  // 🔹 Обновляем цвета ноды при смене классов или SCSS — НЕ трогаем target
  useEffect(() => {
    const scssColor = extractTokenFromScss("color", currentScssText);
    const scssBg = extractTokenFromScss("background", currentScssText);
    const scssBorder = extractTokenFromScss("border", currentScssText);

    const detectedColor =
      scssColor || getComputedColorFromDom(currentClass, "color");
    const detectedBg =
      scssBg || getComputedColorFromDom(currentClass, "background");
    const detectedBorder =
      scssBorder || getComputedColorFromDom(currentClass, "border");

    setActiveColors({
      color: detectedColor,
      background: detectedBg,
      border: detectedBorder,
    });
    // target НЕ меняем: палитра остаётся закрытой до явного клика
  }, [currentClass, currentScssText, extractTokenFromScss]);

  // 🔹 Загрузка токенов из GitHub
  useEffect(() => {
    let isMounted = true;

    async function fetchColors() {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(
          "https://raw.githubusercontent.com/golfstrimmar/ulon-design-tokens/main/colors.css",
        );
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const cssText = await res.text();
        const parsedTokens: ColorToken[] = [];
        const regex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
        let match;

        while ((match = regex.exec(cssText)) !== null) {
          const varName = match[1].trim();
          const rawValue = match[2].trim();

          if (
            rawValue.startsWith("#") ||
            rawValue.startsWith("rgb") ||
            rawValue.startsWith("hsl")
          ) {
            parsedTokens.push({
              name: varName.replace(/^--/, ""),
              varName,
              value: rawValue,
            });
          }
        }

        if (isMounted) {
          setTokens(parsedTokens);
        }
      } catch (err) {
        console.error("[ColorControl] Ошибка загрузки colors.css:", err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchColors();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleClose = () => {
    setTarget(null);
  };

  const handleSelectColor = (token: ColorToken) => {
    if (!target) return;

    setActiveColors((prev) => ({
      ...prev,
      [target]: token.name,
    }));

    if (target === "border") {
      applyLiveStyle(currentClass, "border", `1px solid ${token.value}` as any);
      onApplySnippet(`border: 1px solid var(${token.varName});`);
    } else {
      applyLiveStyle(
        currentClass,
        target === "background" ? "background-color" : "color",
        token.value as any,
      );
      onApplySnippet(`${target}: var(${token.varName});`);
    }
  };

  const handleSelectTransparent = () => {
    if (!target) return;

    setActiveColors((prev) => ({
      ...prev,
      [target]: "transparent",
    }));

    if (target === "border") {
      applyLiveStyle(currentClass, "border", "1px solid transparent" as any);
      onApplySnippet("border: 1px solid transparent;");
    } else {
      applyLiveStyle(
        currentClass,
        target === "background" ? "background-color" : "color",
        "transparent" as any,
      );
      onApplySnippet(`${target}: transparent;`);
    }
  };

  const currentActiveToken = target ? activeColors[target] : null;

  // 🔹 Вспомогательная функция для получения preview цвета на кнопках-переключателях
  const getColorPreviewValue = (tokenOrColor: string | null): string => {
    if (!tokenOrColor) return "transparent";
    if (tokenOrColor === "transparent") return "transparent";
    const clean = tokenOrColor.trim().replace(/^--/, "");
    const found = tokens.find(
      (t) => t.name === clean || t.varName === tokenOrColor,
    );
    if (found) return found.value;
    return tokenOrColor;
  };

  //  ─────🔹 ПАЛИТРА 🔹──────
  const renderPalette = () => {
    const isTransSelected = areColorsEqual(currentActiveToken, "transparent");

    return (
      <div className="max-h-[150px] overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 p-1 bg-zinc-900/60 rounded border border-zinc-850">
        {/* 🏁 1-Й КУБИК: TRANSPARENT */}
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

        {/* ОСТАЛЬНЫЕ КУБИКИ ИЗ GITHUB */}
        {tokens.map((token) => {
          // 🔹 Сопоставление по имени, переменной или реальному значению цвета
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

        {/* Переключатель Text / Background / Border */}
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
                {/* 🎯 Индикатор цвета, уже имеющегося на ноде */}
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

        {/* Кнопка закрытия / сворачивания палитры */}
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

      {/* Сетка кубиков */}
      {loading ? (
        <div className="py-4 text-center text-[10px] font-mono text-zinc-500 animate-pulse">
          Загрузка цветов из GitHub...
        </div>
      ) : error ? (
        <div className="py-3 text-center text-[10px] font-mono text-rose-400 bg-rose-950/20 rounded border border-rose-900/40">
          Не удалось загрузить colors.css
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
