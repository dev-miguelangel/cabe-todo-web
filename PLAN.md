# Plan: Cabe Todo Web (PWA mobile-first)

Versión para el celular de [Cabe Todo](https://github.com/dev-miguelangel/cabe-todo-ext), hecha con JavaScript, HTML y CSS, sin framework ni servidor, desplegada en Vercel e instalable como PWA.

- **Producción:** https://cabe-todo-web.vercel.app
- **Repositorio:** https://github.com/dev-miguelangel/cabe-todo-web (público)

## Objetivos

1. **Funciona en local**, como la extensión: los datos quedan en el celular, sin cuentas ni servidores.
2. **Comparte información con la extensión** mediante el respaldo existente (exportar e importar el mismo archivo JSON).
3. **Mobile-first** e **instalable** (PWA) en Android e iPhone.

## Punto de partida

- **Lógica:** `src/core/` de la extensión (pronóstico PERT, parser, bloques, rutinas, plantillas) son funciones puras sin dependencias de Chrome, al igual que `store.js`, el formato del respaldo y las utilidades `dates`, `text`, `markdown` y `md-format`.
- **Diseño:** el panel lateral ya tiene diseño de celular (unos 400 px de ancho, menú inferior).
- **Código de Chrome:** muy poco fuera del service worker: abrir la documentación en otra pestaña, el permiso del temporizador flotante y los atajos de teclado.
- **Riesgo, la importación:** hoy reemplaza todo (`restoreBackup`), así que el último que importa gana. En el MVP se pide confirmación y se guarda un respaldo automático antes de importar. Mezclar respaldos queda para después del MVP.

## Decisiones

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Código compartido | `scripts/sync-core.mjs` **copia** desde la extensión la lógica (`core/`, `services/store.js`, `services/storage.js`, `services/casio.js`) y las utilidades puras. `npm test` falla si la copia quedó desactualizada. | Una sola fuente de verdad para la lógica y el formato del respaldo. Más adelante puede pasar a un paquete compartido. |
| Dónde se guardan los datos | Cada proyecto tiene su `services/storage-backend.js` con las mismas funciones (`getRaw`, `setRaw`, `watchRaw`). En la extensión usa `chrome.storage.local`; en la web, **IndexedDB**, con `navigator.storage.persist()` y aviso a otras pestañas con `BroadcastChannel`. | `localStorage` tiene un límite de unos 5 MB y la documentación crece. Safari en iPhone borra los datos de sitios no instalados tras 7 días sin uso. |
| Vistas | Se **copian una vez** desde la extensión (v1.0.7) y se adaptan al celular aquí. No se sincronizan. | El celular necesita cambios propios (toques, teclado, notch) que no tienen sentido en el panel lateral. |
| Respaldo | El mismo formato (`{ app: 'cabe-todo', version: 1, … }`). Exportar con `navigator.share` y un archivo (si no se puede, descarga). Importar desde un archivo. | Se comparte por WhatsApp, Drive o correo, y sirve en los dos sentidos. |
| Documentación | Página `doc.html?task=…` dentro de la app, abierta en la misma ventana, con botón **‹ Volver**. | En la PWA no hay pestañas. iPhone instalado no tiene botón atrás. |
| Compilación | Sin framework. esbuild minifica `public/` a `dist/`. | Mismo stack que la extensión. |
| Despliegue | Vercel conectado a GitHub: `main` publica a producción y cada PR crea una vista previa. | Sin servidor. |

## Diferencias con la extensión

| En la extensión | En la web |
| --- | --- |
| Avisos con la app cerrada (`alarms` + `notifications`) | Solo con la app abierta (Notification API). Sin servidor no hay avisos locales programados confiables. |
| Sonido de alarma (`offscreen`) | Web Audio, con la app abierta |
| Rutinas creadas a medianoche por el service worker | Se crean al abrir la app y cada minuto mientras está abierta (`ensureRoutines`) |
| Temporizador flotante en las páginas | No existe |
| Arrastrar y soltar (HTML5 drag & drop) | Eventos de puntero (fase 2); mientras tanto, el menú ⇢ |
| Tooltips al pasar el mouse | Al tocar |
| Atajos de teclado y panel lateral | Se quitan |
| PDF (`window.print`) | Android: imprimir y guardar como PDF. iPhone: por el menú de compartir (hay que probarlo). |

## Fases

### Fase 0: base ✅
- Repositorio público, estructura, `sync-core.mjs`, `build.mjs`, pruebas, `vercel.json` (compilación, CSP, caché).
- Despliegue en Vercel conectado a GitHub.
- **Listo cuando:** la URL de producción responde y cada PR genera una vista previa.

### Fase 1: la app funcionando en el navegador ✅
- **En la extensión:** separar `storage-backend.js` de `storage.js`.
- **Sincronizar** `store.js`, `storage.js` y `casio.js`.
- **`storage-backend.js` de la web:** IndexedDB, `BroadcastChannel`, migración desde `localStorage` y almacenamiento persistente.
- **Portar** las vistas Hoy, Épicas, Hechas, Rutinas, Docs y Ajustes, el modal de la tarea y la página de documentación.
- **Quitar** de Ajustes lo que no aplica: temporizador flotante y atajos de teclado.
- **Hecho:**
  - todas las vistas y la documentación, probadas a 390 px;
  - datos en IndexedDB que sobreviven a recargar;
  - un respaldo de la extensión se importa sin perder campos;
  - el aviso de fin de bloque y la cuenta regresiva de reuniones quedan para la fase 3.
- **Listo cuando:**
  - todas las vistas funcionan en un celular de 360 px;
  - los datos sobreviven a recargar;
  - las pruebas pasan;
  - un respaldo de la extensión se importa y se ve igual.

### Fase 2: diseño para celular
- Botones de al menos 44 px.
- Márgenes del notch (`env(safe-area-inset-*)`) y `100dvh`.
- Campos con letra de 16 px, para que iPhone no haga zoom.
- Teclado que no tape el campo de nueva tarea.
- Arrastrar con el dedo (eventos de puntero) y tooltips al tocar.
- **Listo cuando:** se usa cómodo con una mano en Android e iPhone.

### Fase 3: PWA instalable
- `manifest.webmanifest`: nombre, `display: standalone`, `theme_color #1db954`, íconos 192, 512, 512 maskable y `apple-touch-icon` 180.
- Service worker que guarda la app para usarla sin conexión, con versión de caché y aviso de "nueva versión disponible".
- Botón "Instalar" en Android (`beforeinstallprompt`) e instrucciones para iPhone (Compartir → Agregar a inicio).
- Avisos y sonido del temporizador con la app abierta.
- **Listo cuando:** se instala en Android e iPhone, abre sin conexión y Lighthouse no marca errores de PWA.

### Fase 4: compartir datos
- Exportar con el menú de compartir del celular (archivo JSON); si no se puede, descarga.
- Importar desde un archivo, con confirmación ("Esto reemplaza tus N tareas…") y respaldo automático previo para deshacer.
- **Listo cuando:** un respaldo de la extensión se importa en el celular y al revés sin perder campos, con una prueba de ida y vuelta en `tests/`.

### Fase 5: publicar 1.0.0
- README, versión 1.0.0 y release en GitHub.
- Enlace a la versión web desde el README de la extensión.

## Después del MVP (opcional)

- **Importar mezclando:** requiere agregar `updated_at` a tareas, épicas y rutinas en los dos proyectos.
- **`core/` como paquete compartido** (npm o submódulo).
- **Sincronización automática:** requiere un servidor y sale del enfoque "sin servidores".
- **Dominio propio.**
