"""로고 SVG 생성: python scripts/make-logo.py  (Noto Sans KR ExtraBold 윤곽선 + 심볼)"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = sys.argv[1] if len(sys.argv) > 1 else r"C:\Windows\Fonts\NotoSansKR-ExtraBold.ttf"
VIOLET, INDIGO, AMBER, WHITE = "#6B5CA5", "#2F2B4A", "#F2C94C", "#FFFFFF"
f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm

def text_path(s, size, x0, baseline, track=0.0, kern=0.0):
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}"); x = x0; sc = size / upm
    for ch in s:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x, baseline)))
        x += gs[g].width * sc + track + kern
    return pen.getCommands(), x - track

def symbol(x, y, s, bg, arch, dot):
    k = s / 48
    t = f'translate({x:.2f} {y:.2f}) scale({k:.4f})'
    return (f'<g transform="{t}"><rect width="48" height="48" rx="14" fill="{bg}"/>'
            f'<path d="M13 37V24a11 11 0 0 1 22 0v13z" fill="{arch}"/><circle cx="24" cy="25" r="4.6" fill="{dot}"/></g>')

def svg(w, h, body, label="여성문화센터"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" role="img" aria-label="{label}">{body}</svg>\n'

def write(name, s): open(f"public/{name}", "w", encoding="utf8").write(s)

def horizontal(txt=INDIGO, bg=VIOLET, arch=WHITE, dot=AMBER):
    d, end = text_path("여성문화센터", 30, 48 + 12, 34, track=-0.9)
    return svg(end + 2, 48, symbol(0, 0, 48, bg, arch, dot) + f'<path d="{d}" fill="{txt}"/>')

def twotone(txt=INDIGO, acc=VIOLET):
    d1, e1 = text_path("여성", 30, 0, 34, track=-0.9)
    d2, e2 = text_path("문화센터", 30, e1 + 1.5, 34, track=-0.9)
    dot = f'<circle cx="{e2 + 7:.2f}" cy="31.5" r="3.4" fill="{AMBER}"/>'
    return svg(e2 + 12, 48, f'<path d="{d1}" fill="{acc}"/><path d="{d2}" fill="{txt}"/>{dot}')

def stacked(txt=INDIGO):
    d1, e1 = text_path("여성문화", 24, 62, 26, track=-0.6)
    d2, e2 = text_path("센터", 24, 62, 54, track=-0.6)
    return svg(max(e1, e2) + 2, 64, symbol(0, 0, 54, VIOLET, WHITE, AMBER) + f'<path d="{d1}" fill="{txt}"/><path d="{d2}" fill="{txt}"/>')

write("logo-a.svg", horizontal()); write("logo-b.svg", twotone()); write("logo-c.svg", stacked())
write("logo.svg", horizontal())
write("logo-light.svg", horizontal(txt=WHITE, bg=WHITE, arch=VIOLET, dot=AMBER))
write("icon.svg", svg(64, 64, symbol(0, 0, 64, VIOLET, WHITE, AMBER), "여성문화센터"))
print("ok")
