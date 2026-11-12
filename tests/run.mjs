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

// ---------- Respaldo: el formato de la extensión se lee igual aquí ----------
{
  const { parseBackup, makeBackup } = await mod('src/services/storage.js');
  const fromExtension = JSON.stringify({
    app: 'cabe-todo', version: 1, exported_at: '2026-11-11T12:00:00.000Z',
    tasks: [{ id: 't1', title: 'Diseñar landing', minutes: 60, date: '2026-11-12', block: 'am', done: false, order: 0, epic_id: 'e1' }],
    epics: [{ id: 'e1', name: 'Lanzar web', color: '#1db954', target_date: null, archived: false }],
    routines: [{ id: 'r1', title: 'Standup', days: [1, 2, 3, 4, 5], minutes: 15, block: 'am', start_date: '2026-11-11' }],
    settings: { theme: 'trello' },
  });
  const data = parseBackup(fromExtension);
  assert.equal(data.tasks[0].title, 'Diseñar landing');
  assert.equal(data.tasks[0].doc, '', 'completa los campos nuevos');
  assert.equal(data.settings.theme, 'trello');
  assert.equal(data.settings.blocks.length, 2, 'ajustes con valores por defecto');
  const again = parseBackup(JSON.stringify(makeBackup(data)));
  assert.deepEqual(again.tasks, data.tasks, 'exportar e importar de nuevo no cambia nada');
  assert.deepEqual(again.routines, data.routines);
  assert.throws(() => parseBackup('{"app":"otra"}'), /no es un respaldo/);
  console.log('OK: respaldo compatible con la extensión');
}

// ---------- Estado: store.js carga con el almacenamiento de la web ----------
{
  const S = await mod('src/services/store.js');
  await S.initStore(); // sin IndexedDB ni localStorage (Node): parte vacío
  const t = S.addFromText('Informe 2h tarde', { date: '2026-11-11', block: null });
  assert.deepEqual([t.title, t.minutes, t.block], ['Informe', 120, 'pm']);
  console.log('OK: store compartido con el almacenamiento web');
}

// ---------- Avisos con la app abierta: qué toca entre dos momentos ----------
{
  const { dueReminders, blockEndText } = await mod('src/services/reminders.js');
  const { DEFAULT_BLOCKS } = await mod('src/core/blocks.js');
  const settings = { blocks: DEFAULT_BLOCKS, notify: true };
  const ms = (h, m = 0) => new Date(2026, 10, 12, h, m).getTime();
  const iso = (h, m = 0) => new Date(ms(h, m)).toISOString();
  const base = { date: '2026-11-12', done: false, dependencies: [], time_entries: [], meeting: null };
  const tasks = [
    { ...base, id: 'a', title: 'Informe', block: 'am', minutes: 60 },
    { ...base, id: 'b', title: 'Correos', block: 'am', minutes: 20, done: true },
    // Corre desde las 12:30 con 30 min estimados: llega a cero a las 13:00
    { ...base, id: 'c', title: 'Llamar', block: 'pm', minutes: 30, time_entries: [{ start: iso(12, 30), end: null }] },
    { ...base, id: 'm', title: 'Daily', block: 'am', minutes: 15, meeting: { start: '09:30', end: '09:45', blocking: true } },
  ];
  const at = (from, to) => dueReminders({ tasks, settings }, from, to).map((e) => `${e.type}:${e.block?.id || e.task.id}`);
  assert.deepEqual(at(ms(12, 59), ms(13, 0, 5)), ['block-end:am', 'timer-zero:c'], 'fin de Mañana y temporizador en cero');
  assert.deepEqual(at(ms(13, 1), ms(13, 2)), [], 'después ya no se repite');
  assert.deepEqual(at(ms(9, 29), ms(9, 31)), ['meeting-start:m']);
  assert.deepEqual(at(ms(18, 59), ms(19, 0)), ['block-end:pm'], 'fin de Tarde (tiene "Llamar")');
  assert.deepEqual(dueReminders({ tasks: tasks.filter((t) => t.block !== 'pm'), settings }, ms(18, 59), ms(19, 0)), [], 'bloque sin tareas: sin aviso');
  const end = dueReminders({ tasks, settings }, ms(12, 59), ms(13, 0))[0];
  assert.deepEqual(blockEndText(end), { title: 'Terminó ☀︎ Mañana', body: 'Te quedan 2 tareas: Informe, Daily' });
  // Reunión en curso que llega a su fin
  const running = tasks.map((t) => (t.id === 'm' ? { ...t, time_entries: [{ start: iso(9, 30), end: null }] } : t));
  assert.deepEqual(dueReminders({ tasks: running, settings }, ms(9, 44), ms(9, 45)).map((e) => e.type), ['meeting-end']);
  console.log('OK: avisos (fin de bloque, temporizador, reuniones)');
}

