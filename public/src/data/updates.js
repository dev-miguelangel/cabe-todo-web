// Registro de novedades (solo web). Cada entrada es una lámina del carrusel "Novedades".
//
// Para anunciar algo nuevo: agrega una entrada AL PRINCIPIO, con un `id` único que no cambie nunca
// (el registro de lo visto se guarda por id). Después de actualizar, quien no la haya visto la ve una vez.
//
// Campos:
//   id       único y estable, p. ej. '1.7.1-ancladas'
//   version  versión de la app en que llegó · date 'YYYY-MM-DD'
//   icon     emoji grande de la lámina · title · text (qué es, en una o dos frases)
//   useCase  { who, story }: un caso de uso concreto, contado en simple
//   demo     ejemplo visual (opcional):
//            { type: 'quickadd', text: 'Informe 2h pm' }              lo que se escribe
//            { type: 'cards', label: '📌 Ancladas', cards: [{ title, meta, done?, copy? }] }
//            { type: 'steps', steps: ['Paso 1', 'Paso 2'] }
//   tip      un consejo corto (opcional)

export const UPDATES = [
  {
    id: '1.7.1-ancladas',
    version: '1.7.1',
    date: '2026-11-24',
    icon: '📌',
    title: 'Tareas ancladas',
    text: 'Hay tareas que no son de un día en particular, pero no quieres perderlas de vista. Ánclalas y te acompañan arriba en Hoy, todos los días, hasta que las termines.',
    useCase: {
      who: 'Ese trámite que siempre se posterga',
      story: 'Tienes que renovar el pasaporte "esta semana". Lo anclas y lo ves cada mañana. El jueves en la tarde lo haces, lo marcas, y queda hecho en tu bloque PM del jueves.',
    },
    demo: {
      type: 'cards',
      label: '📌 Ancladas',
      cards: [
        { title: 'Renovar pasaporte', meta: '30m' },
        { title: 'Pagar cuenta de la luz', meta: '10m', done: true },
      ],
    },
    tip: 'Abre una tarea y toca 📌 Anclar. Para soltarla, 📌 Desanclar: vuelve al backlog.',
  },
  {
    id: '1.7.0-copiar-titulo',
    version: '1.7.0',
    date: '2026-11-23',
    icon: '⧉',
    title: 'Copia el título con un toque',
    text: 'Junto al título de cada tarea y épica hay un botón ⧉ que copia el texto tal como lo ves. Cuando copia, cambia a ✓.',
    useCase: {
      who: 'Para avisar en el chat del equipo',
      story: 'Terminaste "Revisar propuesta cliente". Abres la tarea, tocas ⧉ y la pegas en WhatsApp o Slack sin escribirla de nuevo.',
    },
    demo: {
      type: 'cards',
      cards: [{ title: 'Revisar propuesta cliente', meta: '1h · #ventas', copy: true }],
    },
    tip: 'También está en la fila de cada épica y en la página de documentación.',
  },
  {
    id: '1.5.0-imagenes',
    version: '1.5.0 – 1.6.0',
    date: '2026-11-20',
    icon: '🖼',
    title: 'Imágenes en la documentación',
    text: 'Pega (⌘V / Ctrl+V), arrastra o usa 🖼 Imagen en la documentación de una tarea. Se achican y comprimen solas, y viajan con tu sincronización de Google Drive.',
    useCase: {
      who: 'Para no olvidar cómo era el error',
      story: 'Encontraste un error en la página de pagos. Sacas una captura, la pegas en la documentación de la tarea "Arreglar pago" y la tienes a mano cuando te pongas con ella.',
    },
    demo: { type: 'steps', steps: ['Abre la tarea → Documentación', 'Pestaña Código', 'Pega la captura con ⌘V'] },
    tip: 'En Drive cada imagen se guarda una sola vez, en la carpeta Cabe Todo/img.',
  },
  {
    id: '1.4.0-carpeta-local',
    version: '1.4.0',
    date: '2026-11-17',
    icon: '🗂',
    title: 'Sincroniza con una carpeta del computador',
    text: 'En el computador puedes elegir una carpeta y la app guarda ahí tus datos. Si eliges la misma carpeta en la extensión de Chrome, las dos quedan al día solas.',
    useCase: {
      who: 'Extensión y app web en el mismo computador',
      story: 'Usas la extensión mientras trabajas y la app instalada para planificar. Las dos apuntan a "Documentos/Cabe Todo" y ves lo mismo en ambas.',
    },
    demo: { type: 'steps', steps: ['Ajustes', 'Sincronizar con una carpeta local', 'Elige la carpeta'] },
    tip: 'En el celular esta opción no aparece: ahí usa Google Drive.',
  },
  {
    id: '1.3.0-costo-epica',
    version: '1.3.0',
    date: '2026-11-17',
    icon: '💲',
    title: 'Cuánto vale cada épica',
    text: 'Ponle un valor hora a una épica (CLP, USD o EUR) y te muestra el total, lo trabajado y lo que falta. Cada tarea muestra su costo.',
    useCase: {
      who: 'Si cobras por proyecto',
      story: 'La épica "Web cliente" vale $25.000 la hora. Al cerrar el mes ves cuántas horas trabajaste en ella y cuánto falta por cobrar.',
    },
    demo: { type: 'quickadd', text: 'Diseñar home 3h #webCliente' },
    tip: 'Sin valor hora no aparece nada: es opcional.',
  },
];
