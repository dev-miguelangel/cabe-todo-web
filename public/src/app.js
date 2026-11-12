// Arranque de la app. Fase 0: demostración del parser compartido con la extensión.
import { parseQuickAdd, formatMinutes } from './core/parser.js';
import { DEFAULT_BLOCKS, blockWords, blockName } from './core/blocks.js';
import { todayISO, shortLabel } from './utils/dates.js';
import { titleCase } from './utils/text.js';

const settings = { blocks: DEFAULT_BLOCKS };
const words = blockWords(settings);
const input = document.getElementById('try-input');
const out = document.getElementById('try-out');

const CERTAINTY = { sure: 'Muy seguro', unsure: 'No estoy seguro' };

function row(label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  return [dt, dd];
}

function render() {
  const p = parseQuickAdd(input.value, words, { today: todayISO() });
  const rows = [row('Tarea', p.title ? titleCase(p.title) : '—')];
  if (p.meeting) rows.push(row('Reunión', `${p.meeting.start}–${p.meeting.end}`));
  else rows.push(row('Duración', p.minutes ? formatMinutes(p.minutes) : '30m (por defecto)'));
  if (p.block === 'backlog') rows.push(row('Dónde', 'Backlog'));
  else if (p.block) rows.push(row('Bloque', titleCase(blockName(settings, p.block))));
  if (p.date) rows.push(row('Día', p.date === todayISO() ? 'Hoy' : shortLabel(p.date)));
  if (p.epicTag) rows.push(row('Épica', titleCase(p.epicTag)));
  if (p.certainty) rows.push(row('Certeza', CERTAINTY[p.certainty] || p.certainty));
  if (p.repeat) rows.push(row('Se repite', 'Sí'));
  out.replaceChildren(...rows.flat());
}

input.addEventListener('input', render);
document.getElementById('try').addEventListener('submit', (e) => {
  e.preventDefault();
  input.blur();
});
render();
