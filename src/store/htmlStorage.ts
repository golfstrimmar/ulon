/**
 * @file htmlStorage.ts
 * @description Единый изолированный слой IndexedDB.
 * Хранилище HTML-деревьев, глобального SCSS-бандла, единого JS-бандла и настроек.
 */

import { HtmlNode } from "@/types/HtmlNode";

const DB_NAME = "ulon_plaza_db";
const DB_VERSION = 1;

// Изолированные таблицы базы данных
export const STORES = {
  HTML_TREES: "html_trees", // Деревья разметки (HtmlNode)
  CLASSES_CSS: "classes_css", // Хранилище SCSS/CSS бандла
  SCRIPTS_JS: "scripts_js", // Хранилище глобального JS-бандла
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

      // Бесшовная миграция
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
   3. GLOBAL JS BUNDLE (Единый глобальный файл JavaScript)
   ============================================================================ */

const JS_KEY = "active_global_js";

/**
 * Сохраняет единый глобальный JS-бандл (scripts.js)
 */
export async function saveGlobalJs(js: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SCRIPTS_JS, "readwrite");
    const store = tx.objectStore(STORES.SCRIPTS_JS);
    const req = store.put({ id: JS_KEY, js: js || "" });

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to save global JS"));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Получает единый глобальный JS-бандл.
 * При первом запуске автоматически мигрирует старый словарь скриптов в единую строку.
 */
/**
 * Получает единый глобальный JS-бандл.
 * Сканирует ВСЮ таблицу scripts_js в IndexedDB, собирает все скрипты нод
 * и возвращает готовый единый монолитный бандл.
 */
export async function getGlobalJs(): Promise<string> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.SCRIPTS_JS, "readonly");
    const store = tx.objectStore(STORES.SCRIPTS_JS);

    // Достаем абсолютно ВСЕ записи из таблицы scripts_js
    const req = store.getAll();

    req.onsuccess = () => {
      const records = req.result || [];
      if (records.length === 0) return resolve("");

      const collectedScripts: string[] = [];
      const seenCodes = new Set<string>();

      for (const record of records) {
        if (!record) continue;

        // 1. Если это строка бандла
        if (typeof record.js === "string" && record.js.trim()) {
          const trimmed = record.js.trim();
          if (!seenCodes.has(trimmed)) {
            seenCodes.add(trimmed);
            collectedScripts.push(trimmed);
          }
        }

        // 2. Если это словарь { target1: "код", target2: "код" }
        if (record.scripts && typeof record.scripts === "object") {
          // Если внутри уже был готовый бандл
          if (
            record.scripts.__bundle__ &&
            typeof record.scripts.__bundle__ === "string"
          ) {
            const trimmed = record.scripts.__bundle__.trim();
            if (trimmed && !seenCodes.has(trimmed)) {
              seenCodes.add(trimmed);
              collectedScripts.push(trimmed);
            }
          } else {
            // Собираем каждый именованный скрипт ноды
            for (const [target, code] of Object.entries(record.scripts)) {
              if (code && typeof code === "string" && (code as string).trim()) {
                const trimmed = (code as string).trim();
                const snippet = `/* --- [script:${target}] --- */\n${trimmed}\n/* --- [end:${target}] --- */`;
                if (!seenCodes.has(trimmed)) {
                  seenCodes.add(trimmed);
                  collectedScripts.push(snippet);
                }
              }
            }
          }
        }
      }

      resolve(collectedScripts.join("\n\n"));
    };

    req.onerror = () => resolve("");
    tx.oncomplete = () => db.close();
  });
}
// Алиасы для обратной совместимости
export async function saveScriptsJs(
  scripts: Record<string, string>,
): Promise<void> {
  const bundle = scripts.__bundle__ || Object.values(scripts).join("\n\n");
  return saveGlobalJs(bundle);
}

export async function getScriptsJs(): Promise<Record<string, string>> {
  const js = await getGlobalJs();
  return { __bundle__: js };
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

/* ============================================================================
   5. PIXEL PERFECT OVERLAY SETTINGS (Подложка под превью)
   ============================================================================ */

const OVERLAY_KEY = "pixel_perfect_overlay";

export interface PixelPerfectSettingsData {
  image: string; // base64 DataURL
  fileName?: string;
  imageWidth?: number;
  imageHeight?: number;
  previewOpacity: number; // 0..100 (прозрачность верстки)
  overlayOpacity?: number; // 0..100 (прозрачность подложки)
  offsetX: number;
  offsetY: number;
  isVisible: boolean;
  align: "left" | "center";
  fitHeight?: boolean;
}

export async function savePixelPerfectSettings(
  data: PixelPerfectSettingsData,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREVIEW_SETTINGS, "readwrite");
    const store = tx.objectStore(STORES.PREVIEW_SETTINGS);
    const req = store.put({ id: OVERLAY_KEY, ...data });

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to save pixel perfect settings"));
    tx.oncomplete = () => db.close();
  });
}

export async function getPixelPerfectSettings(): Promise<PixelPerfectSettingsData | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREVIEW_SETTINGS, "readonly");
    const store = tx.objectStore(STORES.PREVIEW_SETTINGS);
    const req = store.get(OVERLAY_KEY);

    req.onsuccess = () => {
      if (req.result && req.result.image) {
        resolve({
          image: req.result.image,
          fileName: req.result.fileName || "",
          imageWidth: req.result.imageWidth || 0,
          imageHeight: req.result.imageHeight || 0,
          previewOpacity:
            typeof req.result.previewOpacity === "number"
              ? req.result.previewOpacity
              : 50,
          overlayOpacity:
            typeof req.result.overlayOpacity === "number"
              ? req.result.overlayOpacity
              : 100,
          offsetX: req.result.offsetX || 0,
          offsetY: req.result.offsetY || 0,
          isVisible:
            req.result.isVisible !== undefined ? req.result.isVisible : true,
          align: req.result.align || "left",
          fitHeight:
            req.result.fitHeight !== undefined ? req.result.fitHeight : true,
        });
      } else {
        resolve(null);
      }
    };
    req.onerror = () =>
      reject(req.error || new Error("Failed to get pixel perfect settings"));
    tx.oncomplete = () => db.close();
  });
}

export async function clearPixelPerfectSettings(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREVIEW_SETTINGS, "readwrite");
    const store = tx.objectStore(STORES.PREVIEW_SETTINGS);
    const req = store.delete(OVERLAY_KEY);

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error("Failed to clear pixel perfect settings"));
    tx.oncomplete = () => db.close();
  });
}
