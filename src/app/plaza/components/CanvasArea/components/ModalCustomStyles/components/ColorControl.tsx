import React, { useState, useEffect, useCallback } from "react";
import { useLiveStyle } from "../hooks/useLiveStyle";

interface ColorToken {
  name: string;
  varName: string;
  value: string;
}

// 👈 Добавили "border"
type ColorTarget = "color" | "background" | "border";

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
  const [target, setTarget] = useState<ColorTarget>("color");
  const [tokens, setTokens] = useState<ColorToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // 🔹 Раздельный учет цвета для текста, фона и рамки
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

  // 🔹 Парсим текущий SCSS ноды (для color, background и border)
  const extractTokenFromScss = useCallback(
    (prop: ColorTarget, scss: string): string | null => {
      if (!scss) return null;

      // 1. Проверяем BORDER
      if (prop === "border") {
        if (/(?:^|\s|;)border(?:-color)?\s*:[^;]*\btransparent\b/i.test(scss)) {
          return "transparent";
        }
        const match = scss.match(
          /(?:^|\s|;)border(?:-color)?\s*:[^;]*var\(\s*--([a-zA-Z0-9_-]+)\s*\)/i,
        );
        return match ? match[1] : null;
      }

      // 2. Проверяем TRANSPARENT для color и background
      const isTrans = new RegExp(
        `(?:^|\\s|;)${prop === "color" ? "color" : "background(?:-color)?"}\\s*:\\s*transparent`,
        "i",
      ).test(scss);
      if (isTrans) return "transparent";

      // 3. Проверяем VAR для color и background
      const regex =
        prop === "color"
          ? /(?:^|\s|;)color\s*:\s*var\(\s*--([a-zA-Z0-9_-]+)\s*\)/i
          : /(?:^|\s|;)background(?:-color)?\s*:\s*var\(\s*--([a-zA-Z0-9_-]+)\s*\)/i;
      const match = scss.match(regex);
      return match ? match[1] : null;
    },
    [],
  );

  useEffect(() => {
    setActiveColors({
      color: extractTokenFromScss("color", currentScssText),
      background: extractTokenFromScss("background", currentScssText),
      border: extractTokenFromScss("border", currentScssText),
    });
  }, [currentClass, currentScssText, extractTokenFromScss]);

  // Загрузка токенов напрямую из GitHub
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
        console.error(
          "[ColorControl] Не удалось загрузить цвета с GitHub:",
          err,
        );
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

  // 🔹 Выбор обычного токена цвета
  const handleSelectColor = (token: ColorToken) => {
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

  // 🔹 Выбор прозрачного цвета
  const handleSelectTransparent = () => {
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

  const currentActiveToken = activeColors[target];

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 flex flex-col gap-2 shadow-inner">
      {/* Шапка: Выбор режима */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
          Tokens palette:
        </span>

        {/* Переключатель Text / Background / Border */}
        <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => setTarget("color")}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
              target === "color"
                ? "bg-rose-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Text</span>
            {activeColors.color && (
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setTarget("background")}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
              target === "background"
                ? "bg-purple-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Bg</span>
            {activeColors.background && (
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setTarget("border")}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
              target === "border"
                ? "bg-amber-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Border</span>
            {activeColors.border && (
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </button>
        </div>
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
        <div className="max-h-[150px] overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 p-1 bg-zinc-900/60 rounded border border-zinc-850">
          {/* 🏁 1-Й КУБИК: TRANSPARENT */}
          <button
            type="button"
            onClick={handleSelectTransparent}
            title="transparent (прозрачный)"
            className={`w-5 h-5 rounded transition-all cursor-pointer relative shrink-0 border ${
              currentActiveToken === "transparent"
                ? "scale-115 border-white shadow-[0_0_8px_rgba(255,255,255,0.7)] z-10"
                : "border-zinc-700 hover:scale-110 hover:border-white/80"
            }`}
            style={{
              background:
                "repeating-conic-gradient(#555 0% 25%, #222 0% 50%) 50% / 8px 8px",
            }}
          >
            {currentActiveToken === "transparent" && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black drop-shadow text-white">
                ✓
              </span>
            )}
          </button>

          {/* ОСТАЛЬНЫЕ КУБИКИ ИЗ GITHUB */}
          {tokens.map((token) => {
            const isSelected = currentActiveToken === token.name;

            return (
              <button
                key={token.varName}
                type="button"
                onClick={() => handleSelectColor(token)}
                title={`${token.varName}\n${token.value}`}
                className={`w-5 h-5 rounded transition-all cursor-pointer relative shrink-0 border ${
                  isSelected
                    ? "scale-115 border-white shadow-[0_0_8px_rgba(255,255,255,0.7)] z-10"
                    : "border-black/40 hover:scale-110 hover:border-white/80"
                }`}
                style={{ backgroundColor: token.value }}
              >
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black drop-shadow text-white">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
