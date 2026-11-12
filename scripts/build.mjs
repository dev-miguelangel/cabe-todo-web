// Genera dist/ para publicar: copia public/, minifica JS y CSS con esbuild y compacta el HTML.
// Vercel lo corre en cada despliegue (ver vercel.json). Uso local: npm run build
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(dist, { recursive: true, force: true });
cpSync(pub, dist, { recursive: true });

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(dist);

// JS y CSS: esbuild sin bundle (cada archivo queda en su lugar; los imports no cambian)
const minifiable = files.filter((f) => ['.js', '.css'].includes(extname(f)));
if (minifiable.length) {
  const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
  execFileSync(esbuild, [...minifiable.map((f) => relative(dist, f)), '--minify', '--target=es2020,safari15',
    '--outbase=.', '--outdir=.', '--allow-overwrite', '--log-level=warning'], { cwd: dist, stdio: 'inherit' });
}

// HTML: sin comentarios ni espacios de más; {{version}} → versión del package.json
for (const f of files.filter((x) => extname(x) === '.html')) {
  writeFileSync(f, readFileSync(f, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replaceAll('{{version}}', pkg.version)
    .trim());
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const size = (d) => walk(d).reduce((n, f) => n + statSync(f).size, 0);
console.log(`✓ dist/ v${pkg.version}: ${kb(size(dist))} (public/: ${kb(size(pub))})`);
