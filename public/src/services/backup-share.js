// Respaldo en el celular: compartirlo (WhatsApp, correo, Drive…) o descargarlo, y deshacer una importación.
// El archivo es el mismo de la extensión (exportBackup / readBackup de store.js): sirve en los dos sentidos.

import { exportBackup, readBackup, restoreBackup, mergeBackup } from './store.js';
import { getRaw, setRaw } from './storage-backend.js';
import { todayISO } from '../utils/dates.js';

const UNDO_KEY = 'import_undo';          // copia de lo que había antes de la última importación
const LAST_EXPORT_KEY = 'cabetodo:lastExport';

export const backupFileName = () => `cabe-todo-${todayISO()}.json`;

/** El respaldo actual como archivo. */
export function backupFile() {
  return new File([exportBackup()], backupFileName(), { type: 'application/json' });
}

/** ¿El navegador puede compartir archivos (menú de compartir del celular)? */
export function canShareFiles() {
  try {
    return Boolean(navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
  } catch {
    return false;
  }
}

function markExported() {
  try { localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString()); } catch { /* sin almacenamiento */ }
}

/** Fecha (ISO) del último respaldo compartido o descargado en este equipo, o null. */
export function lastExportAt() {
  try { return localStorage.getItem(LAST_EXPORT_KEY); } catch { return null; }
}

/** Descarga el respaldo. */
export function downloadBackup() {
  const url = URL.createObjectURL(backupFile());
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markExported();
  return 'downloaded';
}

/**
 * Abre el menú de compartir con el archivo. Si no se puede, lo descarga.
 * Devuelve 'shared' | 'cancelled' | 'downloaded'.
 */
export async function shareBackup() {
  const file = backupFile();
  if (!navigator.canShare?.({ files: [file] })) return downloadBackup();
  try {
    await navigator.share({ files: [file], title: 'Respaldo de Cabe Todo' });
    markExported();
    return 'shared';
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
    return downloadBackup(); // el navegador no dejó compartir: al menos queda descargado
  }
}

/** Copia de lo actual antes de importar (para Deshacer). */
export async function saveUndoPoint() {
  await setRaw({ [UNDO_KEY]: { at: new Date().toISOString(), backup: exportBackup() } });
}

/** { at } de la copia guardada antes de la última importación, o null. */
export async function undoPoint() {
  const { [UNDO_KEY]: undo } = await getRaw([UNDO_KEY]);
  return undo?.backup ? { at: undo.at } : null;
}

/**
 * Importa un respaldo ya leído (readBackup), guardando antes lo actual para poder deshacer.
 * mode: 'merge' (mezclar; devuelve { added, updated, removed }) o 'replace'.
 */
export async function importBackup(backup, mode = 'replace') {
  await saveUndoPoint();
  if (mode === 'merge') return mergeBackup(backup.data);
  restoreBackup(backup.data);
  return null;
}

/** Vuelve a lo que había antes de la última importación. Devuelve el resumen restaurado o null. */
export async function undoImport() {
  const { [UNDO_KEY]: undo } = await getRaw([UNDO_KEY]);
  if (!undo?.backup) return null;
  const previous = readBackup(undo.backup);
  restoreBackup(previous.data);
  await setRaw({ [UNDO_KEY]: null });
  return previous.summary;
}
