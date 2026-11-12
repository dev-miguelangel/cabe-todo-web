// Dónde se guardan los datos en la web: IndexedDB (base "cabe-todo", almacén "kv", una fila por clave:
// tasks, epics, routines, settings, meta). Mismas funciones que el storage-backend.js de la extensión,
// así storage.js y store.js se comparten tal cual.
//
// - Otras pestañas abiertas se enteran de los cambios por BroadcastChannel.
// - La primera vez se traen los datos que hubiera en localStorage (claves "cabetodo:*").
// - Se pide almacenamiento persistente para que el navegador no borre los datos solo.
// - Si IndexedDB no está disponible (algunos modos privados), se usa localStorage.

const DB_NAME = 'cabe-todo';
const STORE = 'kv';
const LS_PREFIX = 'cabetodo:';
/** Claves de datos (en localStorage también hay preferencias de la interfaz, como la pestaña o el tema). */
const DATA_KEYS = ['tasks', 'epics', 'routines', 'settings', 'deleted', 'meta'];

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cabe-todo-data') : null;
channel?.unref?.(); // solo Node (pruebas): que el canal no mantenga vivo el proceso
let dbPromise = null;

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Sin IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña'));
  }).then(async (db) => {
    await migrateFromLocalStorage(db);
    return db;
  });
  dbPromise.catch(() => {}); // el error se maneja en quien la usa (cae a localStorage)
  return dbPromise;
}

/** Datos guardados antes con localStorage (versión de pruebas): pasarlos una sola vez a IndexedDB. */
async function migrateFromLocalStorage(db) {
  let pending;
  try {
    pending = DATA_KEYS.filter((k) => localStorage.getItem(LS_PREFIX + k) !== null);
  } catch {
    return;
  }
  if (!pending.length) return;
  const tx = db.transaction(STORE, 'readwrite');
  const kv = tx.objectStore(STORE);
  const already = await request(kv.count());
  if (!already) {
    for (const k of pending) {
      try { kv.put(JSON.parse(localStorage.getItem(LS_PREFIX + k)), k); } catch { /* dato dañado: se omite */ }
    }
  }
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  for (const k of pending) localStorage.removeItem(LS_PREFIX + k);
}

let persistAsked = false;
/** Pide que el navegador no borre los datos cuando falta espacio (Safari los borra tras 7 días sin uso si no). */
function askPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

// ---------- Respaldo en localStorage (si no hay IndexedDB) ----------

function lsGet(keys) {
  const out = {};
  for (const k of keys) {
    try {
      const v = localStorage.getItem(LS_PREFIX + k);
      if (v !== null) out[k] = JSON.parse(v);
    } catch { /* sin almacenamiento */ }
  }
  return out;
}

function lsSet(obj) {
  for (const [k, v] of Object.entries(obj)) {
    try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch { /* lleno o bloqueado */ }
  }
}

// ---------- API (la misma que en la extensión) ----------

/** { clave: valor } de las claves pedidas que existan. */
export async function getRaw(keys) {
  let db;
  try {
    db = await openDb();
  } catch {
    return lsGet(keys);
  }
  const kv = db.transaction(STORE, 'readonly').objectStore(STORE);
  const values = await Promise.all(keys.map((k) => request(kv.get(k))));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]).filter(([, v]) => v !== undefined));
}

/** Guarda { clave: valor } y avisa a las otras pestañas. */
export async function setRaw(obj) {
  askPersistence();
  let db;
  try {
    db = await openDb();
  } catch {
    lsSet(obj);
    channel?.postMessage(obj);
    return;
  }
  const tx = db.transaction(STORE, 'readwrite');
  const kv = tx.objectStore(STORE);
  for (const [k, v] of Object.entries(obj)) kv.put(v, k);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar'));
  });
  channel?.postMessage(obj);
}

/** Llama a callback({ clave: valorNuevo }) cuando OTRA pestaña cambia los datos. */
export function watchRaw(callback) {
  channel?.addEventListener('message', (e) => {
    if (e.data && typeof e.data === 'object') callback(e.data);
  });
}
