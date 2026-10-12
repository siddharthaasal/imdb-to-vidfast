"""Draws the extension icon into icons/. Pure Python, no dependencies.

Run from the repo root:  python3 tools/make_icons.py

Writes icons/icon-{16,32,48,128}.png for Chrome and icons/mark.svg for the
popup header, all from the shapes defined below on a 128-unit grid:
a burgundy rounded tile and a white "speed arrow" (an up-right arrowhead
whose tail breaks into flat motion dashes).
"""
import math
import struct
import zlib
from pathlib import Path

TILE = (122, 30, 58)       # #7A1E3A burgundy
ARROW = (255, 255, 255)
RADIUS = 30

# ---- Geometry ----

UX, UY = 1 / math.sqrt(2), -1 / math.sqrt(2)   # up-right
PX, PY = -UY, UX                               # perpendicular
TIP = (104, 24)
HEAD_LEN, HEAD_HALF = 38, 28
DASH_HALF = 8
DASHES = ((-1, 20), (32, 46), (58, 66))        # distances back from the head's base


def arrow_polygons():
    bx, by = TIP[0] - UX * HEAD_LEN, TIP[1] - UY * HEAD_LEN
    polys = [[TIP, (bx + PX * HEAD_HALF, by + PY * HEAD_HALF), (bx - PX * HEAD_HALF, by - PY * HEAD_HALF)]]
    w = DASH_HALF
    for s0, s1 in DASHES:
        ax, ay = bx - UX * s0, by - UY * s0
        ex, ey = bx - UX * s1, by - UY * s1
        polys.append([(ax + PX * w, ay + PY * w), (ex + PX * w, ey + PY * w),
                      (ex - PX * w, ey - PY * w), (ax - PX * w, ay - PY * w)])
    return polys


POLYS = arrow_polygons()


def in_tile(x, y):
    cx = min(max(x, RADIUS), 128 - RADIUS)
    cy = min(max(y, RADIUS), 128 - RADIUS)
    return 0 <= x <= 128 and 0 <= y <= 128 and (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2


def in_convex(x, y, pts):
    sign = None
    for i in range(len(pts)):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % len(pts)]
        c = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
        if sign is None:
            sign = c >= 0
        elif (c >= 0) != sign:
            return False
    return True


def sample(x, y):
    if not in_tile(x, y):
        return None
    return ARROW if any(in_convex(x, y, p) for p in POLYS) else TILE


# ---- PNG ----

def render(size, ss=8):
    rows = []
    for py in range(size):
        row = bytearray([0])  # PNG filter: none
        for px in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = sample((px + (sx + 0.5) / ss) * 128 / size, (py + (sy + 0.5) / ss) * 128 / size)
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 1
            row += bytes((r // a, g // a, b // a, round(255 * a / ss ** 2))) if a else bytes(4)
        rows.append(bytes(row))
    return png(size, size, b''.join(rows))


def png(w, h, raw):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))


# ---- SVG ----

def svg():
    hexc = lambda c: '#%02X%02X%02X' % c
    points = lambda p: ' '.join(f'{x:.2f},{y:.2f}' for x, y in p)
    shapes = '\n'.join(f'  <polygon points="{points(p)}" fill="{hexc(ARROW)}"/>' for p in POLYS)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n'
            f'  <rect width="128" height="128" rx="{RADIUS}" fill="{hexc(TILE)}"/>\n'
            f'{shapes}\n</svg>\n')


if __name__ == '__main__':
    out = Path(__file__).resolve().parent.parent / 'icons'
    out.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        (out / f'icon-{size}.png').write_bytes(render(size))
    (out / 'mark.svg').write_text(svg())
    print('wrote', ', '.join(sorted(p.name for p in out.iterdir())))
