<img src="public/icons/icon128.png" alt="" width="64" align="left">

# Cabe Todo Web

**¿Te cabe todo en el día?** La versión para el celular de [Cabe Todo](https://github.com/dev-miguelangel/cabe-todo-ext): planifica tu día en bloques y sabe a tiempo si te alcanza.

<br clear="left">

Sitio web **mobile-first** e **instalable (PWA)**, hecho con JavaScript, HTML y CSS, sin framework y sin servidor. Igual que la extensión:

- **Funciona en local.** Tus datos quedan en tu celular: sin cuentas, sin servidores y sin analítica.
- **Usa el mismo respaldo.** Lo que exportas en la extensión se importa aquí, y al revés. En el celular, **Compartir…** lo envía por WhatsApp, correo o Drive, y al importar se guarda una copia de lo anterior para poder deshacer.

**Ábrela en tu celular:** https://cabe-todo-web.vercel.app

## Instalar en el celular

- **Android (Chrome):** abre la URL → Ajustes → **Instalar la app** → Instalar (o menú ⋮ → Instalar app).
- **iPhone (Safari):** abre la URL → Compartir → **Agregar a inicio**. Ábrela desde el ícono; en iPhone las notificaciones solo funcionan con la app instalada (iOS 16.4+).

Instalada, abre a pantalla completa y funciona sin conexión. Cuando hay una versión nueva, la app avisa con **Actualizar**.

## Sincronizar con Google Drive (experimental)

**Ajustes → Sincronizar con Google Drive → Conectar**. Guarda tus datos en un archivo privado de tu Drive (`Cabe Todo/cabe-todo-sync.json`); después, **Sincronizar ahora** (o el botón ⟳ de Hoy) lo trae, lo mezcla con lo local y sube el resultado. La app solo puede ver ese archivo (permiso `drive.file`). Por ahora la app de Google está en modo prueba: solo funciona con cuentas autorizadas. Ver el [plan de sincronización](https://github.com/dev-miguelangel/cabe-todo-ext/blob/main/docs/plan-sincronizacion.md).

## Pasar tus datos entre la extensión y el celular

1. En la extensión: **Ajustes → Respaldo → Exportar**. En el celular: **Ajustes → Respaldo → Compartir…** (o Descargar).
2. Envía el archivo `cabe-todo-AAAA-MM-DD.json` al otro equipo (WhatsApp, correo, Drive…).
3. En el otro lado: **Ajustes → Respaldo → Importar…** y elige **Mezclar** (suma lo del respaldo; en cada tarea queda la versión más reciente) o **Reemplazar todo**. En el celular se guarda una copia para **Deshacer**.

## Desarrollo

Requisitos: Node 20 o superior.

```bash
npm install       # instala esbuild (solo para compilar)
npm run dev       # sirve public/ en http://localhost:5173
npm test          # revisa que el código compartido esté al día y corre las pruebas
npm run build     # genera dist/ (lo que se publica)
npm run preview   # sirve dist/ en http://localhost:4173 (con service worker: sin conexión y actualizaciones)
```

`npm run dev` no registra el service worker (la lista de archivos que guarda se genera al compilar). Para probar la PWA usa `npm run build && npm run preview`. Los íconos se regeneran con `python3 scripts/make_icons.py`.

Para probar en el celular, abre la URL de vista previa que Vercel crea en cada pull request. También puedes usar la IP de tu computador en la red local (`http://192.168.x.x:5173`). Sin HTTPS no se puede instalar como PWA, pero sirve para revisar el diseño.

## Código compartido con la extensión

La lógica vive en la extensión y se **copia** aquí:
- `src/core/`: pronóstico PERT, parser, bloques, rutinas y plantillas;
- `src/services/store.js` (estado y acciones), `storage.js` (datos guardados y formato del respaldo) y `casio.js` (sonido);
- utilidades sin DOM: `dates`, `text`, `markdown` y `md-format`.

Dónde se guardan los datos es propio de cada proyecto: `src/services/storage-backend.js` usa `chrome.storage` en la extensión e **IndexedDB** aquí, con aviso a otras pestañas y almacenamiento persistente. Como el formato del respaldo es el mismo código, un respaldo de la extensión se importa aquí sin cambios, y al revés.

Las vistas y componentes (`views/`, `components/`, `utils/ui.js`, `tooltip.js`) se copiaron una vez desde la extensión v1.0.7 y se adaptan al celular aquí: **no** se sincronizan.

```bash
npm run sync                                         # copia desde ../pert-day
CABE_TODO_EXT=/ruta/a/cabe-todo-ext npm run sync     # desde otra ruta
```

Cada archivo copiado empieza con `⚠ Copiado desde cabe-todo-ext`. **No se editan aquí**: se cambian en la extensión, con sus pruebas, y se vuelven a sincronizar. `npm test` falla si la copia quedó desactualizada. En Vercel no está la extensión, así que esa revisión se salta.

## Estructura

```
cabe-todo-web/
├── public/                 # lo que se publica
│   ├── index.html          # la app: Hoy, Épicas, Hechas, Rutinas, Docs y Ajustes
│   ├── doc.html            # documentación de una tarea (?task=…)
│   ├── manifest.webmanifest  sw.js   # PWA: instalación y sin conexión
│   ├── icons/
│   └── src/
│       ├── app.js  doc.js  # arranque de cada página
│       ├── core/           # copiado desde la extensión
│       ├── services/       # store, storage, casio: copiados · storage-backend (IndexedDB), reminders (avisos), backup-share (compartir y deshacer), drive-sync (Google Drive): propios
│       ├── views/  components/   # portados desde la extensión
│       ├── utils/          # dates, text, markdown, md-format: copiados · ui, tooltip, theme-boot: portados · mobile.js: teclado · pwa.js: service worker e instalación
│       └── styles/         # app.css, doc.css, theme-trello.css: portados · mobile.css: propio del celular
├── scripts/
│   ├── sync-core.mjs       # copia el código compartido
│   └── build.mjs           # minifica public/ → dist/
├── tests/run.mjs
└── vercel.json             # compilación, cabeceras de seguridad y caché
```

## Despliegue

En **Vercel**, conectado a este repositorio:
- cada push a `main` publica en producción;
- cada pull request crea una vista previa.

Vercel corre `npm run build` y publica `dist/`. La configuración está en `vercel.json`.

## Plan

Ver [PLAN.md](PLAN.md): decisiones, diferencias con la extensión y fases.

| Fase | Qué | Estado |
| --- | --- | --- |
| 0 | Repositorio, código compartido y despliegue en Vercel | ✅ |
| 1 | Vistas de la extensión y datos en IndexedDB | ✅ |
| 2 | Diseño para celular | ✅ |
| 3 | PWA instalable, sin conexión, avisos con la app abierta | ✅ |
| 4 | Respaldo con el menú de compartir del celular | ✅ |
| 5 | Versión 1.0.0 | ✅ |

## Privacidad

Igual que la extensión: [política de privacidad](https://dev-miguelangel.github.io/cabe-todo-ext/privacidad.html).
