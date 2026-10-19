"""로고 SVG 생성: python scripts/make-logo.py  (Noto Sans KR 윤곽선, 글자만)"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FD = os.environ.get("FONT_DIR", r"C:\Windows\Fonts")
VIOLET, INDIGO, AMBER, WHITE = "#6C47E0", "#1E1B3B", "#FFC53D", "#FFFFFF"
_cache = {}

def font(weight):
    if weight not in _cache:
        f = TTFont(os.path.join(FD, f"NotoSansKR-{weight}.ttf"))
        _cache[weight] = (f, f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm)
    return _cache[weight]

def text(s, size, x0, base, weight="Bold", track=0.0):
    f, gs, cmap, upm = font(weight)
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}"); x = x0; sc = size / upm
    for ch in s:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x, base)))
        x += gs[g].width * sc + track
    return pen.getCommands(), x - track

def svg(w, h, body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" role="img" aria-label="여성문화센터">{body}</svg>\n'
def write(name, s): open(f"public/{name}", "w", encoding="utf8").write(s)

def contrast(a=VIOLET, b=INDIGO):
    """여성은 굵게, 문화센터는 가볍게. 끝에 작은 점."""
    d1, e1 = text("여성", 30, 0, 32, "ExtraBold", -1.2)
    d2, e2 = text("문화센터", 30, e1 + 2.5, 32, "Regular", -0.6)
    dot = f'<circle cx="{e2 + 6:.2f}" cy="29.6" r="2.6" fill="{AMBER}"/>'
    return svg(e2 + 11, 42, f'<path d="{d1}" fill="{a}"/><path d="{d2}" fill="{b}"/>{dot}')

def sub(a=INDIGO, b=VIOLET):
    """한글 아래에 영문 작은 글씨."""
    d1, e1 = text("여성문화센터", 28, 0, 27, "Bold", -0.9)
    d2, e2 = text("WOMEN'S CULTURE CENTER", 7.6, 1, 42, "Medium", 2.1)
    return svg(max(e1, e2) + 2, 46, f'<path d="{d1}" fill="{a}"/><path d="{d2}" fill="{b}"/>')

def wide(a=INDIGO):
    """가볍고 자간이 넓은 한 줄, 아래에 짧은 노란 막대."""
    d, e = text("여성문화센터", 28, 0, 28, "Medium", 3.2)
    bar = f'<rect x="1" y="36" width="22" height="3" rx="1.5" fill="{AMBER}"/>'
    return svg(e + 2, 42, f'<path d="{d}" fill="{a}"/>{bar}')

def mono():
    """파비콘: 글자 하나."""
    d, e = text("여", 40, 0, 0, "ExtraBold")
    f, gs, cmap, upm = font("ExtraBold"); w = gs[cmap[ord("여")]].width * 40 / upm
    return svg(64, 64, f'<rect width="64" height="64" rx="18" fill="{VIOLET}"/><g transform="translate({(64 - w) / 2:.2f} 46)"><path d="{d}" fill="{WHITE}"/></g><circle cx="49" cy="47" r="3.6" fill="{AMBER}"/>')

write("logo-a.svg", contrast()); write("logo-b.svg", sub()); write("logo-c.svg", wide())
write("logo.svg", contrast())
write("logo-light.svg", contrast(WHITE, "#E6E1F5"))
write("icon.svg", mono())
print("ok")
