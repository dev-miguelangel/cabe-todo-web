// Novedades (solo web): un carrusel que cuenta lo nuevo con ejemplos de uso, UNA vez después de actualizar.
//
// Lo que hay está en data/updates.js. Lo que ya se vio va en los ajustes sincronizados, por id:
//   settings.seen_updates = { "<id>": { at: "<ISO>", viewed: true|false } }
// viewed: true si la lámina llegó a mostrarse; false si se cerró antes (igual cuenta como vista: no se repite).
// Al sincronizar (Drive, carpeta o respaldo) se une con lo visto en los otros equipos (core/merge.js).
// Antes (v1.7.2) se guardaba solo en este equipo (localStorage): se pasa a los ajustes la primera vez.
// Un usuario nuevo (el que ve el recorrido inicial) no recibe novedades: todo queda como visto.
// Desde Ajustes → Novedades se pueden volver a ver todas.

import { state, seenUpdates, markUpdatesSeen } from '../services/store.js';
import { h, openModal, closeModal, isModalOpen } from './ui.js';
import { UPDATES } from '../data/updates.js';

const LEGACY_SEEN_KEY = 'cabetodo:seenUpdates'; // v1.7.2: lo visto solo en este equipo
const TOUR_KEY = 'cabetodo:tourDone';
const MAX_SLIDES = 5; // al estrenar las novedades, solo las más recientes (el resto queda como vista)

// ---------- Registro de lo visto ----------

/** Lo visto según los ajustes sincronizados. */
export function readSeen() {
  return seenUpdates();
}

/** v1.7.2 guardaba lo visto en localStorage: pasarlo a los ajustes una vez y borrar la copia local. */
export function migrateLegacySeen() {
  let raw = null;
  try { raw = localStorage.getItem(LEGACY_SEEN_KEY); } catch { return; }
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw);
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) markUpdatesSeen(legacy);
  } catch { /* dañado: se descarta */ }
  try { localStorage.removeItem(LEGACY_SEEN_KEY); } catch { /* sin almacenamiento */ }
}

/** Marca como vistas (viewed: la lámina se mostró). Se une con lo que había: no baja un viewed: true. */
function markSeen(ids, viewed) {
  const at = new Date().toISOString();
  markUpdatesSeen(Object.fromEntries(ids.map((id) => [id, { at, viewed: Boolean(viewed) }])));
}

/** Novedades que todavía no se han visto en ningún equipo sincronizado (la más reciente primero). */
export function unseenUpdates() {
  const seen = readSeen();
  return UPDATES.filter((u) => !seen[u.id]);
}

// ---------- Láminas ----------

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderDemo(demo) {
  if (!demo) return null;
  if (demo.type === 'quickadd') {
    return h('div', { class: 'wn-demo wn-demo-quickadd', 'aria-label': `Ejemplo: escribe "${demo.text}"` },
      h('span', { class: 'wn-demo-caption' }, 'Escribe en + Nueva tarea'),
      h('div', { class: 'wn-fake-input' }, h('span', {}, demo.text), h('span', { class: 'wn-caret', 'aria-hidden': 'true' })));
  }
  if (demo.type === 'cards') {
    return h('div', { class: 'wn-demo wn-demo-cards', role: 'img', 'aria-label': `Ejemplo: ${demo.cards.map((c) => c.title).join(', ')}` },
      demo.label ? h('div', { class: 'wn-fake-divider' }, h('span', {}), demo.label) : null,
      ...demo.cards.map((c) => h('div', { class: `wn-fake-card${c.done ? ' done' : ''}` },
        h('span', { class: 'wn-fake-check', 'aria-hidden': 'true' }, c.done ? '✓' : ''),
        h('span', { class: 'wn-fake-body' }, h('strong', {}, c.title), c.meta ? h('small', {}, c.meta) : null),
        c.copy ? h('span', { class: 'wn-fake-copy', 'aria-hidden': 'true' }, '⧉') : null)));
  }
  if (demo.type === 'steps') {
    return h('ol', { class: 'wn-demo wn-demo-steps' }, ...demo.steps.map((s) => h('li', {}, s)));
  }
  return null;
}

function renderSlide(u, i, total) {
  return h('article', {
    class: 'wn-slide', role: 'group', 'aria-roledescription': 'lámina', 'aria-label': `${i + 1} de ${total}: ${u.title}`,
  },
  h('div', { class: 'wn-hero' },
    h('span', { class: 'wn-icon', 'aria-hidden': 'true' }, u.icon),
    h('span', { class: 'wn-version' }, `v${u.version}`, u.date ? ` · ${formatDate(u.date)}` : '')),
  h('h3', { class: 'wn-title' }, u.title),
  h('p', { class: 'wn-text' }, u.text),
  renderDemo(u.demo),
  u.useCase ? h('div', { class: 'wn-case' },
    h('span', { class: 'wn-case-label' }, '💡 Caso de uso'),
    h('strong', {}, u.useCase.who),
    h('p', {}, u.useCase.story)) : null,
  u.tip ? h('p', { class: 'wn-tip' }, u.tip) : null);
}

