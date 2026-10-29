// Tiny key-value store on IndexedDB. It is shared by the service worker, popup and side panel
// (same extension origin) and needs no extra manifest permission, unlike chrome.storage.
const DB_NAME = 'keinepad';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = undefined;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export function kvGet<T>(key: string): Promise<T | undefined> {
  return run('readonly', (s) => s.get(key));
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await run('readwrite', (s) => s.put(value, key));
}
