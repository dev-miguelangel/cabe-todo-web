// Pruebas sin dependencias: node tests/run.mjs
// La lógica compartida ya tiene sus pruebas en la extensión; aquí se comprueba que la copia
// carga y funciona, y se irán sumando las pruebas propias de la web.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = (p) => import(pathToFileURL(join(root, 'public', p)).href);

// ---------- Código compartido: todos los módulos cargan sin el navegador ----------
{
  const core = readdirSync(join(root, 'public/src/core')).filter((f) => f.endsWith('.js'));
  assert.ok(core.length >= 8, 'core/ está sincronizado (node scripts/sync-core.mjs)');
  for (const f of core) await mod(`src/core/${f}`);
  console.log(`OK: ${core.length} módulos de core/ cargan`);
}

// ---------- Parser: el mismo resultado que en la extensión ----------
{
  const { parseQuickAdd } = await mod('src/core/parser.js');
  const { DEFAULT_BLOCKS, blockWords } = await mod('src/core/blocks.js');
  const words = blockWords({ blocks: DEFAULT_BLOCKS });
  const p = parseQuickAdd('Informe 2h ? tarde #ventas', words, { today: '2026-11-11' });
  assert.deepEqual([p.title, p.minutes, p.block, p.certainty, p.epicTag], ['Informe', 120, 'pm', 'unsure', 'ventas']);
  assert.equal(parseQuickAdd('Publicar mañana am 1h', words, { today: '2026-11-11' }).date, '2026-11-12');
  assert.equal(parseQuickAdd('Ordenar fotos bl', words, { today: '2026-11-11' }).block, 'backlog');
  console.log('OK: parser compartido');
}

// ---------- Pronóstico: un bloque que alcanza vs. uno que no ----------
{
  const { scheduleBlock } = await mod('src/core/pert.js');
  const task = (id, minutes) => ({ id, minutes, certainty: 'normal', dependencies: [], done: false, order: 0, time_entries: [] });
  const range = { start: '08:00', end: '13:00' };
  const fits = scheduleBlock([task('a', 60), task('b', 60)], range, null);
  const tight = scheduleBlock([task('a', 200), task('b', 200)], range, null);
  assert.ok(fits.probability > tight.probability, 'más trabajo, menos probabilidad');
  console.log('OK: pronóstico compartido');
}
