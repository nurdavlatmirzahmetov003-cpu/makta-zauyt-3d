"""Build a Kazakh supplement for Unbounded (which ships without Ә Ғ Қ Ң Ө Ұ Ү Һ).

Unbounded is OFL-1.1 with no Reserved Font Name, so modified versions are allowed.
New glyphs are composed from existing Unbounded outlines (+ stems/bars), per weight,
and saved as small woff2 files declared under the same CSS family via unicode-range.

Usage: pip install fonttools brotli && python3 scripts/build-kz-font.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules/@fontsource/unbounded/files'
OUT = ROOT / 'src/fonts'
WEIGHTS = [400, 500, 600, 700, 800]
KZ = 'ӘәҒғҚқҢңӨөҰұҮүҺһ'


def load(subset_name, w):
    return TTFont(SRC / f'unbounded-{subset_name}-{w}-normal.woff2')


def build(w):
    cyr, lat, latx = load('cyrillic', w), load('latin', w), load('latin-ext', w)
    sources = []
    for f in (cyr, lat, latx):
        sources.append((f.getBestCmap(), f.getGlyphSet(), f['hmtx']))

    def find(ch):
        for cm, gs, hm in sources:
            if ord(ch) in cm:
                name = cm[ord(ch)]
                return gs, name, hm[name][0]
        raise KeyError(ch)

    def bounds(ch):
        gs, name, _ = find(ch)
        p = BoundsPen(gs)
        gs[name].draw(p)
        return p.bounds

    stem_uc = bounds('I')[2] - bounds('I')[0]
    stem_lc = bounds('l')[2] - bounds('l')[0]
    hy = bounds('-')
    bar = hy[3] - hy[1]
    desc_uc = -bounds('Ц')[1]
    desc_lc = -bounds('ц')[1]
    cap = cyr['OS/2'].sCapHeight
    xh = cyr['OS/2'].sxHeight

    def rect(pen, x0, y0, x1, y1):  # clockwise (TrueType outer contour)
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()

    def compose(base, dx=0, dy=0, sx=1, sy=1, extra=None, adv_add=0):
        gs, name, adv = find(base)
        pen = TTGlyphPen(None)
        rec = DecomposingRecordingPen(gs)
        gs[name].draw(rec)
        rec.replay(TransformPen(pen, (sx, 0, 0, sy, dx, dy)))
        b = bounds(base)
        if extra:
            extra(pen, b)
        g = pen.glyph()
        g.flags[0] |= 0x40  # OVERLAP_SIMPLE: contours intentionally overlap
        lsb = round(min(b[0] * sx + dx, *(c[0] for c in g.coordinates)) if g.numberOfContours else 0)
        return g, (round(adv * sx + adv_add), lsb)

    def descender(stem, depth, reach):
        def f(pen, b):
            x1 = b[2] + reach
            rect(pen, b[2] - stem, -depth, x1, stem * 0.6)
        return f

    def cross_bar(stem, y_mid, over):
        def f(pen, b):
            rect(pen, b[0] - over, y_mid - bar / 2, b[0] + stem + over * 1.6, y_mid + bar / 2)
        return f

    def y_bar(y_mid, half):
        def f(pen, b):
            cx = (b[0] + b[2]) / 2
            rect(pen, cx - half, y_mid - bar / 2, cx + half, y_mid + bar / 2)
        return f

    # lowercase ү/ұ: Y drawn narrower/shorter and dropped below the baseline
    lc_y_dy = -desc_lc
    glyphs = {
        'Ә': compose('Ə'), 'ә': compose('ə'),
        'Ө': compose('Ɵ'), 'ө': compose('ɵ'),
        'Һ': compose('h'), 'һ': compose('h'),
        'Ү': compose('Y'),
        'ү': compose('Y', sx=0.84, sy=(xh + desc_lc) / cap, dy=lc_y_dy),
        'Ұ': compose('Y', extra=y_bar(cap * 0.3, 260)),
        'ұ': compose('Y', sx=0.84, sy=(xh + desc_lc) / cap, dy=lc_y_dy,
                     extra=lambda pen, b: rect(pen, (b[0] + b[2]) * 0.42 - 210, -bar * 0.15 - bar / 2,
                                               (b[0] + b[2]) * 0.42 + 210, -bar * 0.15 + bar / 2)),
        'Қ': compose('К', extra=descender(stem_uc * 0.9, desc_uc, 40), adv_add=40),
        'қ': compose('к', extra=descender(stem_lc * 0.9, desc_lc, 36), adv_add=36),
        'Ң': compose('Н', extra=descender(stem_uc, desc_uc, 80), adv_add=80),
        'ң': compose('н', extra=descender(stem_lc, desc_lc, 70), adv_add=70),
    }
    # Ғ/ғ: shifted Г/г plus a bar across the stem.
    for ch, base, stem, ymid in (('Ғ', 'Г', stem_uc, cap * 0.46), ('ғ', 'г', stem_lc, xh * 0.46)):
        b = bounds(base)
        dx = bar * (0.5 if ch == 'Ғ' else 0.4)
        glyphs[ch] = compose(base, dx=dx, adv_add=dx, extra=lambda pen, _b, b=b, dx=dx, s=stem, y=ymid:
                             rect(pen, b[0] + dx - bar * 0.9, y - bar / 2, b[0] + dx + s + bar * 0.9, y + bar / 2))

    font = cyr
    order = font.getGlyphOrder()
    cmap_tables = [t for t in font['cmap'].tables if t.isUnicode()]
    for ch, (g, metrics) in glyphs.items():
        name = f'uni{ord(ch):04X}.kz'
        order.append(name)
        font['glyf'].glyphs[name] = g
        font['hmtx'].metrics[name] = metrics
        for t in cmap_tables:
            t.cmap[ord(ch)] = name
    font.setGlyphOrder(order)
    font['post'].formatType = 3.0
    for t in ('GSUB', 'GPOS', 'GDEF'):
        if t in font:
            del font[t]
    for rec in font['name'].names:
        if rec.nameID in (1, 3, 4, 6, 16):
            s = rec.toUnicode()
            rec.string = s.replace('Unbounded', 'Unbounded KZ', 1) if 'Unbounded KZ' not in s else s

    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = []
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(c) for c in KZ])
    sub.subset(font)
    out = OUT / f'unbounded-kz-{w}.woff2'
    font.flavor = 'woff2'
    font.save(out)
    print('wrote', out.relative_to(ROOT), out.stat().st_size, 'bytes')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for w in WEIGHTS:
        build(w)
