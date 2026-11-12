<img src="public/icons/icon128.png" alt="" width="64" align="left">

# Cabe Todo Web

**¿Te cabe todo en el día?** La versión para el celular de [Cabe Todo](https://github.com/dev-miguelangel/cabe-todo-ext): planifica tu día en bloques y sabe a tiempo si te alcanza.

<br clear="left">

Sitio web **mobile-first** e **instalable (PWA)**, hecho con JavaScript, HTML y CSS, sin framework y sin servidor. Igual que la extensión:

- **Funciona en local.** Tus datos quedan en tu celular: sin cuentas, sin servidores y sin analítica.
- **Usa el mismo respaldo.** Lo que exportas en la extensión se importa aquí, y al revés.

> 🚧 En construcción. Ver el [plan](#plan).

## Desarrollo

Requisitos: Node 20 o superior.

```bash
npm install       # instala esbuild (solo para compilar)
npm run dev       # sirve public/ en http://localhost:5173
npm test          # revisa que el código compartido esté al día y corre las pruebas
npm run build     # genera dist/ (lo que se publica)
npm run preview   # sirve dist/ en http://localhost:4173
```

Para probar en el celular, abre la URL de vista previa que Vercel crea en cada pull request. También puedes usar la IP de tu computador en la red local (`http://192.168.x.x:5173`). Sin HTTPS no se puede instalar como PWA, pero sirve para revisar el diseño.

## Código compartido con la extensión

La lógica pura vive en la extensión y se **copia** aquí:
- `src/core/`: pronóstico PERT, parser, bloques, rutinas y plantillas;
- utilidades sin DOM: `dates`, `text`, `markdown` y `md-format`.

```bash
npm run sync                                         # copia desde ../pert-day
CABE_TODO_EXT=/ruta/a/cabe-todo-ext npm run sync     # desde otra ruta
```

Cada archivo copiado empieza con `⚠ Copiado desde cabe-todo-ext`. **No se editan aquí**: se cambian en la extensión, con sus pruebas, y se vuelven a sincronizar. `npm test` falla si la copia quedó desactualizada. En Vercel no está la extensión, así que esa revisión se salta.

## Estructura

```
cabe-todo-web/
├── public/                 # lo que se publica
│   ├── index.html
│   ├── icons/
│   └── src/
│       ├── app.js          # arranque
│       ├── core/           # copiado desde la extensión
│       ├── utils/          # dates, text, markdown, md-format: copiados
│       ├── services/  views/  components/  styles/
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

| Fase | Qué | Estado |
| --- | --- | --- |
| 0 | Repositorio, estructura, código compartido y despliegue en Vercel | ✅ |
| 1 | Vistas de la extensión (Hoy, Épicas, Hechas, Rutinas, Docs, Ajustes) y datos en IndexedDB | ⏳ |
| 2 | Diseño para celular: toques de 44 px, notch, teclado, arrastrar con el dedo | ⏳ |
| 3 | PWA: manifest, service worker, uso sin conexión, instalar en Android e iPhone | ⏳ |
| 4 | Respaldo: exportar con el menú de compartir del celular, importar con confirmación | ⏳ |
| 5 | Versión 1.0.0 | ⏳ |

Diferencias con la extensión:
- Los avisos y el sonido del temporizador solo funcionan con la app abierta, porque la web no tiene alarmas en segundo plano sin servidor.
- No hay temporizador flotante ni atajos de teclado.

## Privacidad

Igual que la extensión: [política de privacidad](https://dev-miguelangel.github.io/cabe-todo-ext/privacidad.html).
