// Fotos nur auf diesem Gerät (IndexedDB) – getrennt je Konto. Verlassen das Handy nie, außer man schickt sie aktiv an die KI.
const DB = 'tf-private';
const STORE = 'pics';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('Kein IndexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  // Browser bitten, die Daten nicht automatisch zu löschen
  try {
    navigator.storage && navigator.storage.persist && navigator.storage.persist();
  } catch (e) {}
  return dbp;
}

const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const st = t.objectStore(STORE);
    const out = fn(st);
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
};

export const idbGet = (key) => tx('readonly', (st) => st.get(key)).catch(() => null);
export const idbSet = (key, val) => tx('readwrite', (st) => st.put(val, key)).catch(() => null);
export const idbDel = (key) => tx('readwrite', (st) => st.delete(key)).catch(() => null);

/** Alle Fotos eines Kontos auf diesem Gerät löschen */
export async function idbClearUser(uid) {
  try {
    const db = await open();
    await new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      const st = t.objectStore(STORE);
      const range = IDBKeyRange.bound(uid + '/', uid + '/￿');
      st.delete(range);
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
  } catch (e) {}
}
