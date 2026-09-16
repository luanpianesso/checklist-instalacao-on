import { openDB } from 'idb';

const DB_NAME = 'checklist-instalacao-on';
const DB_VERSION = 1;

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('installations')) {
          db.createObjectStore('installations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('media')) {
          const store = db.createObjectStore('media', { keyPath: 'id' });
          store.createIndex('byInstallation', 'installationId');
        }
      }
    });
  }
  return dbPromise;
}

export async function listInstallations() {
  const db = await getDb();
  const all = await db.getAll('installations');
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getInstallation(id) {
  const db = await getDb();
  return db.get('installations', id);
}

export async function saveInstallation(record) {
  const db = await getDb();
  record.updatedAt = Date.now();
  await db.put('installations', record);
  return record;
}

export async function deleteInstallation(id) {
  const db = await getDb();
  const tx = db.transaction(['installations', 'media'], 'readwrite');
  await tx.objectStore('installations').delete(id);
  const mediaIndex = tx.objectStore('media').index('byInstallation');
  let cursor = await mediaIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function addMedia(item) {
  const db = await getDb();
  await db.put('media', item);
  return item;
}

export async function deleteMedia(id) {
  const db = await getDb();
  await db.delete('media', id);
}

export async function getMediaForInstallation(installationId) {
  const db = await getDb();
  const index = db.transaction('media').store.index('byInstallation');
  return index.getAll(IDBKeyRange.only(installationId));
}

export async function getMedia(id) {
  const db = await getDb();
  return db.get('media', id);
}

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
