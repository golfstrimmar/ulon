/**
 * @file htmlStorage.ts
 * @description Хранение сущности HtmlNode (htmlJson) в IndexedDB браузера.
 * Изначально в базе пустота: никаких демо-данных и моков не создается.
 */

import { HtmlNode } from "@/types/htmlJson";

const DB_NAME = "ulon_html_db";
const DB_VERSION = 2;
const STORE_NAME = "html_trees";

/**
 * Открытие соединения с IndexedDB
 */
export function openHtmlDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains("html_documents")) {
        db.deleteObjectStore("html_documents");
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

// ============================================================================
// CREATE / UPDATE
// ============================================================================

/**
 * Сохраняет или обновляет дерево HtmlNode в IndexedDB
 * @param id Идентификатор записи (например: "root", "plaza_tree")
 * @param root Дерево HtmlNode
 */
export async function saveHtmlJson(id: string, root: HtmlNode): Promise<void> {
  const db = await openHtmlDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ id, root });

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`Failed to save htmlJson ${id}`));
    tx.oncomplete = () => db.close();
  });
}

// ============================================================================
// READ
// ============================================================================

/**
 * Читает дерево HtmlNode из IndexedDB по id.
 * Если ничего не сохранено — возвращает null (изначально в базе пустота).
 */
export async function getHtmlJson(id: string): Promise<HtmlNode | null> {
  const db = await openHtmlDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => {
      const result = req.result;
      resolve(result?.root || null);
    };
    req.onerror = () => reject(req.error || new Error(`Failed to get htmlJson ${id}`));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Получает все сохраненные деревья
 */
export async function getAllHtmlJson(): Promise<{ id: string; root: HtmlNode }[]> {
  const db = await openHtmlDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error("Failed to get all htmlJson"));
    tx.oncomplete = () => db.close();
  });
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Удаляет дерево HtmlNode из IndexedDB
 */
export async function deleteHtmlJson(id: string): Promise<void> {
  const db = await openHtmlDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`Failed to delete htmlJson ${id}`));
    tx.oncomplete = () => db.close();
  });
}
