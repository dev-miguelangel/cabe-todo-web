"""Íconos de la PWA (mismo dibujo que la extensión: anillo verde, círculo blanco y check verde).
Sin dependencias: escribe PNG con zlib. Uso: python3 scripts/make_icons.py

- icon-192.png, icon-512.png: fondo transparente.
- icon-maskable-512.png: fondo verde de borde a borde y el dibujo dentro de la zona segura (80 %),
  para que Android lo recorte en círculo, gota o cuadrado sin cortar el check.
- apple-touch-icon.png (180): sin transparencia (iPhone pinta de negro lo transparente).
"""
import struct, zlib, math, os

GREEN = (29, 185, 84)
WHITE = (255, 255, 255)
CHECK = [(-0.36, 0.02), (-0.1, 0.28), (0.38, -0.22)]

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def art(u, v):
    """Dibujo en coordenadas [-1, 1]. None = fuera del círculo."""
    r = math.hypot(u, v)
    if r > 0.96:
        return None
    if r > 0.7:
        return GREEN
    d = min(seg_dist(u, v, *CHECK[0], *CHECK[1]), seg_dist(u, v, *CHECK[1], *CHECK[2]))
    return GREEN if d < 0.13 else WHITE

def render(size, scale=1.0, background=None, ss=4):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    u = (((x + (sx + 0.5) / ss) / size) * 2 - 1) / scale
                    v = (((y + (sy + 0.5) / ss) / size) * 2 - 1) / scale
                    c = art(u, v) or background
                    if c:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 1
            n = acc[3]
            row += bytes([acc[0] // n, acc[1] // n, acc[2] // n, round(255 * n / (ss * ss))]) if n else bytes(4)
        rows.append(bytes(row))
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))

out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
ICONS = {
    'icon-192.png': (192, 0.96, None),
    'icon-512.png': (512, 0.96, None),
    'icon-maskable-512.png': (512, 1.0, GREEN),    # el anillo se funde con el fondo: queda el círculo blanco (70 %) dentro de la zona segura
    'apple-touch-icon.png': (180, 0.82, WHITE),
}
for name, (size, scale, bg) in ICONS.items():
    with open(os.path.join(out, name), 'wb') as f:
        f.write(render(size, scale, bg))
print('ok:', ', '.join(ICONS))
