// Recorrido inicial (solo web): una guía corta para usuarios nuevos. Oscurece la pantalla salvo la parte
// que se explica y muestra una tarjeta abajo con el paso, el texto y Atrás / Siguiente / Saltar.
// Orden: bloques del día → tareas → reuniones → rutinas → épicas → valor hora ($HH).
// Empieza solo la primera vez (sin tareas ni épicas); se puede repetir desde Ajustes.

import { state, setView } from '../services/store.js';
import { h } from './ui.js';

const DONE_KEY = 'cabetodo:tourDone';

const tab = (id) => () => setView({ tab: id });
const openSection = (name) => () => {
  setView({ tab: 'settings' });
  const section = document.querySelector(`#view-settings details[data-section="${name}"]`);
  if (section) section.open = true;
};
/** Abre la primera épica (para mostrar su valor hora); si no hay, no hace nada. */
const openFirstEpic = () => {
  setView({ tab: 'epics' });
  const item = document.querySelector('#epics-list .epic-item:not(.archived)');
  if (item && !item.open) {
    item.open = true;
    item.dispatchEvent(new Event('toggle'));
  }
};

/** Escribe un ejemplo en el campo de nueva tarea (sin enviarlo: la persona decide). */
const fillQuickAdd = (text) => () => {
  setView({ tab: 'minimal' });
  const input = document.querySelector('#minimal-add input');
  if (!input) return;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const STEPS = [
  {
    title: '¡Bienvenido a Cabe Todo!',
    text: 'Te dice si te alcanza el día: escribes tus tareas, las ordena en bloques y te muestra la probabilidad de terminar a tiempo. Te muestro lo básico en un minuto.',
  },
  {
    title: '1. Bloques del día',
    text: 'Tu día se divide en bloques: por defecto AM (08:00–13:00) y PM (14:00–19:00). Cámbiales el nombre o el horario, o agrega hasta 5 (por ejemplo "Gym" o "Foco").',
    show: openSection('blocks'),
    target: '#view-settings details[data-section="blocks"]',
  },
  {
    title: '2. Tareas',
    text: 'Escribe la tarea y, al final, cuánto dura y en qué bloque. Enter y listo. Mayúsculas y tildes dan igual.',
    example: 'Informe mensual 2h pm',
    show: tab('minimal'),
    target: '#minimal-add',
  },
  {
    title: '3. Reuniones',
    text: 'Empieza con "Reunión" y pon el día y la hora. Tienen horario fijo y la app te avisa cuando empiezan.',
    example: 'Reunión equipo jueves 10am 1h',
    show: tab('minimal'),
    target: '#minimal-add',
  },
  {
    title: '4. Rutinas',
    text: 'Para lo que se repite, agrega "cada día", "hábiles" o "todos los lunes". Se crean solas cada día y se administran en la pestaña Rutinas.',
    example: 'Standup 15m am cada día',
    show: tab('minimal'),
    target: '#minimal-add',
    alsoTarget: '.tabs .tab[data-tab="routines"]',
  },
  {
    title: '5. Épicas',
    text: 'Agrupa las tareas de un proyecto. Créala aquí o escribe #nombre al final de una tarea (si tiene espacios, va junto: #proyectoViaje).',
    example: 'Reservar hotel 1h #proyectoViaje',
    show: tab('epics'),
    target: '#new-epic',
  },
  {
    title: '6. Valor hora ($HH)',
    text: 'Al abrir una épica, en 💲 Valor hora pones cuánto vale tu hora (CLP, USD o EUR). La épica te muestra el total, lo trabajado y lo pendiente; cada tarea, su costo.',
    show: openFirstEpic,
    target: () => document.querySelector('#epics-list .epic-rate') || document.querySelector('#epics-list') || document.querySelector('#new-epic'),
  },
  {
    title: '¡Listo!',
    text: 'En Hoy, el botón ℹ︎ tiene todos los formatos para escribir tareas. Puedes repetir este recorrido en Ajustes.',
    show: tab('minimal'),
    target: '#syntax-help-btn',
  },
];

let index = 0;
let layer = null;
let raf = null;

function targetOf(step) {
  if (!step.target) return null;
  return typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
}

/** Ubica el recuadro iluminado sobre el elemento (y lo sigue si la página se mueve). */
function placeSpot() {
  if (!layer) return;
  const step = STEPS[index];
  const spots = [targetOf(step), step.alsoTarget ? document.querySelector(step.alsoTarget) : null];
  layer.querySelectorAll('.tour-spot').forEach((spot, i) => {
    const el = spots[i];
    const r = el?.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) {
      spot.hidden = true;
      return;
    }
    spot.hidden = false;
    const pad = 6;
    Object.assign(spot.style, {
      left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });
  });
  // Sin nada que iluminar: oscurecer todo igual (la tarjeta queda al centro)
  layer.classList.toggle('no-spot', !spots[0]);
}

function follow() {
  placeSpot();
  raf = requestAnimationFrame(follow);
}

function render() {
  const step = STEPS[index];
  step.show?.();
  const last = index === STEPS.length - 1;
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-title' },
    h('p', { class: 'tour-count' }, index && !last ? `Paso ${index} de ${STEPS.length - 2}` : 'Recorrido'),
    h('h2', { id: 'tour-title' }, step.title),
    h('p', { class: 'tour-text' }, step.text),
    step.example ? h('div', { class: 'tour-example' },
      h('code', {}, step.example),
      h('button', { type: 'button', class: 'link-btn', onclick: fillQuickAdd(step.example) }, 'Escríbela por mí')) : null,
    h('div', { class: 'tour-actions' },
      last ? null : h('button', { type: 'button', class: 'link-btn tour-skip', onclick: () => finish() }, 'Saltar'),
      index ? h('button', { type: 'button', class: 'ghost small', onclick: () => go(index - 1) }, 'Atrás') : null,
      h('button', { type: 'button', class: 'primary small', onclick: () => (last ? finish() : go(index + 1)) }, last ? 'Empezar' : 'Siguiente')));
  layer.querySelector('.tour-card')?.remove();
  layer.append(card);
  // Que lo iluminado quede a la vista (después de que la vista cambie)
  requestAnimationFrame(() => {
    targetOf(step)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    card.querySelector('.primary')?.focus({ preventScroll: true });
  });
}

function go(i) {
  index = Math.max(0, Math.min(STEPS.length - 1, i));
  render();
}

function finish() {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* sin almacenamiento */ }
  cancelAnimationFrame(raf);
  layer?.remove();
  layer = null;
  setView({ tab: 'minimal' });
}

/** Empieza el recorrido (desde Ajustes o la primera vez). */
export function startTour() {
  if (layer) return;
  index = 0;
  layer = h('div', { class: 'tour-layer' }, h('div', { class: 'tour-spot' }), h('div', { class: 'tour-spot tour-spot-2' }));
  layer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') finish();
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  });
  document.body.append(layer);
  render();
  follow();
}

/** La primera vez de un usuario nuevo (sin tareas ni épicas y sin haber visto el recorrido). */
export function maybeStartTour() {
  let seen = false;
  try { seen = localStorage.getItem(DONE_KEY) === '1'; } catch { seen = true; }
  if (seen || state.tasks.length || state.epics.length) return;
  setTimeout(startTour, 700);
}
