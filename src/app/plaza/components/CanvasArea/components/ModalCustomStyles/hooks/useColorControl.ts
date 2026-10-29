// hooks/useColorControl.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLiveStyle } from "./useLiveStyle";
import { getColorVariables } from "@/lib/figmaColorStorage";

export interface ColorToken {
  name: string;
  varName: string;
  value: string;
  isDb?: boolean;
}

export type ColorTarget = "color" | "background" | "border";

interface UseColorControlProps {
  currentClass: string;
  currentScssText?: string;
  onApplySnippet: (snippetCss: string) => void;
}

// ─── УТИЛИТЫ ────────────────────────────────────────────────────────────────

export function colorToRgba(color: string | null | undefined): string {
  if (!color) return "";
  const c = color.trim().toLowerCase();
  if (c === "transparent") return "transparent";

  if (/^#[0-9a-f]{3}$/i.test(c)) {
    const r = parseInt(c[1] + c[1], 16);
    const g = parseInt(c[2] + c[2], 16);
    const b = parseInt(c[3] + c[3], 16);
    return `rgba(${r},${g},${b},1)`;
  }

  if (/^#[0-9a-f]{6}$/i.test(c)) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},1)`;
  }

  if (/^#[0-9a-f]{8}$/i.test(c)) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const a = +(parseInt(c.slice(7, 9), 16) / 255).toFixed(3);
    return `rgba(${r},${g},${b},${a})`;
  }

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

export function areColorsEqual(
  color1: string | null | undefined,
  color2: string | null | undefined,
): boolean {
  if (!color1 || !color2) return false;
  const c1 = color1
    .trim()
    .toLowerCase()
    .replace(/^(\$|--)/, "");
  const c2 = color2
    .trim()
    .toLowerCase()
    .replace(/^(\$|--)/, "");

  if (c1 === c2) return true;

  const rgba1 = colorToRgba(c1);
  const rgba2 = colorToRgba(c2);
  return Boolean(rgba1 && rgba2 && rgba1 === rgba2);
}

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

function parseDbVariablesToTokens(variables: string[]): ColorToken[] {
  const regex = /(\$[\w-]+|--[\w-]+)\s*:\s*([^;]+)/;
  return variables
    .map((str) => {
      const match = str.match(regex);
      if (!match) return null;

      const rawName = match[1].trim();
      const value = match[2].trim();
      const cleanName = rawName.replace(/^(\$|--)/, "");

      return {
        name: cleanName,
        varName: `--${cleanName}`,
        value,
        isDb: true,
      };
    })
    .filter(Boolean) as ColorToken[];
}

// ─── ХУК ────────────────────────────────────────────────────────────────────

export function useColorControl({
  currentClass,
  currentScssText = "",
  onApplySnippet,
}: UseColorControlProps) {
  const [target, setTarget] = useState<ColorTarget | null>(null);
  const [githubTokens, setGithubTokens] = useState<ColorToken[]>([]);
  const [dbTokens, setDbTokens] = useState<ColorToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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

  // Поиск цвета в тексте SCSS
  const extractTokenFromScss = useCallback(
    (prop: "color" | "background" | "border", scss: string): string | null => {
      if (!scss) return null;

      let varRegex: RegExp;
      if (prop === "border") {
        varRegex =
          /(?:^|\s|;)border(?:-color)?\s*:[^;]*(?:var\(\s*--([a-zA-Z0-9_-]+)\s*\)|\$([a-zA-Z0-9_-]+))/i;
      } else if (prop === "background") {
        varRegex =
          /(?:^|\s|;)background(?:-color)?\s*:[^;]*(?:var\(\s*--([a-zA-Z0-9_-]+)\s*\)|\$([a-zA-Z0-9_-]+))/i;
      } else {
        varRegex =
          /(?:^|\s|;)(?<!-)color\s*:[^;]*(?:var\(\s*--([a-zA-Z0-9_-]+)\s*\)|\$([a-zA-Z0-9_-]+))/i;
      }
      const varMatch = scss.match(varRegex);
      if (varMatch) return (varMatch[1] || varMatch[2]).trim();

      let transRegex: RegExp;
      if (prop === "border") {
        transRegex = /(?:^|\s|;)border(?:-color)?\s*:[^;]*\btransparent\b/i;
      } else if (prop === "background") {
        transRegex = /(?:^|\s|;)background(?:-color)?\s*:[^;]*\btransparent\b/i;
      } else {
        transRegex = /(?:^|\s|;)(?<!-)color\s*:[^;]*\btransparent\b/i;
      }
      if (transRegex.test(scss)) return "transparent";

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

  // Синхронизация текущего цвета
  useEffect(() => {
    const scssColor = extractTokenFromScss("color", currentScssText);
    const scssBg = extractTokenFromScss("background", currentScssText);
    const scssBorder = extractTokenFromScss("border", currentScssText);

    setActiveColors({
      color: scssColor || getComputedColorFromDom(currentClass, "color"),
      background: scssBg || getComputedColorFromDom(currentClass, "background"),
      border: scssBorder || getComputedColorFromDom(currentClass, "border"),
    });
  }, [currentClass, currentScssText, extractTokenFromScss]);

  // Загрузка токенов из IndexedDB
  useEffect(() => {
    getColorVariables()
      .then((vars) => setDbTokens(parseDbVariablesToTokens(vars)))
      .catch((err) => console.error("[useColorControl] DB error:", err));
  }, []);

  // Загрузка токенов из GitHub
  useEffect(() => {
    let isMounted = true;

    async function fetchGithubColors() {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(
          "https://raw.githubusercontent.com/golfstrimmar/ulon-design-tokens/main/colors.css",
        );
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const cssText = await res.text();
        const parsed: ColorToken[] = [];
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
            parsed.push({
              name: varName.replace(/^--/, ""),
              varName,
              value: rawValue,
              isDb: false,
            });
          }
        }

        if (isMounted) setGithubTokens(parsed);
      } catch (err) {
        console.error("[useColorControl] GitHub error:", err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchGithubColors();
    return () => {
      isMounted = false;
    };
  }, []);

  const allTokens = useMemo(() => {
    return [...dbTokens, ...githubTokens];
  }, [dbTokens, githubTokens]);

  const handleSelectColor = (token: ColorToken) => {
    if (!target) return;

    setActiveColors((prev) => ({
      ...prev,
      [target]: token.name,
    }));

    const cssVarSnippet = `var(${token.varName})`;

    if (target === "border") {
      applyLiveStyle(currentClass, "border", `1px solid ${token.value}` as any);
      onApplySnippet(`border: 1px solid ${cssVarSnippet};`);
    } else {
      applyLiveStyle(
        currentClass,
        target === "background" ? "background-color" : "color",
        token.value as any,
      );
      onApplySnippet(`${target}: ${cssVarSnippet};`);
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

  const getColorPreviewValue = (tokenOrColor: string | null): string => {
    if (!tokenOrColor || tokenOrColor === "transparent") return "transparent";
    const clean = tokenOrColor.trim().replace(/^(\$|--)/, "");
    const found = allTokens.find(
      (t) => t.name === clean || t.varName === tokenOrColor,
    );
    return found ? found.value : tokenOrColor;
  };

  return {
    target,
    setTarget,
    handleClose: () => setTarget(null),
    dbTokens,
    githubTokens,
    allTokens,
    activeColors,
    loading,
    error,
    handleSelectColor,
    handleSelectTransparent,
    getColorPreviewValue,
  };
}
