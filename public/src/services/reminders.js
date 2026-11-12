// Avisos con la app abierta (en la extensión los da su service worker con chrome.alarms, aunque el
// panel esté cerrado; la web no tiene alarmas en segundo plano sin servidor).
//
// - Fin de cada bloque: cuántas tareas quedan (si está activo "Avisarme cuando termine cada bloque").
// - Temporizador en cero: sonido (si está activo) y aviso.
// - Reuniones: al empezar, una que bloquea inicia su temporizador (y pausa lo demás); al llegar su
//   hora de fin, la que corre queda hecha.
//
// dueReminders() decide qué toca entre dos momentos (pura, con pruebas); startReminders() revisa cada
// pocos segundos y avisa: con la app a la vista, un aviso dentro de la app; en segundo plano, una
// notificación del sistema (si se dio permiso).

import { blocksOf } from '../core/blocks.js';
import { isRunning, remainingMs } from '../core/timer.js';
import { toMinutes, toISO } from '../utils/dates.js';

const TICK_MS = 5000;
/** Lo que pasó hace más de esto ya no se avisa (la app estuvo cerrada o dormida). */
const STALE_MS = { 'block-end': 60 * 60000, 'timer-zero': 2 * 60000, 'meeting-start': 5 * 60000, 'meeting-end': 60 * 60000 };

/** hh:mm de un día (YYYY-MM-DD) → ms. */
function at(date, hhmm) {
  const [y, m, d] = date.split('-').map(Number);
  const min = toMinutes(hhmm);
  return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).getTime();
}

/**
 * Qué avisos tocan en (fromMs, toMs]. Devuelve [{ type, at, block?, task?, pending?, own? }] en orden.
 * type: 'block-end' | 'timer-zero' | 'meeting-start' | 'meeting-end'.
 */
export function dueReminders({ tasks, settings }, fromMs, toMs) {
  const events = [];
  const inRange = (ms) => ms > fromMs && ms <= toMs;

  // Fin de bloque: el de hoy (y el de ayer, si el rango cruza la medianoche)
  const days = [...new Set([toISO(new Date(fromMs)), toISO(new Date(toMs))])];
  for (const day of days) {
    for (const block of blocksOf(settings)) {
      const when = at(day, block.end);
      if (!inRange(when)) continue;
      const own = tasks.filter((t) => t.date === day && t.block === block.id);
      if (!own.length) continue;
      events.push({ type: 'block-end', at: when, block, own, pending: own.filter((t) => !t.done) });
    }
  }

  for (const t of tasks) {
    // Temporizador que cruza el cero (las reuniones avisan su fin, no su estimado)
    if (!t.meeting && isRunning(t) && remainingMs(t, fromMs) > 0 && remainingMs(t, toMs) <= 0) {
      events.push({ type: 'timer-zero', at: toMs + remainingMs(t, toMs), task: t });
    }
    if (!t.meeting || t.done || !t.date) continue;
    const start = at(t.date, t.meeting.start);
    const end = at(t.date, t.meeting.end);
    if (inRange(start)) events.push({ type: 'meeting-start', at: start, task: t });
    if (isRunning(t) && inRange(end)) events.push({ type: 'meeting-end', at: end, task: t });
  }
  return events.sort((a, b) => a.at - b.at);
}

/** Texto del aviso de fin de bloque (igual que la extensión). */
export function blockEndText({ block, own, pending }) {
  const name = `${block.icon} ${block.title}`;
  if (pending.length) {
    const n = pending.length;
    const list = pending.slice(0, 3).map((t) => t.title).join(', ') + (n > 3 ? '…' : '');
    return { title: `Terminó ${name}`, body: `${n === 1 ? 'Te queda 1 tarea' : `Te quedan ${n} tareas`}: ${list}` };
  }
  return { title: `Terminaste todo en ${name}`, body: `${own.length} tarea${own.length > 1 ? 's' : ''} hecha${own.length > 1 ? 's' : ''}.` };
}

// ---------- En la app ----------

/** ¿Se pueden mostrar notificaciones del sistema? */
export function notificationsAvailable() {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

/** Pide permiso (debe llamarse desde un toque). Devuelve 'granted' | 'denied' | 'default' | 'unsupported'. */
export async function askNotificationPermission() {
  if (!notificationsAvailable()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
}

async function systemNotification(title, body, tag) {
  if (!notificationsAvailable() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' });
    else new Notification(title, { body, tag, icon: '/icons/icon-192.png' }); // eslint-disable-line no-new
    return true;
  } catch {
    return false;
  }
}

/**
 * Empieza a revisar los avisos. deps: { getState, showToast, playSound, startTimer, finishMeeting }.
 * Devuelve una función para detenerlo.
 */
export function startReminders(deps) {
  let last = Date.now();
  const tell = async (title, body, tag) => {
    if (document.visibilityState === 'visible') deps.showToast(`${title}. ${body}`);
    else if (!(await systemNotification(title, body, tag))) deps.showToast(`${title}. ${body}`);
  };

  const check = () => {
    const now = Date.now();
    const { tasks, settings } = deps.getState();
    const events = dueReminders({ tasks, settings }, last, now);
    last = now;
    for (const e of events) {
      if (now - e.at > STALE_MS[e.type]) continue;
      if (e.type === 'block-end' && settings.notify) {
        const { title, body } = blockEndText(e);
        tell(title, body, `block-${e.block.id}`);
      } else if (e.type === 'timer-zero') {
        if (settings.timer_sound !== false) deps.playSound();
        tell('Tiempo cumplido', `"${e.task.title}" llegó a su estimado de ${e.task.minutes} min. El temporizador sigue corriendo.`, `timer-${e.task.id}`);
      } else if (e.type === 'meeting-start') {
        if (e.task.meeting.blocking) deps.startTimer(e.task.id);
        tell(`Empezó la reunión: ${e.task.title}`, `${e.task.meeting.start}–${e.task.meeting.end}`, `meeting-${e.task.id}`);
      } else if (e.type === 'meeting-end') {
        deps.finishMeeting(e.task.id);
        tell(`Terminó la reunión: ${e.task.title}`, `Su tiempo quedó registrado hasta las ${e.task.meeting.end}.`, `meeting-end-${e.task.id}`);
      }
    }
  };

  const timer = setInterval(check, TICK_MS);
  // Al volver a la app después de un rato: revisar de inmediato lo que pasó mientras tanto
  const onVisible = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
