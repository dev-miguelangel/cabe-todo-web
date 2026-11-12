// Ajustes propios del celular (no existen en la extensión).

/**
 * Teclado en pantalla: con el teclado abierto se marca <body class="keyboard-open"> (el menú inferior
 * se oculta para no tapar lo que se escribe) y el campo con foco se desplaza a la vista.
 */
export function installKeyboardWatch() {
  const vv = window.visualViewport;
  if (!vv) return;
  const typing = () => document.activeElement?.matches?.('input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]');
  const update = () => {
    // El teclado ocupa al menos ~25 % de la pantalla; menos que eso es la barra del navegador.
    const open = typing() && vv.height < window.innerHeight * 0.78;
    document.body.classList.toggle('keyboard-open', open);
  };
  vv.addEventListener('resize', update);
  document.addEventListener('focusin', (e) => {
    update();
    const el = e.target;
    if (!el.matches?.('input, textarea')) return;
    // Esperar a que el teclado termine de abrir antes de acomodar el campo
    setTimeout(() => {
      if (document.activeElement === el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 300);
  });
  document.addEventListener('focusout', () => setTimeout(update, 50));
}
