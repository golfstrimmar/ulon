// figmaColorStorage.ts

const DB_NAME = "ulon_figma_tokens_db";
const DB_VERSION = 1;

export const STORES = {
  COLOR_VARIABLES: "color_variables",
} as const;

const VARIABLES_KEY = "active_color_variables";

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.COLOR_VARIABLES)) {
        db.createObjectStore(STORES.COLOR_VARIABLES, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Вспомогательная функция: извлекает HEX из строки вида "--color-1: #162D5F;"
 */
function extractHex(line: string): string | null {
  const match = line.match(/#[0-9a-fA-F]{3,8}/);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Вспомогательная функция: извлекает максимальный номер переменной --color-N (или $color-N)
 */
function getMaxColorIndex(variables: string[]): number {
  let max = 0;
  for (const line of variables) {
    const match = line.match(/(?:\$|--)?color-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max;
}

/**
 * Получить массив переменных цветов
 */
export async function getColorVariables(): Promise<string[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.COLOR_VARIABLES, "readonly");
    const store = tx.objectStore(STORES.COLOR_VARIABLES);
    const req = store.get(VARIABLES_KEY);

    req.onsuccess = () => {
      resolve(Array.isArray(req.result?.variables) ? req.result.variables : []);
    };

    req.onerror = () =>
      reject(requestError(req.error, "Failed to get color variables"));
    tx.oncomplete = () => db.close();
  });
}

function requestError(err: DOMException | null, fallback: string): Error {
  return err || new Error(fallback);
}

/**
 * Сохранить массив переменных цветов (перезапись)
 */
export async function saveColorVariables(variables: string[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.COLOR_VARIABLES, "readwrite");
    const store = tx.objectStore(STORES.COLOR_VARIABLES);
    const req = store.put({ id: VARIABLES_KEY, variables: variables || [] });

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to save color variables"));
    tx.oncomplete = () => db.close();
  });
}

/**
 * ДОПОЛНИТЬ переменные с проверкой на дубли по HEX и авто-нумерацией (`--color-N: #HEX;`).
 * Возвращает итоговый объединённый массив переменных.
 */
export async function appendColorVariables(
  newTokens: Array<{ hex: string; original?: string }>,
): Promise<string[]> {
  const existingVars = await getColorVariables();

  const existingHexes = new Set<string>();
  for (const line of existingVars) {
    const hex = extractHex(line);
    if (hex) existingHexes.add(hex);
  }

  let nextIndex = getMaxColorIndex(existingVars) + 1;
  const uniqueIncomingLines: string[] = [];

  for (const token of newTokens) {
    if (!token.hex) continue;
    const hexLower = token.hex.toLowerCase().trim();
    if (!existingHexes.has(hexLower)) {
      existingHexes.add(hexLower);
      uniqueIncomingLines.push(`--color-${nextIndex}: ${token.hex};`);
      nextIndex++;
    }
  }

  const merged = [...existingVars, ...uniqueIncomingLines];

  if (uniqueIncomingLines.length > 0) {
    await saveColorVariables(merged);
  }

  return merged;
}

/**
 * Очистить переменные
 */
export async function clearColorVariables(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.COLOR_VARIABLES, "readwrite");
    const store = tx.objectStore(STORES.COLOR_VARIABLES);
    const req = store.delete(VARIABLES_KEY);

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to clear color variables"));
    tx.oncomplete = () => db.close();
  });
}

function isColorCssValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith("#") ||
    v.startsWith("rgb") ||
    v.startsWith("hsl") ||
    v === "transparent" ||
    /^[a-z]+$/.test(v)
  );
}

/**
 * Извлекает переменные цветов (`--btn-bg: #1e293b;`, `--color-1: #F9F9F9;` и др.) из `:root` в SCSS
 */
export function extractColorVariablesFromScss(scss: string): string[] {
  if (!scss) return [];
  const result: string[] = [];
  const seenNames = new Set<string>();

  // 1. Из всех блоков :root { ... }
  const rootRegex = /:root\s*\{([\s\S]*?)\}/gi;
  let rootMatch: RegExpExecArray | null;
  while ((rootMatch = rootRegex.exec(scss)) !== null) {
    const inner = rootMatch[1];
    const propRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+);?/g;
    let propMatch: RegExpExecArray | null;
    while ((propMatch = propRegex.exec(inner)) !== null) {
      const varName = propMatch[1].trim();
      const value = propMatch[2]
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/, "")
        .trim();

      if (value && isColorCssValue(value) && !seenNames.has(varName)) {
        seenNames.add(varName);
        result.push(`${varName}: ${value};`);
      }
    }
  }

  // 2. Фоллбэк для старых $color-... строк верхнего уровня (переводим в --...)
  const lines = scss.split("\n");
  for (const line of lines) {
    const match = line.trim().match(/^\$([a-zA-Z0-9_-]+)\s*:\s*([^;]+);?/);
    if (match) {
      const varName = `--${match[1].trim()}`;
      const value = match[2]
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/, "")
        .trim();
      if (value && isColorCssValue(value) && !seenNames.has(varName)) {
        seenNames.add(varName);
        result.push(`${varName}: ${value};`);
      }
    }
  }

  return result;
}

