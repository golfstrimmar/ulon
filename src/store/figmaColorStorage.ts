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
 * Вспомогательная функция: извлекает HEX из строки вида "$color-1: #162D5F;"
 */
function extractHex(line: string): string | null {
  const match = line.match(/#[0-9a-fA-F]{3,8}/);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Вспомогательная функция: извлекает максимальный номер переменной $color-N
 */
function getMaxColorIndex(variables: string[]): number {
  let max = 0;
  for (const line of variables) {
    const match = line.match(/\$color-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max;
}

/**
 * Получить массив SCSS-переменных
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
      reject(req.error || new Error("Failed to get color variables"));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Сохранить массив SCSS-переменных (перезапись)
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
 * ДОПОЛНИТЬ переменные с проверкой на дубли по HEX и авто-нумерацией.
 * Возвращает итоговый объединённый массив переменных.
 */
export async function appendColorVariables(
  newTokens: Array<{ hex: string; original?: string }>,
): Promise<string[]> {
  // 1. Читаем уже сохранённые переменные
  const existingVars = await getColorVariables();

  // 2. Собираем Set уже имеющихся HEX (в lowercase для точного сравнения)
  const existingHexes = new Set<string>();
  for (const line of existingVars) {
    const hex = extractHex(line);
    if (hex) existingHexes.add(hex);
  }

  // 3. Вычисляем стартовый индекс для новых переменных
  let nextIndex = getMaxColorIndex(existingVars) + 1;

  // 4. Фильтруем новые цвета: исключаем дубли из базы и дубли внутри новой пачки
  const uniqueIncomingLines: string[] = [];

  for (const token of newTokens) {
    const hexLower = token.hex.toLowerCase().trim();
    if (!existingHexes.has(hexLower)) {
      existingHexes.add(hexLower); // Чтобы не дублировались и внутри новой пачки

      const comment = token.original ? ` // ${token.original}` : "";
      uniqueIncomingLines.push(`$color-${nextIndex}: ${token.hex};${comment}`);
      nextIndex++;
    }
  }

  // 5. Объединяем старые и новые записи
  const merged = [...existingVars, ...uniqueIncomingLines];

  // 6. Сохраняем в базу только если появились новые уникальные цвета
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

/**
 * Извлекает все строки переменных цветов (например, "$color-1: #162D5F;") из SCSS текста
 */
export function extractColorVariablesFromScss(scss: string): string[] {
  if (!scss) return [];
  const lines = scss.split("\n");
  const result: string[] = [];
  const colorVarRegex = /^\s*(\$[a-zA-Z0-9_-]+)\s*:\s*([^;]+);?/;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(colorVarRegex);
    if (match) {
      const varName = match[1].trim();
      let value = match[2].trim().replace(/;$/, "");
      value = value
        .replace(/\/\/.*$/, "")
        .replace(/\/\*.*?\*\//g, "")
        .trim();

      if (
        value.startsWith("#") ||
        value.startsWith("rgb") ||
        value.startsWith("hsl") ||
        value === "transparent" ||
        /^[a-zA-Z]+$/.test(value)
      ) {
        result.push(`${varName}: ${value};`);
      }
    }
  }
  return result;
}

/**
 * Внедряет или обновляет блок переменных цветов в самом начале SCSS кода
 */
export function embedColorVariablesIntoScss(
  scss: string,
  colorVariables: string[],
): string {
  const cleanVars = colorVariables
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (v.endsWith(";") ? v : `${v};`));

  // Очищаем существующие верхние строки объявления $color-...
  const lines = (scss || "").split("\n");
  const filteredLines: string[] = [];
  let inColorHeader = false;

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

    // Убираем одиночные строки вида $color-N: #...
    if (
      /^\$[a-zA-Z0-9_-]+\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i.test(
        trimmed,
      )
    ) {
      continue;
    }

    filteredLines.push(line);
  }

  const remainingScss = filteredLines.join("\n").trim();

  if (cleanVars.length === 0) {
    return remainingScss;
  }

  const headerBlock = `/* === Project Colors === */\n${cleanVars.join(
    "\n",
  )}\n/* ===================== */`;
  return remainingScss ? `${headerBlock}\n\n${remainingScss}` : headerBlock;
}

/**
 * Извлекает переменные цветов из CSS/SCSS (особенно из :root) и сохраняет их в базу
 */
export async function syncColorsFromScssToDb(scss: string): Promise<string[]> {
  if (!scss) return [];

  const colorVarRegex = /(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/gi;
  const tokens: Array<{ hex: string; original?: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = colorVarRegex.exec(scss)) !== null) {
    const varName = m[1];
    const val = m[2];
    if (val.startsWith("#")) {
      tokens.push({ hex: val, original: varName });
    }
  }

  if (tokens.length > 0) {
    const updated = await appendColorVariables(tokens);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("figma_colors:saved", { detail: updated }),
      );
    }
    return updated;
  }
  return [];
}

/**
 * Удаляет все объявления переменных цветов ($color-N, блок Project Colors и CSS-переменные цветов из :root) из SCSS текста
 */
export function removeColorVariablesFromScss(scss: string): string {
  if (!scss) return "";

  // 1. Удаляем блок /* === Project Colors === */ и одиночные $color-...
  let cleaned = embedColorVariablesIntoScss(scss, []);

  // 2. Очищаем блоки :root
  cleaned = cleaned.replace(/:root\s*\{([^}]+)\}/gi, (match, inner) => {
    const lines = inner.split("\n");
    const keptLines = lines.filter((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      // Если это CSS-переменная (--...) со значением цвета
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
      return ""; // удаляем пустой блок :root полностью
    }
    return `:root {\n  ${remainingInner}\n}`;
  });

  // Убираем лишние пустые строки (более двух подряд)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}
