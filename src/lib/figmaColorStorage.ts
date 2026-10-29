/**
 * @file figmaColorStorage.ts
 * @description Хранилище массива SCSS-переменных цветов в IndexedDB.
 */

const DB_NAME = "ulon_figma_tokens_db";
const DB_VERSION = 1;

export const STORES = {
  COLOR_VARIABLES: "color_variables",
} as const;

const VARIABLES_KEY = "active_color_variables";

/**
 * Инициализация соединения
 */
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

/* ============================================================================
   COLOR SCSS VARIABLES (Массив строк)
   ============================================================================ */

/**
 * Сохранить массив SCSS-переменных (например: ["$color-1: #162D5F;", "$color-2: #2770F1;"])
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

// import { saveColorVariables } from "@/lib/figmaColorStorage";

// // 1. Записать в базу и отправить событие
// await saveColorVariables(variables);
// window.dispatchEvent(new CustomEvent("figma_colors:saved", { detail: variables }));

// // 2. Достать из базы и отправить событие
// const variables = await getColorVariables();
// window.dispatchEvent(new CustomEvent("figma_colors:loaded", { detail: variables }));

// // 3. Подписка на событие записи в шине
// window.addEventListener("figma_colors:saved", (e: CustomEvent<string[]>) => {
//   console.log("Записано:", e.detail);
// });

// // 4. Подписка на событие чтения в шине
// window.addEventListener("figma_colors:loaded", (e: CustomEvent<string[]>) => {
//   console.log("Достали:", e.detail);
// });
