/**
 * @file figmaJsonStorage.ts
 * @description Хранилище банка фрагментов Figma JSON в IndexedDB.
 */

export interface FigmaJsonFragment {
  id: string;
  name: string;
  json: string;
  createdAt: number;
}

const DB_NAME = "ulon_figma_fragments_db";
const DB_VERSION = 1;

export const STORES = {
  FRAGMENTS: "fragments",
} as const;

/**
 * Инициализация соединения с IndexedDB
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.FRAGMENTS)) {
        const store = db.createObjectStore(STORES.FRAGMENTS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Получить все сохраненные фрагменты (сортировка от новых к старым)
 */
export async function getAllFragments(): Promise<FigmaJsonFragment[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FRAGMENTS, "readonly");
    const store = tx.objectStore(STORES.FRAGMENTS);
    const req = store.getAll();

    req.onsuccess = () => {
      const list = (req.result || []) as FigmaJsonFragment[];
      list.sort((a, b) => b.createdAt - a.createdAt);
      resolve(list);
    };

    req.onerror = () =>
      reject(req.error || new Error("Failed to get fragments from IndexedDB"));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Получить фрагмент по ID
 */
export async function getFragmentById(
  id: string,
): Promise<FigmaJsonFragment | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FRAGMENTS, "readonly");
    const store = tx.objectStore(STORES.FRAGMENTS);
    const req = store.get(id);

    req.onsuccess = () => {
      resolve((req.result as FigmaJsonFragment) || null);
    };

    req.onerror = () =>
      reject(req.error || new Error(`Failed to get fragment ${id}`));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Сохранить новый фрагмент в банк
 */
export async function saveFragment(
  name: string,
  json: string,
): Promise<FigmaJsonFragment> {
  const db = await openDatabase();
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `fragment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const fragment: FigmaJsonFragment = {
    id,
    name: name.trim() || "Без названия",
    json: json.trim(),
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FRAGMENTS, "readwrite");
    const store = tx.objectStore(STORES.FRAGMENTS);
    const req = store.put(fragment);

    req.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("figma_fragments:updated", { detail: fragment }),
        );
      }
      resolve(fragment);
    };

    req.onerror = () =>
      reject(req.error || new Error("Failed to save fragment to IndexedDB"));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Удалить фрагмент по ID
 */
export async function deleteFragment(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FRAGMENTS, "readwrite");
    const store = tx.objectStore(STORES.FRAGMENTS);
    const req = store.delete(id);

    req.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("figma_fragments:updated", { detail: { deletedId: id } }),
        );
      }
      resolve();
    };

    req.onerror = () =>
      reject(req.error || new Error(`Failed to delete fragment ${id}`));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Очистить все фрагменты
 */
export async function clearAllFragments(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FRAGMENTS, "readwrite");
    const store = tx.objectStore(STORES.FRAGMENTS);
    const req = store.clear();

    req.onsuccess = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("figma_fragments:updated"));
      }
      resolve();
    };

    req.onerror = () =>
      reject(req.error || new Error("Failed to clear fragments"));
    tx.oncomplete = () => db.close();
  });
}
