/**
 * @file htmlStorage.ts
 * @description Единый изолированный слой IndexedDB.
 * Хранилище HTML-деревьев, глобального SCSS-бандла, JS-скриптов и настроек.
 */

import { HtmlNode } from "@/types/HtmlNode";

const DB_NAME = "ulon_plaza_db";
const DB_VERSION = 1;

// Изолированные таблицы базы данных
export const STORES = {
  HTML_TREES: "html_trees", // Деревья разметки (HtmlNode)
  CLASSES_CSS: "classes_css", // Хранилище SCSS/CSS бандла
  SCRIPTS_JS: "scripts_js", // Словарь пользовательских JS-скриптов
  PREVIEW_SETTINGS: "settings", // Настройки шрифтов
} as const;

/**
 * Инициализация соединения и создание изолированных хранилищ
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Таблица для HTML-деревьев
      if (!db.objectStoreNames.contains(STORES.HTML_TREES)) {
        db.createObjectStore(STORES.HTML_TREES, { keyPath: "id" });
      }

      // 2. Таблица для SCSS/CSS
      if (!db.objectStoreNames.contains(STORES.CLASSES_CSS)) {
        db.createObjectStore(STORES.CLASSES_CSS, { keyPath: "id" });
      }

      // 3. Таблица для JS-скриптов
      if (!db.objectStoreNames.contains(STORES.SCRIPTS_JS)) {
        db.createObjectStore(STORES.SCRIPTS_JS, { keyPath: "id" });
      }

      // 4. Таблица для настроек шрифтов
      if (!db.objectStoreNames.contains(STORES.PREVIEW_SETTINGS)) {
        db.createObjectStore(STORES.PREVIEW_SETTINGS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/* ============================================================================
   1. HTML TREES (Деревья разметки)
   ============================================================================ */

export async function saveHtmlJson(
  id: string,
  root: HtmlNode | HtmlNode[],
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.HTML_TREES, "readwrite");
    const store = tx.objectStore(STORES.HTML_TREES);
    const req = store.put({ id, root });

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error(`Failed to save htmlJson ${id}`));
    tx.oncomplete = () => db.close();
  });
}

export async function getHtmlJson(
  id: string,
): Promise<HtmlNode | HtmlNode[] | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.HTML_TREES, "readonly");
    const store = tx.objectStore(STORES.HTML_TREES);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result?.root || null);
    req.onerror = () =>
      reject(req.error || new Error(`Failed to get htmlJson ${id}`));
    tx.oncomplete = () => db.close();
  });
}

export async function getAllHtmlJson(): Promise<
  { id: string; root: HtmlNode }[]
> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.HTML_TREES, "readonly");
    const store = tx.objectStore(STORES.HTML_TREES);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () =>
      reject(req.error || new Error("Failed to get all htmlJson"));
    tx.oncomplete = () => db.close();
  });
}

export async function deleteHtmlJson(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.HTML_TREES, "readwrite");
    const store = tx.objectStore(STORES.HTML_TREES);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error(`Failed to delete htmlJson ${id}`));
    tx.oncomplete = () => db.close();
  });
}

/* ============================================================================
   2. GLOBAL SCSS BUNDLE (Единый глобальный файл SCSS)
   ============================================================================ */

const SCSS_KEY = "active_global_scss";
const OLD_CLASSES_KEY = "active_classes";

/**
 * Сохраняет единый глобальный SCSS-бандл (styles.scss)
 */
export async function saveGlobalScss(scss: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CLASSES_CSS, "readwrite");
    const store = tx.objectStore(STORES.CLASSES_CSS);
    const req = store.put({ id: SCSS_KEY, scss: scss || "" });

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to save global SCSS"));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Получает единый глобальный SCSS-бандл.
 * При первом запуске автоматически конвертирует старые разрозненные классы, если они были.
 */
export async function getGlobalScss(): Promise<string> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CLASSES_CSS, "readonly");
    const store = tx.objectStore(STORES.CLASSES_CSS);

    const req = store.get(SCSS_KEY);

    req.onsuccess = () => {
      if (req.result && typeof req.result.scss === "string") {
        return resolve(req.result.scss);
      }

      // Бесшовная миграция: если ранее сохранялись стили объектом
      const oldReq = store.get(OLD_CLASSES_KEY);
      oldReq.onsuccess = () => {
        const oldStyles = oldReq.result?.styles;
        if (oldStyles && typeof oldStyles === "object") {
          const merged = Object.entries(oldStyles)
            .filter(([_, body]) => Boolean(body && (body as string).trim()))
            .map(([cls, body]) => {
              const str = (body as string).trim();
              return str.includes("{") ? str : `.${cls} {\n  ${str}\n}`;
            })
            .join("\n\n");
          resolve(merged);
        } else {
          resolve("");
        }
      };
      oldReq.onerror = () => resolve("");
    };

    req.onerror = () =>
      reject(req.error || new Error("Failed to get global SCSS"));
    tx.oncomplete = () => db.close();
  });
}

// Алиасы для плавной совместимости (чтобы ничего не падало до полного рефакторинга)
export async function saveClassesCss(
  styles: Record<string, string>,
): Promise<void> {
  const scss = Object.entries(styles || {})
    .filter(([_, body]) => Boolean(body && body.trim()))
    .map(([cls, body]) =>
      body.includes("{") ? body.trim() : `.${cls} {\n  ${body.trim()}\n}`,
    )
    .join("\n\n");
  return saveGlobalScss(scss);
}

export async function getClassesCss(): Promise<Record<string, string>> {
  const scss = await getGlobalScss();
  return { __bundle__: scss };
}

/* ============================================================================
   3. SCRIPTS JS (Изолированная таблица скриптов)
   ============================================================================ */

const SCRIPTS_KEY = "active_scripts";

export async function saveScriptsJs(
  scripts: Record<string, string>,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SCRIPTS_JS, "readwrite");
    const store = tx.objectStore(STORES.SCRIPTS_JS);
    const req = store.put({ id: SCRIPTS_KEY, scripts });

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to save scripts JS"));
    tx.oncomplete = () => db.close();
  });
}

export async function getScriptsJs(): Promise<Record<string, string>> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SCRIPTS_JS, "readonly");
    const store = tx.objectStore(STORES.SCRIPTS_JS);
    const req = store.get(SCRIPTS_KEY);

    req.onsuccess = () => resolve(req.result?.scripts || {});
    req.onerror = () =>
      reject(req.error || new Error("Failed to get scripts JS"));
    tx.oncomplete = () => db.close();
  });
}

/* ============================================================================
   4. FONTS SETTINGS (Изолированная таблица настроек шрифтов)
   ============================================================================ */

const FONTS_KEY = "active_fonts";

export interface FontsSettingsData {
  fonts: string[];
  defaultFont: string;
}

export async function saveFontsSettings(
  data: FontsSettingsData,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREVIEW_SETTINGS, "readwrite");
    const store = tx.objectStore(STORES.PREVIEW_SETTINGS);
    const req = store.put({ id: FONTS_KEY, ...data });

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to save fonts settings"));
    tx.oncomplete = () => db.close();
  });
}

export async function getFontsSettings(): Promise<FontsSettingsData> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREVIEW_SETTINGS, "readonly");
    const store = tx.objectStore(STORES.PREVIEW_SETTINGS);
    const req = store.get(FONTS_KEY);

    req.onsuccess = () => {
      resolve({
        fonts: req.result?.fonts || [],
        defaultFont: req.result?.defaultFont || "",
      });
    };
    req.onerror = () =>
      reject(req.error || new Error("Failed to get fonts settings"));
    tx.oncomplete = () => db.close();
  });
}
