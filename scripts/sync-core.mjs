// Copia el código compartido desde la extensión (cabe-todo-ext) a public/src/.
// Estos archivos NO se editan aquí: se cambian en la extensión y se vuelven a sincronizar.
//
// Uso:
//   node scripts/sync-core.mjs            copia desde ../pert-day (o CABE_TODO_EXT=/ruta/a/la/extension)
//   node scripts/sync-core.mjs --check    solo compara; sale con error si algo difiere
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ext = process.env.CABE_TODO_EXT || join(root, '..', 'pert-day');
const check = process.argv.includes('--check');

/** Lo compartido: la lógica pura (core/), el estado y las utilidades sin APIs de Chrome. */
const SHARED_DIRS = ['src/core'];
const SHARED_FILES = [
  'src/utils/dates.js', 'src/utils/text.js', 'src/utils/markdown.js', 'src/utils/md-format.js',
  // Estado, acciones y formato del respaldo. Dónde se guardan los datos es propio de cada proyecto
  // (src/services/storage-backend.js: chrome.storage en la extensión, IndexedDB aquí).
  'src/services/store.js', 'src/services/storage.js', 'src/services/casio.js',
  // Elegir Mezclar / Reemplazar al importar (usa h, openModal y closeModal de utils/ui.js, iguales aquí)
  'src/components/import-choice.js',
  // Google Drive: la API, la secuencia de sincronizar, Deshacer y la interfaz. El permiso de Google
  // (src/services/drive-session.js) es propio de cada proyecto.
  'src/services/drive-api.js', 'src/services/undo-point.js', 'src/views/drive-ui.js',
];

if (!existsSync(join(ext, 'manifest.json'))) {
  console.error(`No encuentro la extensión en ${ext}. Usa CABE_TODO_EXT=/ruta/a/cabe-todo-ext.`);
  process.exit(check ? 0 : 1); // en Vercel no está la extensión: --check no falla
}

const files = [
  ...SHARED_DIRS.flatMap((d) => readdirSync(join(ext, d)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`)),
  ...SHARED_FILES,
];

const HEADER = '// ⚠ Copiado desde cabe-todo-ext con scripts/sync-core.mjs. No editar aquí.\n';
const differ = [];
for (const f of files) {
  const src = HEADER + readFileSync(join(ext, f), 'utf8');
  const dest = join(root, 'public', f);
  const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
  if (current === src) continue;
  differ.push(f);
  if (!check) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, src);
  }
}

if (check) {
  if (differ.length) {
    console.error(`Difieren de la extensión (corre node scripts/sync-core.mjs):\n  ${differ.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✓ ${files.length} archivos compartidos al día con la extensión`);
} else {
  console.log(differ.length ? `✓ Actualizados ${differ.length} de ${files.length}:\n  ${differ.join('\n  ')}` : `✓ ${files.length} archivos ya estaban al día`);
}
