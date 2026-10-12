"""Draws docs/install.gif, an illustrated walkthrough of installing the extension.

Needs Pillow (pip install pillow). Run from the repo root:
    python3 tools/make_install_gif.py

Every frame is drawn at 2x and scaled down, so shapes and text stay smooth.
The screens are simplified illustrations, not screenshots.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 960, 600
K = 2  # supersampling factor

# ---- Palette ----
BG = (243, 241, 238)
WHITE = (255, 255, 255)
INK = (24, 24, 24)
MUTED = (112, 110, 106)
FAINT = (170, 168, 163)
LINE = (226, 224, 220)
CHROME = (233, 231, 228)
FIELD = (241, 240, 238)
BRAND = (122, 30, 58)          # burgundy, same as the icon
BRAND_SOFT = (244, 228, 233)
FOLDER = (122, 166, 222)
FOLDER_TAB = (100, 146, 206)

FONT = '/System/Library/Fonts/HelveticaNeue.ttc'
MONO = '/System/Library/Fonts/Menlo.ttc'


def font(size, weight='regular'):
    index = {'regular': 0, 'bold': 1, 'medium': 10}[weight]
    return ImageFont.truetype(FONT, size * K, index=index)


def mono(size):
    return ImageFont.truetype(MONO, size * K)


ICON = Image.open(ROOT / 'icons' / 'icon-128.png').convert('RGBA')

# ---- Layout (1x coordinates) ----
WIN = (60, 32, 900, 492)       # browser / finder window
TAB_H, BAR_H = 38, 44
CAPTION_Y = 516
OMNI = (150, WIN[1] + TAB_H + 8, 760, WIN[1] + TAB_H + BAR_H - 8)
PUZZLE = (800, WIN[1] + TAB_H + BAR_H // 2)
PINNED = (840, WIN[1] + TAB_H + BAR_H // 2)
CONTENT_Y = WIN[1] + TAB_H + BAR_H

STEPS = [
    ('Unzip the download', 'Keep the folder somewhere permanent, like Documents.'),
    ('Open chrome://extensions', 'Type it into the address bar and press Enter.'),
    ('Turn on Developer mode', 'The switch is at the top right of the page.'),
    ('Click Load unpacked', 'Then select the vidfast-launcher folder.'),
    ('Pin it to the toolbar', 'Open the puzzle-piece menu and click the pin.'),
    ('Click it on any IMDb title', 'The title opens in a new tab, right next to the current one.'),
]


def s(*v):
    return [round(x * K) for x in v]


# ---- Drawing helpers ----

def rrect(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(s(*box), radius=r * K, fill=fill, outline=outline, width=width * K)


def text(d, xy, value, f, fill=INK, anchor='la'):
    d.text(s(*xy), value, font=f, fill=fill, anchor=anchor)


def paste_icon(img, cx, cy, size):
    icon = ICON.resize((size * K, size * K), Image.LANCZOS)
    img.paste(icon, (round((cx - size / 2) * K), round((cy - size / 2) * K)), icon)


def shadow_layer():
    layer = Image.new('RGBA', (W * K, H * K), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = WIN
    d.rounded_rectangle(s(x0, y0 + 6, x1, y1 + 6), radius=14 * K, fill=(0, 0, 0, 38))
    return layer.filter(ImageFilter.GaussianBlur(14 * K))


SHADOW = shadow_layer()


def base():
    img = Image.new('RGBA', (W * K, H * K), BG + (255,))
    img.alpha_composite(SHADOW)
    return img


def window(img, title=None):
    d = ImageDraw.Draw(img)
    rrect(d, WIN, 12, fill=WHITE)
    x0, y0, x1, _ = WIN
    if title:  # Finder-style title bar
        d.rounded_rectangle(s(x0, y0, x1, y0 + 40), radius=12 * K, fill=CHROME, corners=(True, True, False, False))
        window_dots(d, x0, y0 + 20)
        text(d, ((x0 + x1) / 2, y0 + 20), title, font(13, 'medium'), MUTED, 'mm')
        d.line(s(x0, y0 + 40, x1, y0 + 40), fill=LINE, width=K)
    return d


def browser(img, tabs, url, active=0, pinned=False, typing_caret=False):
    d = window(img)
    x0, y0, x1, _ = WIN
    d.rounded_rectangle(s(x0, y0, x1, y0 + TAB_H), radius=12 * K, fill=CHROME, corners=(True, True, False, False))
    window_dots(d, x0, y0 + 19)
    tx = x0 + 84
    for i, label in enumerate(tabs):
        box = (tx, y0 + 6, tx + 200, y0 + TAB_H)
        if i == active:
            d.rounded_rectangle(s(*box), radius=8 * K, fill=WHITE, corners=(True, True, False, False))
        text(d, (tx + 14, y0 + 22), label, font(12, 'medium' if i == active else 'regular'),
             INK if i == active else MUTED, 'lm')
        tx += 204
    # Toolbar
    cy = y0 + TAB_H + BAR_H / 2
    nav_icons(d, x0 + 22, cy)
    rrect(d, OMNI, 15, fill=FIELD)
    caret = '|' if typing_caret else ''
    text(d, (OMNI[0] + 16, cy), url + caret, mono(12), INK, 'lm')
    draw_puzzle(d, *PUZZLE)
    if pinned:
        paste_icon(img, *PINNED, 20)
    d.line(s(x0, y0 + TAB_H + BAR_H, x1, y0 + TAB_H + BAR_H), fill=LINE, width=K)
    return d


def window_dots(d, x0, cy):
    for i in range(3):
        cx = x0 + 24 + i * 20
        d.ellipse(s(cx - 6, cy - 6, cx + 6, cy + 6), fill=(208, 205, 200))


def nav_icons(d, x, cy):
    w = round(1.8 * K)
    # back and forward chevrons
    d.line(s(x + 4, cy - 6, x - 2, cy, x + 4, cy + 6), fill=FAINT, width=w, joint='curve')
    d.line(s(x + 22, cy - 6, x + 28, cy, x + 22, cy + 6), fill=FAINT, width=w, joint='curve')
    # reload: open circle with a small head
    cx = x + 50
    d.arc(s(cx - 7, cy - 7, cx + 7, cy + 7), start=-60, end=250, fill=FAINT, width=w)
    d.polygon(s(cx + 3, cy - 10, cx + 9, cy - 6, cx + 3, cy - 2), fill=FAINT)


def draw_puzzle(d, cx, cy, color=MUTED):
    d.rounded_rectangle(s(cx - 7, cy - 5, cx + 5, cy + 7), radius=2 * K, fill=color)
    d.ellipse(s(cx - 4, cy - 10, cx + 2, cy - 4), fill=color)
    d.ellipse(s(cx + 3, cy - 2, cx + 9, cy + 4), fill=color)


def draw_pin(d, cx, cy, color):
    d.ellipse(s(cx - 5, cy - 8, cx + 5, cy + 2), fill=color)
    d.line(s(cx, cy + 1, cx, cy + 9), fill=color, width=2 * K)


def caption(img, step):
    d = ImageDraw.Draw(img)
    title, sub = STEPS[step]
    x = WIN[0]
    rrect(d, (x, CAPTION_Y + 8, x + 52, CAPTION_Y + 36), 14, fill=BRAND)
    text(d, (x + 26, CAPTION_Y + 22), f'{step + 1}/{len(STEPS)}', font(13, 'bold'), WHITE, 'mm')
    text(d, (x + 66, CAPTION_Y + 14), title, font(19, 'bold'), INK)
    text(d, (x + 66, CAPTION_Y + 42), sub, font(14), MUTED)
    # progress dots
    for i in range(len(STEPS)):
        cx = WIN[2] - (len(STEPS) - 1 - i) * 16 - 4
        c = BRAND if i <= step else LINE
        d.ellipse(s(cx - 4, CAPTION_Y + 18, cx + 4, CAPTION_Y + 26), fill=c)


def cursor(img, x, y, click=0.0):
    d = ImageDraw.Draw(img)
    if click:
        r = 10 + 16 * click
        alpha = round(150 * (1 - click))
        ring = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(ring).ellipse(s(x - r, y - r, x + r, y + r), outline=BRAND + (alpha,), width=3 * K)
        img.alpha_composite(ring)
    pts = [(0, 0), (0, 17), (4.5, 13), (7.5, 20), (10.5, 18.8), (7.6, 12.2), (13, 12.2)]
    d.polygon([v for px, py in pts for v in s(x + px, y + py)], fill=INK, outline=WHITE, width=round(1.5 * K))


def highlight(d, box):
    x0, y0, x1, y1 = box
    rrect(d, (x0 - 4, y0 - 4, x1 + 4, y1 + 4), 10, outline=BRAND, width=2)


def toggle(d, x, y, on):
    rrect(d, (x, y, x + 34, y + 20), 10, fill=BRAND if on else LINE)
    kx = x + 24 if on else x + 10
    d.ellipse(s(kx - 7, y + 3, kx + 7, y + 17), fill=WHITE)


# ---- Scenes ----

def ease(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * ease(t)


class Reel:
    def __init__(self):
        self.frames, self.durations = [], []

    def add(self, img, ms):
        self.frames.append(img.convert('RGB').resize((W, H), Image.LANCZOS))
        self.durations.append(ms)

    def move(self, draw_scene, start, end, steps=8, ms=40):
        for i in range(1, steps + 1):
            t = i / steps
            img = draw_scene()
            cursor(img, lerp(start[0], end[0], t), lerp(start[1], end[1], t))
            self.add(img, ms)

    def click(self, draw_scene, at, steps=4, ms=45):
        for i in range(1, steps + 1):
            img = draw_scene()
            cursor(img, *at, click=i / steps)
            self.add(img, ms)


def scene_unzip(reel):
    zip_pos, folder_pos = (300, 230), (520, 230)

    def draw(unzipped=False, selected=False):
        img = base()
        d = window(img, 'Downloads')
        caption(img, 0)
        zx, zy = zip_pos
        if selected:
            rrect(d, (zx - 50, zy - 44, zx + 50, zy + 72), 10, fill=BRAND_SOFT)
        rrect(d, (zx - 26, zy - 34, zx + 26, zy + 30), 6, fill=WHITE, outline=LINE, width=2)
        for i in range(6):
            d.rectangle(s(zx - 3, zy - 30 + i * 8, zx + 3, zy - 26 + i * 8), fill=MUTED if i % 2 else FAINT)
        text(d, (zx, zy + 48), 'vidfast-launcher', font(12), INK, 'mm')
        text(d, (zx, zy + 63), '-v1.0.0.zip', font(12), INK, 'mm')
        if unzipped:
            fx, fy = folder_pos
            rrect(d, (fx - 50, fy - 44, fx + 50, fy + 72), 10, fill=BRAND_SOFT)
            rrect(d, (fx - 32, fy - 30, fx - 4, fy - 18), 4, fill=FOLDER_TAB)
            rrect(d, (fx - 32, fy - 24, fx + 32, fy + 26), 6, fill=FOLDER)
            text(d, (fx, fy + 48), 'vidfast-launcher', font(12, 'medium'), INK, 'mm')
        return img

    start = (700, 420)
    reel.add(draw_with_cursor(draw, start), 900)
    reel.move(draw, start, (305, 232))
    reel.click(lambda: draw(selected=True), (305, 232), steps=3)
    reel.click(lambda: draw(selected=True), (305, 232), steps=3)
    img = draw(unzipped=True)
    cursor(img, 305, 232)
    reel.add(img, 1600)


def draw_with_cursor(draw, at, **kw):
    img = draw(**kw)
    cursor(img, *at)
    return img


def extensions_page(img, d, dev_mode=False, loaded=False):
    x0, _, x1, y1 = WIN
    y = CONTENT_Y
    text(d, (x0 + 28, y + 30), 'Extensions', font(20, 'bold'))
    text(d, (x1 - 76, y + 30), 'Developer mode', font(13), MUTED, 'rm')
    toggle(d, x1 - 64, y + 20, dev_mode)
    d.line(s(x0, y + 58, x1, y + 58), fill=LINE, width=K)
    if dev_mode:
        for i, label in enumerate(('Load unpacked', 'Pack extension', 'Update')):
            bx = x0 + 28 + i * 150
            rrect(d, (bx, y + 72, bx + 136, y + 102), 8, outline=LINE, width=1)
            text(d, (bx + 68, y + 87), label, font(13, 'medium'), BRAND if i == 0 else MUTED, 'mm')
    if loaded:
        cx, cy = x0 + 28, y + 124
        rrect(d, (cx, cy, cx + 360, cy + 130), 12, outline=LINE, width=1)
        paste_icon(img, cx + 36, cy + 36, 40)
        text(d, (cx + 70, cy + 24), 'VidFast launcher', font(15, 'bold'))
        text(d, (cx + 202, cy + 24), '1.0.0', font(13), FAINT)
        text(d, (cx + 70, cy + 46), 'Open the IMDb title you’re looking', font(12), MUTED)
        text(d, (cx + 70, cy + 62), 'at in VidFast with one click.', font(12), MUTED)
        text(d, (cx + 20, cy + 108), 'Details', font(12, 'medium'), BRAND, 'lm')
        text(d, (cx + 84, cy + 108), 'Remove', font(12, 'medium'), BRAND, 'lm')
        toggle(d, cx + 306, cy + 98, True)


def scene_open_extensions(reel):
    url = 'chrome://extensions'

    def draw(typed='', page=False):
        img = base()
        d = browser(img, ['Extensions' if page else 'New Tab'], typed, typing_caret=not page)
        caption(img, 1)
        if page:
            extensions_page(img, d)
        return img

    target = (OMNI[0] + 40, (OMNI[1] + OMNI[3]) / 2)
    reel.move(draw, (520, 330), target, steps=8)
    reel.click(draw, target)
    for n in range(1, len(url) + 1, 2):
        reel.add(draw_with_cursor(draw, target, typed=url[:n]), 55)
    reel.add(draw_with_cursor(draw, target, typed=url), 500)
    reel.add(draw_with_cursor(draw, target, typed=url, page=True), 1300)


def scene_dev_mode(reel):
    def draw(on=False, ring=True):
        img = base()
        d = browser(img, ['Extensions'], 'chrome://extensions')
        caption(img, 2)
        extensions_page(img, d, dev_mode=on)
        if ring and not on:
            x1 = WIN[2]
            highlight(d, (x1 - 64, CONTENT_Y + 20, x1 - 30, CONTENT_Y + 40))
        return img

    toggle_at = (WIN[2] - 47, CONTENT_Y + 30)
    reel.move(draw, (OMNI[0] + 40, (OMNI[1] + OMNI[3]) / 2), toggle_at, steps=10)
    reel.click(draw, toggle_at)
    reel.add(draw_with_cursor(draw, toggle_at, on=True), 1300)


def scene_load_unpacked(reel):
    x0 = WIN[0]
    btn = (x0 + 28 + 68, CONTENT_Y + 87)
    dlg = (250, 120, 710, 440)
    row_y = [dlg[1] + 92 + i * 40 for i in range(3)]
    folders = ['Photos', 'Projects', 'vidfast-launcher']
    select_btn = (dlg[2] - 60, dlg[3] - 32)

    def draw(dialog=False, picked=False, loaded=False, ring=False):
        img = base()
        d = browser(img, ['Extensions'], 'chrome://extensions')
        caption(img, 3)
        extensions_page(img, d, dev_mode=True, loaded=loaded)
        if ring:
            highlight(d, (x0 + 28, CONTENT_Y + 72, x0 + 164, CONTENT_Y + 102))
        if dialog:
            dim = Image.new('RGBA', img.size, (0, 0, 0, 70))
            img.alpha_composite(dim)
            d = ImageDraw.Draw(img)
            rrect(d, dlg, 12, fill=WHITE)
            text(d, (dlg[0] + 24, dlg[1] + 30), 'Select the extension folder', font(15, 'bold'))
            text(d, (dlg[0] + 24, dlg[1] + 56), 'Documents', font(12), MUTED)
            d.line(s(dlg[0], dlg[1] + 72, dlg[2], dlg[1] + 72), fill=LINE, width=K)
            for name, ry in zip(folders, row_y):
                chosen = picked and name == 'vidfast-launcher'
                if chosen:
                    rrect(d, (dlg[0] + 12, ry - 16, dlg[2] - 12, ry + 16), 8, fill=BRAND_SOFT)
                rrect(d, (dlg[0] + 28, ry - 8, dlg[0] + 40, ry - 3), 2, fill=FOLDER_TAB)
                rrect(d, (dlg[0] + 28, ry - 5, dlg[0] + 50, ry + 9), 3, fill=FOLDER)
                text(d, (dlg[0] + 62, ry), name, font(13, 'medium' if chosen else 'regular'), INK, 'lm')
            rrect(d, (dlg[2] - 104, dlg[3] - 48, dlg[2] - 16, dlg[3] - 16), 8, fill=BRAND if picked else LINE)
            text(d, select_btn, 'Select', font(13, 'bold'), WHITE if picked else FAINT, 'mm')
            rrect(d, (dlg[2] - 196, dlg[3] - 48, dlg[2] - 116, dlg[3] - 16), 8, outline=LINE, width=1)
            text(d, (dlg[2] - 156, dlg[3] - 32), 'Cancel', font(13), MUTED, 'mm')
        return img

    toggle_at = (WIN[2] - 47, CONTENT_Y + 30)
    reel.move(lambda: draw(ring=True), toggle_at, btn, steps=10)
    reel.click(lambda: draw(ring=True), btn)
    row = (dlg[0] + 120, row_y[2])
    reel.move(lambda: draw(dialog=True), btn, row, steps=9)
    reel.click(lambda: draw(dialog=True, picked=True), row)
    reel.move(lambda: draw(dialog=True, picked=True), row, select_btn, steps=8)
    reel.click(lambda: draw(dialog=True, picked=True), select_btn)
    reel.add(draw_with_cursor(draw, select_btn, loaded=True), 1500)


def scene_pin(reel):
    menu = (572, CONTENT_Y + 4, 884, CONTENT_Y + 104)
    pin_at = (menu[2] - 30, menu[1] + 70)

    def draw(open_menu=False, pinned=False):
        img = base()
        d = browser(img, ['Extensions'], 'chrome://extensions', pinned=pinned)
        caption(img, 4)
        extensions_page(img, d, dev_mode=True, loaded=True)
        if open_menu:
            shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
            ImageDraw.Draw(shadow).rounded_rectangle(s(menu[0], menu[1] + 4, menu[2], menu[3] + 4),
                                                     radius=12 * K, fill=(0, 0, 0, 40))
            img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8 * K)))
            d = ImageDraw.Draw(img)
            d.rounded_rectangle(s(*menu), radius=12 * K, fill=WHITE, outline=LINE, width=K)
            text(d, (menu[0] + 18, menu[1] + 26), 'Extensions', font(14, 'bold'))
            rrect(d, (menu[0] + 8, menu[1] + 50, menu[2] - 8, menu[1] + 90), 8, fill=FIELD)
            paste_icon(img, menu[0] + 32, menu[1] + 70, 20)
            text(d, (menu[0] + 52, menu[1] + 70), 'VidFast launcher', font(13, 'medium'), INK, 'lm')
            draw_pin(d, *pin_at, BRAND if pinned else MUTED)
        if not open_menu and not pinned:
            highlight(d, (PUZZLE[0] - 13, PUZZLE[1] - 14, PUZZLE[0] + 13, PUZZLE[1] + 12))
        return img

    start = (WIN[0] + 140, CONTENT_Y + 220)
    reel.move(draw, start, PUZZLE, steps=10)
    reel.click(draw, PUZZLE)
    reel.move(lambda: draw(open_menu=True), PUZZLE, pin_at, steps=8)
    reel.click(lambda: draw(open_menu=True, pinned=True), pin_at)
    reel.add(draw_with_cursor(draw, pin_at, open_menu=True, pinned=True), 500)
    reel.add(draw_with_cursor(draw, (PINNED[0] + 6, PINNED[1] + 26), pinned=True), 1300)


def scene_use(reel):
    def draw(opened=False):
        img = base()
        tabs = ['The Shawshank Redemption', 'VidFast'] if opened else ['The Shawshank Redemption']
        url = 'vidfast.pro/movie/tt0111161' if opened else 'imdb.com/title/tt0111161'
        d = browser(img, tabs, url, active=1 if opened else 0, pinned=True)
        caption(img, 5)
        x0, _, x1, y1 = WIN
        if opened:
            d.rounded_rectangle(s(x0, CONTENT_Y, x1, y1), radius=12 * K, fill=(16, 16, 16),
                                corners=(False, False, True, True))
            text(d, ((x0 + x1) / 2, (CONTENT_Y + y1) / 2), 'Now playing in VidFast', font(16, 'medium'),
                 (200, 200, 200), 'mm')
        else:
            y = CONTENT_Y
            rrect(d, (x0 + 28, y + 24, x0 + 168, y + 228), 8, fill=FIELD)
            text(d, (x0 + 192, y + 40), 'The Shawshank Redemption', font(22, 'bold'))
            text(d, (x0 + 192, y + 70), '1994  ·  Movie  ·  2h 22m', font(13), MUTED)
            for i, wdt in enumerate((520, 480, 500, 300)):
                rrect(d, (x0 + 192, y + 100 + i * 22, x0 + 192 + wdt, y + 110 + i * 22), 5, fill=FIELD)
            highlight(d, (PINNED[0] - 12, PINNED[1] - 12, PINNED[0] + 12, PINNED[1] + 12))
        return img

    start = (WIN[0] + 300, CONTENT_Y + 200)
    reel.add(draw_with_cursor(draw, start), 700)
    reel.move(draw, start, PINNED, steps=10)
    reel.click(draw, PINNED)
    reel.add(draw_with_cursor(draw, (PINNED[0] + 6, PINNED[1] + 26), opened=True), 2600)


def main():
    reel = Reel()
    for scene in (scene_unzip, scene_open_extensions, scene_dev_mode, scene_load_unpacked, scene_pin, scene_use):
        scene(reel)
    out = ROOT / 'docs' / 'install.gif'
    out.parent.mkdir(exist_ok=True)
    # One shared palette, built from a strip of frames across all scenes, keeps
    # colours steady from frame to frame.
    sample = reel.frames[::6]
    strip = Image.new('RGB', (W, H * len(sample) + 40))
    for i, f in enumerate(sample):
        strip.paste(f, (0, H * i))
    # Big swatches of the flat colours so they map to exact palette entries.
    flat = (BG, WHITE, INK, MUTED, FAINT, LINE, CHROME, FIELD, BRAND, BRAND_SOFT, FOLDER, (16, 16, 16))
    for i, c in enumerate(flat):
        strip.paste(c, (i * 80, H * len(sample), i * 80 + 80, H * len(sample) + 40))
    palette = strip.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in reel.frames]
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=reel.durations, loop=0, optimize=True)
    print(f'wrote {out.relative_to(ROOT)}: {len(frames)} frames, {out.stat().st_size / 1024:.0f} KB, '
          f'{sum(reel.durations) / 1000:.1f}s')


if __name__ == '__main__':
    main()
