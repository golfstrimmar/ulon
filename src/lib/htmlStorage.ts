/**
 * @file htmlStorage.ts
 * @description Хранилище IndexedDB для сущности htmlJson (HtmlDocument).
 * Полностью асинхронный клиент на промисах (без внешних зависимостей).
 * Реализует CRUD (Create, Read, Update, Delete) в базе данных браузера.
 */

import { HtmlDocument } from "@/types/htmlJson";

const DB_NAME = "ulon_html_db";
const DB_VERSION = 1;
const STORE_NAME = "html_documents";
const ACTIVE_DOC_KEY = "ulon_active_html_doc_id";

/**
 * Инициализация и открытие соединения с IndexedDB.
 * При первом запуске или смене версии создает хранилище объектов (objectStore).
 */
export function openHtmlDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported or running in SSR"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    // Срабатывает, когда базы еще нет или повысилась версия
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Создаем хранилище документов с первичным ключом `id`
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        // Создаем индекс для сортировки по дате обновления
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("title", "title", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

// ============================================================================
// 1. CREATE (Создание нового документа в IndexedDB)
// ============================================================================

/**
 * CREATE: Сохраняет новый документ HtmlDocument в IndexedDB
 * @param doc Создаваемый документ
 * @returns Сохраненный документ
 */
export async function createHtmlDocument(
  doc: HtmlDocument
): Promise<HtmlDocument> {
  const db = await openHtmlDatabase();

  return new Promise((resolve, reject) => {
    // Открываем транзакцию на запись
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const docToSave: HtmlDocument = {
      ...doc,
      updatedAt: Date.now(),
    };

    // add выбрасывает ошибку, если ключ уже существует
    const req = store.add(docToSave);

    req.onsuccess = () => {
      setActiveDocId(docToSave.id);
      resolve(docToSave);
    };

    req.onerror = () => {
      reject(req.error || new Error("Failed to create document in IndexedDB"));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================================
// 2. READ (Чтение одного или всех документов из IndexedDB)
// ============================================================================

/**
 * READ: Получает документ по его идентификатору id
 * @param id UUID документа
 * @returns Найденный HtmlDocument или null
 */
export async function getHtmlDocumentById(
  id: string
): Promise<HtmlDocument | null> {
  const db = await openHtmlDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => {
      resolve((req.result as HtmlDocument) || null);
    };

    req.onerror = () => {
      reject(req.error || new Error(`Failed to read document with id ${id}`));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * READ: Получает список всех сохраненных документов, отсортированных по дате изменения
 */
export async function getAllHtmlDocuments(): Promise<HtmlDocument[]> {
  const db = await openHtmlDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("updatedAt");

    // Открываем курсор в обратном порядке (сначала самые свежие)
    const req = index.openCursor(null, "prev");
    const results: HtmlDocument[] = [];

    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    req.onerror = () => {
      reject(req.error || new Error("Failed to read documents list"));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================================
// 3. UPDATE (Обновление существующего документа)
// ============================================================================

/**
 * UPDATE: Обновляет документ (целиком или частично) по его id
 * @param id UUID документа
 * @param updates Поля для обновления (title, root, etc.)
 */
export async function updateHtmlDocument(
  id: string,
  updates: Partial<Omit<HtmlDocument, "id" | "createdAt">>
): Promise<HtmlDocument> {
  const existing = await getHtmlDocumentById(id);
  if (!existing) {
    throw new Error(`Document with id "${id}" does not exist in IndexedDB`);
  }

  const updatedDoc: HtmlDocument = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  const db = await openHtmlDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(updatedDoc); // put обновляет существующую запись

    req.onsuccess = () => {
      resolve(updatedDoc);
    };

    req.onerror = () => {
      reject(req.error || new Error("Failed to update document in IndexedDB"));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================================
// 4. DELETE (Удаление документа из IndexedDB)
// ============================================================================

/**
 * DELETE: Удаляет документ из IndexedDB по его идентификатору id
 * @param id UUID удаляемого документа
 */
export async function deleteHtmlDocument(id: string): Promise<void> {
  const db = await openHtmlDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => {
      if (getActiveDocId() === id) {
        clearActiveDocId();
      }
      resolve();
    };

    req.onerror = () => {
      reject(req.error || new Error(`Failed to delete document ${id}`));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

// ============================================================================
// Вспомогательные методы: Активный документ (выбор пользователя)
// ============================================================================

export function getActiveDocId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_DOC_KEY);
}

export function setActiveDocId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_DOC_KEY, id);
}

export function clearActiveDocId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_DOC_KEY);
}
