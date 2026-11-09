/**
 * TrekIndia — IndexedDB Offline Storage Client
 * Manages client-side persistent storage for Offline Trek Companion packages
 */

const DB_NAME = 'TrekIndia_Offline_DB';
const DB_VERSION = 1;
const STORE_NAME = 'trek_packages';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this browser.'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trek_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const OfflineStorage = {
  async savePackage(pkg) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const trekId = pkg.trek?.trek_id;
      if (!trekId) return reject(new Error('Package does not contain valid trek_id.'));

      const record = {
        trek_id: trekId,
        slug: pkg.trek.slug,
        name: pkg.trek.name,
        saved_at: new Date().toISOString(),
        version: pkg.version || 'v2.1.0',
        size_bytes: pkg.size_bytes || 0,
        data: pkg
      };

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => reject(putReq.error);
    });
  },

  async getPackage(trekIdOrSlug) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const numId = parseInt(trekIdOrSlug, 10);
      if (!isNaN(numId)) {
        const req = store.get(numId);
        req.onsuccess = () => resolve(req.result?.data || null);
        req.onerror = () => reject(req.error);
      } else {
        // Search by slug
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.slug === trekIdOrSlug) {
              return resolve(cursor.value.data);
            }
            cursor.continue();
          } else {
            resolve(null);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      }
    });
  },

  async listSavedPackages() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async removePackage(trekId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(parseInt(trekId, 10));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
};

window.TrekIndiaOfflineStorage = OfflineStorage;

