// Sincronizar con Google Drive (solo para mí): un archivo privado `Cabe Todo/cabe-todo-sync.json` en mi
// Drive. Permiso `drive.file`: la app solo ve los archivos que ella misma crea.
//
// Sincronizar = traer el archivo → mezclar con lo local (merge.js) → guardar → subir el resultado.
// Si otro equipo lo cambió entre medio, se repite. Antes de mezclar se guarda una copia para Deshacer.
//
// - runSync(drive, local): la secuencia, con un "drive" de mentira en las pruebas.
// - googleDrive(token): el drive real (API REST de Drive v3).
// - Sesión: Google Identity Services (cliente de token, sin servidor). El token dura ~1 hora y vive solo
//   en memoria y en sessionStorage; volver a pedirlo abre una ventanita de Google.

export const CLIENT_ID = '1028503566136-hdj7jumklq1r5u2gn9ogbtgm08apb3d8.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const FOLDER_NAME = 'Cabe Todo';
const FILE_NAME = 'cabe-todo-sync.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const MAX_ATTEMPTS = 3;

const KEYS = {
  connected: 'cabetodo:driveConnected',
  fileId: 'cabetodo:driveFileId',
  last: 'cabetodo:driveLastSync',     // { at, summary }
  token: 'cabetodo:driveToken',       // sessionStorage: { token, expires }
};

const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};

export class DriveAuthError extends Error {}

// ---------- La secuencia (probada con un drive de mentira) ----------

/**
 * drive: { find() → { id, modifiedTime } | null, download(id) → texto, modified(id) → modifiedTime,
 *          create(texto) → { id, modifiedTime }, update(id, texto) → { modifiedTime } }
 * local: { exportText() → texto, read(texto) → respaldo leído (lanza si no sirve),
 *          merge(datos) → resumen, saveUndo() }
 * Devuelve { summary, created, fileId }.
 */
export async function runSync(drive, local, { fileId = null } = {}) {
  let file = fileId ? { id: fileId } : null;
  if (!file) file = await drive.find();
  if (!file) {
    const created = await drive.create(local.exportText());
    return { summary: null, created: true, fileId: created.id };
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const before = await drive.modified(file.id);
    const remote = local.read(await drive.download(file.id)); // lanza si el archivo está dañado: no se toca nada
    if (attempt === 1) await local.saveUndo();
    const summary = local.merge(remote.data);
    // ¿Otro equipo subió algo mientras mezclábamos? Volver a traerlo y mezclar de nuevo.
    if ((await drive.modified(file.id)) !== before) continue;
    await drive.update(file.id, local.exportText());
    return { summary, created: false, fileId: file.id };
  }
  throw new Error('Otro equipo está sincronizando al mismo tiempo. Prueba de nuevo en un momento.');
}

// ---------- Drive real (API REST) ----------

export function googleDrive(token) {
  const call = async (url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    if (res.status === 401 || res.status === 403) throw new DriveAuthError('Hay que volver a conectar Google Drive.');
    if (!res.ok) throw new Error(`Google Drive respondió ${res.status}.`);
    return res;
  };
  const json = async (url, options) => (await call(url, options)).json();
  const q = (query) => `${API}/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`;

  async function folderId() {
    const found = await json(q(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`));
    if (found.files.length) return found.files[0].id;
    const created = await json(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    return created.id;
  }

  return {
    async find() {
      const found = await json(q(`name='${FILE_NAME}' and trashed=false`));
      return found.files[0] || null;
    },
    async download(id) {
      return (await call(`${API}/files/${id}?alt=media`)).text();
    },
    async modified(id) {
      return (await json(`${API}/files/${id}?fields=modifiedTime`)).modifiedTime;
    },
    async create(text) {
      const parent = await folderId();
      const boundary = `cabetodo${Date.now()}`;
      const body = [
        `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '',
        JSON.stringify({ name: FILE_NAME, mimeType: 'application/json', parents: [parent] }),
        `--${boundary}`, 'Content-Type: application/json', '', text, `--${boundary}--`, '',
      ].join('\r\n');
      return json(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
      });
    },
    async update(id, text) {
      return json(`${UPLOAD}/files/${id}?uploadType=media&fields=modifiedTime`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text,
      });
    },
  };
}

// ---------- Sesión con Google ----------

let gisPromise = null;
/** Carga la librería de Google (una vez). */
export function loadGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { gisPromise = null; reject(new Error('No se pudo cargar el inicio de sesión de Google (¿sin conexión?).')); };
      document.head.append(script);
    });
  }
  return gisPromise;
}

function storedToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(KEYS.token));
    return t && t.expires > Date.now() + 60000 ? t.token : null; // con 1 min de margen
  } catch {
    return null;
  }
}

function storeToken(token, expiresIn) {
  try { sessionStorage.setItem(KEYS.token, JSON.stringify({ token, expires: Date.now() + expiresIn * 1000 })); } catch { /* ignorar */ }
}

export function forgetToken() {
  try { sessionStorage.removeItem(KEYS.token); } catch { /* ignorar */ }
}

let tokenClient = null;
/**
 * Token de acceso. Si no hay uno vigente, abre la ventanita de Google: debe llamarse directo desde un
 * toque (sin esperas antes), o el navegador la bloquea. Por eso la librería se carga al abrir Ajustes.
 */
export function getToken() {
  const cached = storedToken();
  if (cached) return Promise.resolve(cached);
  if (!window.google?.accounts?.oauth2) return Promise.reject(new Error('El inicio de sesión de Google todavía está cargando. Prueba de nuevo.'));
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (res) => {
        if (res.error || !res.access_token) {
          reject(new DriveAuthError(res.error === 'access_denied' ? 'No diste permiso para usar Google Drive.' : 'No se pudo conectar con Google.'));
          return;
        }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(res, SCOPE)) {
          reject(new DriveAuthError('Hace falta el permiso de Google Drive para sincronizar.'));
          return;
        }
        storeToken(res.access_token, Number(res.expires_in) || 3600);
        ls.set(KEYS.connected, true);
        resolve(res.access_token);
      },
      error_callback: (err) => reject(new DriveAuthError(err?.type === 'popup_closed' ? 'Cerraste la ventana de Google.' : 'No se pudo abrir la ventana de Google.')),
    });
    tokenClient.requestAccessToken({ prompt: isConnected() ? '' : 'consent' });
  });
}

// ---------- Estado para la interfaz ----------

export const isConnected = () => Boolean(ls.get(KEYS.connected));
export const lastSync = () => ls.get(KEYS.last); // { at, summary } | null

/** Sincroniza ahora con el Drive real. local: como en runSync. Devuelve { summary, created }. */
export async function syncNow(local) {
  const token = await getToken();
  try {
    const result = await runSync(googleDrive(token), local, { fileId: ls.get(KEYS.fileId) });
    ls.set(KEYS.fileId, result.fileId);
    ls.set(KEYS.last, { at: new Date().toISOString(), summary: result.summary });
    return result;
  } catch (err) {
    if (err instanceof DriveAuthError) forgetToken();
    // El archivo recordado ya no existe (se borró en Drive): olvidarlo para buscarlo o crearlo de nuevo
    if (/ 404\./.test(err.message)) ls.del(KEYS.fileId);
    throw err;
  }
}

/** Desconectar: revoca el permiso en Google y olvida todo lo de Drive en este equipo (los datos quedan). */
export function disconnect() {
  const token = storedToken();
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  forgetToken();
  for (const k of [KEYS.connected, KEYS.fileId, KEYS.last]) ls.del(k);
}