// ---------- Sincronizar con Drive: la secuencia, con un Drive de mentira ----------
{
  const { runSync } = await mod('src/services/drive-api.js');
  const S = await mod('src/services/store.js');
  const fakeDrive = (initial = null) => {
    const d = { file: initial, version: 0, uploads: 0, bumpOnce: false };
    return Object.assign(d, {
      async find() { return d.file ? { id: 'f1' } : null; },
      async download() { return d.file; },
      async modified() {
        if (d.bumpOnce) { d.bumpOnce = false; d.version += 1; } // otro equipo sube justo ahora
        return `v${d.version}`;
      },
      async create(text) { d.file = text; d.version += 1; return { id: 'f1' }; },
      async update(id, text) { d.file = text; d.version += 1; d.uploads += 1; return {}; },
    });
  };
  let undo = 0;
  const local = { exportText: () => S.exportBackup(), read: (t) => S.readBackup(t), merge: (x) => S.mergeBackup(x), saveUndo: async () => { undo += 1; } };

  // 1) Sin archivo en Drive: se crea con lo local
  const drive = fakeDrive();
  S.addFromText('En el celular 30m', { date: null, block: null });
  let r = await runSync(drive, local);
  assert.equal(r.created, true);
  assert.ok(JSON.parse(drive.file).tasks.some((t) => t.title === 'En el celular'));

  // 2) Otro equipo subió una tarea: llega aquí y lo mezclado se sube
  const other = JSON.parse(drive.file);
  other.tasks.push({ id: 'desde-pc', title: 'Desde el computador', minutes: 45, date: null, block: null, done: false, order: 9, updated_at: new Date(Date.now() + 1000).toISOString() });
  drive.file = JSON.stringify(other);
  r = await runSync(drive, local, { fileId: 'f1' });
  assert.equal(r.summary.tasks.added, 1);
  assert.ok(S.findTask('desde-pc'), 'llegó la tarea del otro equipo');
  assert.ok(JSON.parse(drive.file).tasks.some((t) => t.id === 'desde-pc'), 'y queda en Drive');
  assert.equal(undo, 1, 'antes de mezclar se guarda una copia para deshacer');

  // 3) Otro equipo sube mientras tanto: se vuelve a traer y se sube una sola vez
  drive.bumpOnce = true;
  const uploads = drive.uploads;
  await runSync(drive, local, { fileId: 'f1' });
  assert.equal(drive.uploads, uploads + 1);

  // 4) Archivo dañado: no se toca nada ni se sube
  drive.file = '{ esto no es un respaldo';
  const before = S.state.tasks.length;
  await assert.rejects(() => runSync(drive, local, { fileId: 'f1' }), /JSON válido/);
  assert.equal(S.state.tasks.length, before);
  assert.equal(drive.file, '{ esto no es un respaldo');
  console.log('OK: sincronizar con Drive (crear, mezclar, choque entre equipos, archivo dañado)');
}
