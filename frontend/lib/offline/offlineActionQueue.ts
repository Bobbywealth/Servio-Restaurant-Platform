import type { PendingAction } from '@/components/tablet/orders/types';

const OFFLINE_QUEUE_DB = 'servioOfflineQueue';
const OFFLINE_QUEUE_STORE = 'actions';
const OFFLINE_QUEUE_VERSION = 1;

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_QUEUE_DB, OFFLINE_QUEUE_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        const store = db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('idempotencyKey', 'idempotencyKey', { unique: false });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open offline queue DB'));
  });
}

export async function putDurableAction(action: PendingAction): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_QUEUE_STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to write durable queue action'));
  });
  db.close();
}
