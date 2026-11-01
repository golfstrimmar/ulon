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
