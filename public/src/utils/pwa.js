// PWA: service worker (sin conexión y versiones nuevas) e instalación en el celular.

import { showToast } from './ui.js';

const listeners = new Set();
let deferredPrompt = null; // evento beforeinstallprompt (Android / Chrome de escritorio)

const notify = () => listeners.forEach((fn) => fn());

/** ¿Se abrió como app instalada? */
export function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

/** iPhone o iPad (en iPadOS Safari se presenta como Mac con pantalla táctil). */
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Cómo se puede instalar desde aquí:
 * 'installed' ya está instalada · 'prompt' el navegador ofrece instalar (botón) ·
 * 'ios' instrucciones de Safari · 'manual' desde el menú del navegador.
 */
export function installState() {
  if (isInstalled()) return 'installed';
  if (deferredPrompt) return 'prompt';
  if (isIos()) return 'ios';
  return 'manual';
}

/** Muestra el diálogo de instalación del navegador. Devuelve true si se instaló. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  notify();
  return outcome === 'accepted';
}

/** Avisa cuando cambia installState() (aparece el botón, se instaló…). */
export function onInstallChange(fn) {
  listeners.add(fn);
}

/** En desarrollo (npm run dev) no hay lista de archivos que guardar: sin service worker. */
const isDev = () => ['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '5173';

/** Se llama una vez al iniciar cada página. */
export function installPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // el botón está en Ajustes; no mostrar el aviso del navegador de golpe
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('Cabe Todo quedó instalada. Ábrela desde tu pantalla de inicio.');
    notify();
  });

  if (!('serviceWorker' in navigator) || isDev()) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    const offerUpdate = (worker) => {
      // Solo si ya había una versión controlando la página (la primera instalación no es "nueva")
      if (!worker || !navigator.serviceWorker.controller) return;
      showToast('Hay una versión nueva de Cabe Todo.', { label: 'Actualizar', run: () => worker.postMessage('SKIP_WAITING') });
    };
    if (reg.waiting) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') offerUpdate(worker);
      });
    });
    // Al volver a la app, revisar si hay versión nueva
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.error('Cabe Todo: no se pudo registrar el service worker', err));
}
