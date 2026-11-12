// Permiso de Google para sincronizar con Drive, en la web: Google Identity Services (cliente de token,
// sin servidor). El token dura ~1 hora y vive en sessionStorage; pedirlo de nuevo abre una ventanita.
// La extensión tiene su propio drive-session.js (chrome.identity); drive-ui.js usa cualquiera de los dos.

import {
  CLIENT_ID, SCOPE, DriveAuthError, syncWithToken, isConnected, forgetDrive, markConnected,
} from './drive-api.js';

export { isConnected, lastSync } from './drive-api.js';

const GIS_URL = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'cabetodo:driveToken';

export const isAvailable = () => true;
/** En la web Google vuelve a la misma página: no hay dirección que configurar aparte. */
export const redirectUrl = () => '';

let gisPromise = null;
/** Carga la librería de Google (una vez), antes del toque: si no, la ventanita queda bloqueada. */
export function prepare() {
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
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY));
    return t && t.expires > Date.now() + 60000 ? t.token : null; // con 1 min de margen
  } catch {
    return null;
  }
}

function forgetToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignorar */ }
}

/**
 * Token de acceso. Si no hay uno vigente abre la ventanita de Google: debe llamarse directo desde un
 * toque (sin esperas antes), o el navegador la bloquea.
 */
function getToken() {
  const cached = storedToken();
  if (cached) return Promise.resolve(cached);
  if (!window.google?.accounts?.oauth2) return Promise.reject(new Error('El inicio de sesión de Google todavía está cargando. Prueba de nuevo.'));
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
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
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: res.access_token, expires: Date.now() + (Number(res.expires_in) || 3600) * 1000 }));
        } catch { /* ignorar */ }
        markConnected();
        resolve(res.access_token);
      },
      error_callback: (err) => reject(new DriveAuthError(err?.type === 'popup_closed' ? 'Cerraste la ventana de Google.' : 'No se pudo abrir la ventana de Google.')),
    });
    client.requestAccessToken({ prompt: isConnected() ? '' : 'consent' });
  });
}

/** Sincroniza ahora (pide el permiso si hace falta). Devuelve { summary, created }. */
export async function syncNow(local) {
  const token = await getToken();
  return syncWithToken(token, local, { onAuthError: forgetToken });
}

/** Desconectar: revoca el permiso en Google y olvida la conexión en este equipo (los datos quedan). */
export async function disconnect() {
  const token = storedToken();
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  forgetToken();
  forgetDrive();
}
