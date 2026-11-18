// Archivio locale (IndexedDB): misure e impostazioni restano sul telefono.
const DB_NAME = 'underpressure', VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      const m = db.createObjectStore('measurements', { keyPath: 'id', autoIncrement: true });
      m.createIndex('ts', 'ts');
      m.createIndex('profile', 'profile');
      db.createObjectStore('kv');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode), s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  }));
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  async addMeasurement(m) { return tx('measurements', 'readwrite', s => req(s.add(m))); },
  async putMeasurement(m) { return tx('measurements', 'readwrite', s => req(s.put(m))); },
  async deleteMeasurement(id) { return tx('measurements', 'readwrite', s => req(s.delete(id))); },
  async allMeasurements() {
    const all = await tx('measurements', 'readonly', s => req(s.getAll()));
    return all.sort((a, b) => b.ts - a.ts);
  },
  async clearMeasurements() { return tx('measurements', 'readwrite', s => req(s.clear())); },
  async get(key, def = null) { const v = await tx('kv', 'readonly', s => req(s.get(key))); return v === undefined ? def : v; },
  async set(key, val) { return tx('kv', 'readwrite', s => req(s.put(val, key))); },
};