/**
 * Внедряет или обновляет переменные цветов внутри единого блока `:root { ... }` в начале SCSS
 */
export function embedColorVariablesIntoScss(
  scss: string,
  colorVariables: string[],
): string {
  // Убираем старые верхние блоки Project Colors и голые $color- / --color- вне фигурных скобок
  const lines = (scss || "").split("\n");
  const filteredLines: string[] = [];
  let inColorHeader = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("/* === Project Colors ===") ||
      trimmed.startsWith("// === Project Colors ===")
    ) {
      inColorHeader = true;
      continue;
    }
    if (
      inColorHeader &&
      (trimmed.startsWith("/* ===") || trimmed.startsWith("// ==="))
    ) {
      inColorHeader = false;
      continue;
    }
    if (inColorHeader) continue;

    if (
      braceDepth === 0 &&
      /^(\$|--)[a-zA-Z0-9_-]+\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/i.test(
        trimmed,
      )
    ) {
      continue;
    }

    for (const ch of line) {
      if (ch === "{") braceDepth++;
      else if (ch === "}" && braceDepth > 0) braceDepth--;
    }

    filteredLines.push(line);
  }

  let remainingScss = filteredLines.join("\n").trim();

  // Нормализуем входящие переменные в формат `--name: value;`
  const normalizedEntries: Array<{ name: string; value: string }> = [];
  for (const raw of colorVariables) {
    if (!raw || typeof raw !== "string") continue;
    const clean = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/, "")
      .trim()
      .replace(/;$/, "");
    const m = clean.match(/^(\$|--)?([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (m) {
      normalizedEntries.push({
        name: `--${m[2].trim()}`,
        value: m[3].trim(),
      });
    }
  }

  if (normalizedEntries.length === 0) {
    return remainingScss;
  }

  const rootMatch = remainingScss.match(/:root\s*\{([\s\S]*?)\}/i);
  if (rootMatch && rootMatch.index !== undefined) {
    let updatedRoot = rootMatch[0];
    for (const entry of normalizedEntries) {
      const escaped = entry.name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const propRegex = new RegExp(`(${escaped}\\s*:\\s*)([^;]+)(;)`, "i");
      if (propRegex.test(updatedRoot)) {
        updatedRoot = updatedRoot.replace(propRegex, `$1${entry.value}$3`);
      } else {
        updatedRoot = updatedRoot.replace(
          /\}\s*$/,
          `  ${entry.name}: ${entry.value};\n}`,
        );
      }
    }
    return `${remainingScss.slice(0, rootMatch.index)}${updatedRoot}${remainingScss.slice(rootMatch.index + rootMatch[0].length)}`.trim();
  }

  const rootBody = normalizedEntries
    .map((e) => `  ${e.name}: ${e.value};`)
    .join("\n");
  const rootBlock = `:root {\n${rootBody}\n}`;

  return remainingScss ? `${rootBlock}\n\n${remainingScss}` : rootBlock;
}

/**
 * Извлекает CSS-переменные цветов из `:root` в SCSS и синхронизирует их с базой
 */
export async function syncColorsFromScssToDb(scss: string): Promise<string[]> {
  if (!scss) return [];

  const extracted = extractColorVariablesFromScss(scss);
  if (extracted.length === 0) return [];

  const existingVars = await getColorVariables();
  const varMap = new Map<string, string>();
  const orderedNames: string[] = [];

  for (const entry of existingVars) {
    const m = entry.trim().match(/^(\$|--)?([a-zA-Z0-9_-]+)\s*:\s*([^;]+)/);
    if (m) {
      const name = `--${m[2].trim()}`;
      if (!varMap.has(name)) orderedNames.push(name);
      varMap.set(name, m[3].trim());
    }
  }

  let changed = false;
  for (const entry of extracted) {
    const m = entry.match(/^(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+)/);
    if (!m) continue;
    const name = m[1].trim();
    const val = m[2].trim();
    if (!varMap.has(name)) {
      orderedNames.push(name);
      varMap.set(name, val);
      changed = true;
    } else if (varMap.get(name) !== val) {
      varMap.set(name, val);
      changed = true;
    }
  }

  const nextVars = orderedNames.map((name) => `${name}: ${varMap.get(name)};`);

  if (changed) {
    await saveColorVariables(nextVars);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("figma_colors:saved", { detail: nextVars }),
      );
    }
  }

  return nextVars;
}

/**
 * Удаляет все объявления переменных цветов ($color-N, блок Project Colors и CSS-переменные цветов из :root) из SCSS текста
 */
export function removeColorVariablesFromScss(scss: string): string {
  if (!scss) return "";

  let cleaned = embedColorVariablesIntoScss(scss, []);

  cleaned = cleaned.replace(/:root\s*\{([^}]*)\}/gi, (_match, inner) => {
    const lines = inner.split("\n");
    const keptLines = lines.filter((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (
        /^--[\w-]+\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent|\$[a-zA-Z0-9_-]+)/i.test(
          trimmed,
        )
      ) {
        return false;
      }
      return true;
    });

    const remainingInner = keptLines.join("\n").trim();
    if (!remainingInner) {
      return "";
    }
    return `:root {\n  ${remainingInner}\n}`;
  });

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}
