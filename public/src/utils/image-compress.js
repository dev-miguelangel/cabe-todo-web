// Imágenes para la documentación (solo web): se achican y comprimen antes de guardarse, porque viajan
// dentro de la tarea o épica (respaldo, Drive, carpeta). Máximo 1600 px de lado, WebP (o JPEG si el
// navegador no sabe generar WebP, como Safari antiguo). Los GIF y las imágenes chicas también pasan por aquí.

export const MAX_SIDE = 1600;
const QUALITY = 0.82;
const MAX_INPUT = 25 * 1024 * 1024; // más que esto ni se intenta (fotos enormes)

function loadImage(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

/** Archivo de imagen → { data: 'data:image/webp;base64,…', width, height, bytes }. */
export async function compressImage(file) {
  if (!/^image\//.test(file.type)) throw new Error('Ese archivo no es una imagen.');
  if (file.size > MAX_INPUT) throw new Error('La imagen es demasiado grande (máx. 25 MB).');
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // las transparencias quedan sobre blanco si toca JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  img.close?.();
  let data = canvas.toDataURL('image/webp', QUALITY);
  if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', QUALITY);
  return { data, width, height, bytes: Math.round((data.length - data.indexOf(',') - 1) * 0.75) };
}

/** Id corto para la imagen (img:xxxx). */
export const imageId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** "Foto del pizarrón.png" → "Foto del pizarrón" (sin corchetes, que romperían el Markdown). */
export const altFromName = (name = '') => name.replace(/\.[a-z0-9]+$/i, '').replace(/[[\]()]/g, '').trim() || 'Imagen';