// ---------- Carrusel ----------

/**
 * Abre el carrusel con estas novedades. replay: desde Ajustes (todas; no hace falta registrar nada).
 * Al cerrarlo, todas las que se mostraron quedan como vistas.
 */
export function showWhatsNew(list = UPDATES, { replay = false } = {}) {
  if (!list.length) return;
  let index = 0;
  const viewed = new Set();
  const track = h('div', { class: 'wn-track', tabindex: '0', 'aria-live': 'polite' },
    ...list.map((u, i) => renderSlide(u, i, list.length)));
  const dots = list.length > 1
    ? h('div', { class: 'wn-dots', role: 'tablist', 'aria-label': 'Novedades' },
      ...list.map((u, i) => h('button', {
        type: 'button', class: 'wn-dot', role: 'tab', 'aria-label': `Ir a ${u.title}`, onclick: () => go(i),
      })))
    : null;
  const prev = h('button', { type: 'button', class: 'ghost small wn-prev', onclick: () => go(index - 1) }, '‹ Atrás');
  const next = h('button', { type: 'button', class: 'primary small wn-next', onclick: () => (index >= list.length - 1 ? closeModal() : go(index + 1)) });

  function update() {
    viewed.add(list[index].id);
    if (!replay) markSeen([list[index].id], true);
    prev.disabled = index === 0;
    prev.style.visibility = list.length > 1 ? '' : 'hidden';
    next.textContent = index >= list.length - 1 ? '¡Entendido!' : 'Siguiente ›';
    dots?.querySelectorAll('.wn-dot').forEach((d, i) => {
      d.classList.toggle('on', i === index);
      d.setAttribute('aria-selected', String(i === index));
    });
  }

  function go(i) {
    index = Math.max(0, Math.min(list.length - 1, i));
    track.scrollTo({ left: index * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    update();
  }

  // Deslizar con el dedo (scroll-snap): la lámina que queda a la vista manda
  let scrollTimer;
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== index) {
        index = Math.max(0, Math.min(list.length - 1, i));
        update();
      }
    }, 80);
  });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });

  const count = list.length;
  const lead = replay
    ? `Todo lo nuevo de Cabe Todo, de lo más reciente a lo más antiguo (${count}).`
    : count === 1 ? 'Hay algo nuevo desde la última vez:' : `Hay ${count} cosas nuevas desde la última vez:`;

  const heading = replay ? '✨ Novedades' : '✨ ¡Cabe Todo se actualizó!';
  openModal(heading, [
    h('div', { class: 'wn', role: 'region', 'aria-roledescription': 'carrusel', 'aria-label': 'Novedades' },
      h('p', { class: 'wn-lead' }, lead),
      track,
      h('div', { class: 'wn-nav' }, prev, dots, next)),
  ], () => {
    // Se mostró una vez: lo que no alcanzó a verse también queda registrado (como no leído)
    if (!replay) markSeen(list.map((u) => u.id), false);
  });
  // openModal pone el título en Mayúsculas Iniciales (pensado para tareas): aquí va como se escribió
  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = heading;
  document.getElementById('modal')?.classList.add('wn-modal');
  // El modal se reutiliza: al abrir otro, que no herede el tamaño del carrusel
  document.getElementById('modal')?.addEventListener('close', function clean() {
    this.classList.remove('wn-modal');
    this.removeEventListener('close', clean);
  });
  update();
  requestAnimationFrame(() => next.focus({ preventScroll: true }));
}

/**
 * Al abrir la app: si hay novedades sin ver, las muestra una vez.
 * Usuario nuevo (le toca el recorrido inicial): todo queda como visto, sin mostrar nada.
 */
export function maybeShowWhatsNew() {
  migrateLegacySeen();
  let tourDone = false;
  try { tourDone = localStorage.getItem(TOUR_KEY) === '1'; } catch { tourDone = true; }
  const isNewUser = !tourDone && !state.tasks.length && !state.epics.length;
  const pending = unseenUpdates();
  if (!pending.length) return;
  if (isNewUser) {
    markSeen(pending.map((u) => u.id), false);
    return;
  }
  const shown = pending.slice(0, MAX_SLIDES);
  const skipped = pending.slice(MAX_SLIDES);
  if (skipped.length) markSeen(skipped.map((u) => u.id), false);
  // Después del primer pintado y si no hay otro modal o el recorrido abierto
  setTimeout(() => {
    if (isModalOpen() || document.querySelector('.tour-layer')) return;
    showWhatsNew(shown);
  }, 800);
}
