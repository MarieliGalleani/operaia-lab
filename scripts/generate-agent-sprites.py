"""Gera os personagens pixel-art da OperaIA.lab (chibi, de frente).

Grade base 40x80 px, ampliada 5x (nearest) -> 200x400, mesmo porte dos
sprites antigos do Campus. Cada pessoa tem silhueta, cabelo, roupa e
acessorio proprios para nao confundir ninguem.
"""
import sys
from PIL import Image

GW, GH, SCALE = 40, 80, 5
OUT = sys.argv[1]


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


class Canvas:
    def __init__(self):
        self.px = [[None] * GW for _ in range(GH)]

    def set(self, x, y, c):
        if 0 <= x < GW and 0 <= y < GH and c is not None:
            self.px[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.set(x, y, c)

    def outline(self, col):
        add = []
        for y in range(GH):
            for x in range(GW):
                if self.px[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < GW and 0 <= ny < GH and self.px[ny][nx] is not None and self.px[ny][nx] != col:
                            add.append((x, y))
                            break
        for x, y in add:
            self.px[y][x] = col

    def image(self):
        im = Image.new("RGBA", (GW, GH), (0, 0, 0, 0))
        for y in range(GH):
            for x in range(GW):
                if self.px[y][x] is not None:
                    im.putpixel((x, y), self.px[y][x])
        return im.resize((GW * SCALE, GH * SCALE), Image.NEAREST)


INK = hexc("#1a1420")


def person(p):
    c = Canvas()
    skin = hexc(p["skin"]); skin_d = shade(skin, 0.82)
    hair = hexc(p["hair"]); hair_d = shade(hair, 0.72); hair_l = shade(hair, 1.25)
    top = hexc(p["top"]); top_d = shade(top, 0.75)
    pants = hexc(p.get("pants", "#2b2f3a")); pants_d = shade(pants, 0.75)
    shoes = hexc(p.get("shoes", "#1f1a17"))
    eye = hexc(p.get("eye", "#2b1d14"))

    # --- cabelo atras (longo) -------------------------------------------
    style = p["hairstyle"]
    if style in ("long", "long_straight"):
        c.rect(9, 14, 30, 46, hair_d)
        c.rect(10, 14, 29, 44, hair)
    if style == "curly_long":
        for (x, y) in [(10, 20), (29, 20), (9, 28), (30, 28), (10, 36), (29, 36), (12, 42), (27, 42)]:
            c.ellipse(x, y, 4, 5, hair)
    if style == "bun":
        c.ellipse(20, 6, 5, 4, hair)

    # --- pernas e sapatos -------------------------------------------------
    if p.get("skirt"):
        c.rect(14, 52, 25, 60, hexc(p["skirt"]))
        c.rect(15, 61, 18, 70, skin); c.rect(21, 61, 24, 70, skin)
    else:
        c.rect(14, 52, 19, 70, pants); c.rect(20, 52, 25, 70, pants_d)
        c.rect(19, 56, 20, 70, shade(pants, 0.6))
    c.rect(13, 71, 19, 74, shoes); c.rect(20, 71, 26, 74, shoes)
    c.rect(13, 74, 19, 74, shade(shoes, 1.6)); c.rect(20, 74, 26, 74, shade(shoes, 1.6))

    # --- tronco -----------------------------------------------------------
    c.rect(12, 36, 27, 53, top)
    c.rect(12, 36, 14, 53, top_d); c.rect(25, 36, 27, 53, top_d)
    # bracos
    c.rect(9, 37, 11, 50, top_d); c.rect(28, 37, 30, 50, top_d)
    c.rect(9, 51, 11, 53, skin); c.rect(28, 51, 30, 53, skin)
    # pescoco
    c.rect(18, 33, 21, 36, skin_d)

    outfit = p.get("outfit")
    if outfit == "suit":
        c.rect(18, 36, 21, 50, hexc("#f2f2f2"))
        c.rect(19, 37, 20, 47, hexc(p["tie"]))
        c.set(17, 37, top_d); c.set(22, 37, top_d)
        c.rect(15, 38, 17, 52, shade(top, 0.9)); c.rect(22, 38, 24, 52, shade(top, 0.9))
    elif outfit == "hoodie":
        c.rect(15, 35, 24, 38, top_d)
        c.rect(16, 45, 23, 50, top_d)
        c.set(18, 39, hexc("#e8e8e8")); c.set(18, 40, hexc("#e8e8e8")); c.set(21, 39, hexc("#e8e8e8")); c.set(21, 40, hexc("#e8e8e8"))
        if p.get("accent"):
            c.rect(16, 42, 23, 43, hexc(p["accent"]))
    elif outfit == "cardigan":
        c.rect(17, 36, 22, 53, hexc(p.get("inner", "#f4efe6")))
        c.rect(16, 36, 16, 53, top_d); c.rect(23, 36, 23, 53, top_d)
        for y in (40, 44, 48):
            c.set(16, y, hexc("#f4d35e"))
    elif outfit == "vest":
        c.rect(12, 36, 27, 53, hexc("#f2f2f2"))
        c.rect(9, 37, 11, 50, hexc("#e2e2e2")); c.rect(28, 37, 30, 50, hexc("#e2e2e2"))
        c.rect(13, 38, 18, 53, top); c.rect(21, 38, 26, 53, top)
        c.set(19, 40, INK); c.set(19, 44, INK); c.set(19, 48, INK)
    elif outfit == "workjacket":
        c.rect(19, 36, 20, 53, top_d)
        c.rect(14, 41, 17, 44, top_d); c.rect(22, 41, 25, 44, top_d)
        c.rect(12, 50, 27, 51, hexc("#c99a3e"))
    elif outfit == "polo":
        c.rect(17, 36, 22, 38, hexc("#ffffff"))
        c.rect(19, 38, 20, 42, top_d)
        c.set(19, 39, hexc("#ffffff")); c.set(19, 41, hexc("#ffffff"))
    elif outfit == "blazer":
        c.rect(17, 36, 22, 50, hexc(p.get("inner", "#ffffff")))
        c.rect(15, 37, 17, 53, shade(top, 0.9)); c.rect(22, 37, 24, 53, shade(top, 0.9))
        c.set(16, 46, hexc("#f4d35e"))
    elif outfit == "jacket":
        c.rect(18, 36, 21, 53, hexc(p.get("inner", "#222222")))
        c.rect(12, 46, 14, 47, top_d); c.rect(25, 46, 27, 47, top_d)
        c.rect(15, 36, 17, 40, shade(top, 1.15)); c.rect(22, 36, 24, 40, shade(top, 1.15))
    elif outfit == "sweater":
        c.rect(12, 50, 27, 53, top_d)
        for x in range(13, 27, 3):
            c.rect(x, 42, x, 43, shade(top, 1.2))

    # --- cabeca ------------------------------------------------------------
    c.ellipse(20, 23, 10.5, 11, skin)
    c.rect(11, 25, 29, 30, skin)
    c.ellipse(20, 30, 8, 4, skin)
    c.rect(10, 23, 10, 27, skin_d); c.rect(30, 23, 30, 27, skin_d)  # orelhas
    # olhos
    for ex in (15, 24):
        c.rect(ex, 23, ex + 1, 26, eye)
        c.set(ex, 23, hexc("#ffffff"))
    # sobrancelhas
    c.rect(14, 21, 16, 21, hair_d); c.rect(23, 21, 25, 21, hair_d)
    # bochechas e boca
    c.set(13, 28, hexc("#f2a0a0", 160)); c.set(26, 28, hexc("#f2a0a0", 160))
    c.rect(19, 30, 21, 30, shade(skin, 0.6))
    if p.get("beard"):
        c.rect(13, 28, 26, 33, hair); c.rect(18, 30, 22, 31, shade(skin, 0.7))
        c.rect(15, 33, 24, 34, hair)

    # --- cabelo frente -------------------------------------------------
    if style == "short":
        c.ellipse(20, 15, 11, 7, hair); c.rect(9, 14, 11, 22, hair); c.rect(28, 14, 30, 22, hair)
        c.rect(12, 17, 27, 19, hair); c.rect(13, 13, 18, 14, hair_l)
    elif style == "slick":
        c.ellipse(20, 15, 11, 6.5, hair); c.rect(9, 15, 11, 21, hair); c.rect(28, 15, 30, 21, hair)
        c.rect(11, 17, 22, 19, hair); c.rect(15, 12, 24, 13, hair_l)
    elif style == "messy":
        c.ellipse(20, 15, 11.5, 7.5, hair)
        for (x, y) in [(10, 11), (14, 8), (19, 7), (24, 8), (29, 11), (31, 15), (8, 15)]:
            c.ellipse(x, y, 2.5, 2.5, hair)
        c.rect(12, 17, 28, 19, hair); c.rect(9, 15, 11, 22, hair); c.rect(29, 15, 31, 22, hair)
    elif style == "curly":
        for (x, y) in [(11, 15), (15, 11), (20, 10), (25, 11), (29, 15), (13, 19), (27, 19), (20, 14)]:
            c.ellipse(x, y, 4, 4, hair)
        c.ellipse(17, 10, 2, 2, hair_l)
    elif style in ("long", "long_straight"):
        c.ellipse(20, 15, 11, 7, hair); c.rect(9, 15, 11, 30, hair); c.rect(28, 15, 30, 30, hair)
        if style == "long":
            c.rect(12, 17, 19, 20, hair)  # franja lateral
        else:
            c.rect(12, 17, 27, 18, hair)
        c.rect(14, 12, 20, 13, hair_l)
    elif style == "curly_long":
        for (x, y) in [(11, 14), (15, 11), (20, 10), (25, 11), (29, 14), (12, 19), (28, 19)]:
            c.ellipse(x, y, 4.2, 4.2, hair)
    elif style == "bun":
        c.ellipse(20, 15, 11, 6.5, hair); c.rect(9, 15, 11, 22, hair); c.rect(28, 15, 30, 22, hair)
        c.rect(12, 17, 27, 18, hair)
    elif style == "quiff":
        c.ellipse(20, 15, 11, 6, hair); c.ellipse(17, 10, 6, 4, hair); c.ellipse(16, 9, 3, 2, hair_l)
        c.rect(9, 15, 11, 21, hair); c.rect(28, 15, 30, 21, hair); c.rect(12, 17, 26, 18, hair)
    elif style == "buzz":
        c.ellipse(20, 15, 10.5, 6, hair); c.rect(10, 15, 11, 20, hair); c.rect(28, 15, 29, 20, hair)

    # --- acessorios ------------------------------------------------------
    acc = p.get("acc", [])
    if "glasses" in acc:
        g = hexc(p.get("glasses", "#1a1420"))
        for ex in (13, 22):
            c.rect(ex, 22, ex + 4, 22, g); c.rect(ex, 27, ex + 4, 27, g)
            c.rect(ex, 22, ex, 27, g); c.rect(ex + 4, 22, ex + 4, 27, g)
        c.rect(18, 23, 21, 23, g)
    if "sunglasses" in acc:
        c.rect(13, 22, 18, 26, INK); c.rect(22, 22, 27, 26, INK); c.rect(18, 23, 22, 23, INK)
        c.set(14, 23, hexc("#5cd0ff")); c.set(23, 23, hexc("#5cd0ff"))
    if "cap" in acc:
        capc = hexc(p.get("capcolor", "#2f6f4e"))
        c.ellipse(20, 13, 11, 5.5, capc); c.rect(9, 13, 31, 17, capc)
        c.rect(5, 17, 22, 18, shade(capc, 0.75)); c.set(20, 9, shade(capc, 1.3))
    if "beret" in acc:
        b = hexc(p.get("beretcolor", "#7b4bd6"))
        c.ellipse(19, 11, 11, 4.5, b); c.set(19, 6, b); c.rect(10, 13, 28, 14, shade(b, 0.8))
    if "headset" in acc:
        hs = hexc("#2b2f3a")
        c.rect(9, 10, 31, 11, hs); c.rect(8, 11, 9, 24, hs); c.rect(31, 11, 32, 24, hs)
        c.rect(7, 20, 10, 26, hs); c.rect(30, 20, 33, 26, hs)
        c.rect(10, 26, 14, 27, hs); c.set(15, 27, hexc("#3ddc97"))
    if "pen" in acc:
        c.rect(29, 15, 30, 21, hexc("#ffd25c")); c.set(29, 21, INK)
    if "earrings" in acc:
        c.set(10, 29, hexc("#ffd25c")); c.set(30, 29, hexc("#ffd25c"))
    if "badge" in acc:
        c.rect(23, 41, 25, 43, hexc(p.get("badge", "#5b8cff")))
    if "scarf" in acc:
        sc = hexc(p.get("scarfcolor", "#e05a6a"))
        c.rect(14, 34, 25, 37, sc); c.rect(15, 38, 17, 44, sc)

    c.outline(INK)
    return c.image()


def robot(p):
    c = Canvas()
    body = hexc("#d9e1ee"); body_d = hexc("#aab6c8"); acc = hexc(p["accent"]); scr = hexc("#0b1220")
    # rodas / base
    c.ellipse(20, 72, 9, 3.5, hexc("#3a4560")); c.rect(13, 66, 27, 71, hexc("#4a5570"))
    # corpo
    c.rect(11, 40, 28, 65, body); c.rect(11, 40, 13, 65, body_d); c.rect(26, 40, 28, 65, body_d)
    c.rect(15, 45, 24, 54, scr)
    for i, x in enumerate(range(16, 24, 2)):
        c.rect(x, 52 - (i % 3) * 2, x, 53, acc)
    c.rect(17, 58, 22, 59, acc)
    # bracos
    c.rect(6, 42, 9, 58, body_d); c.rect(30, 42, 33, 58, body_d)
    c.ellipse(7.5, 60, 2.5, 2.5, acc); c.ellipse(31.5, 60, 2.5, 2.5, acc)
    # pescoco
    c.rect(17, 36, 22, 39, hexc("#8a94a8"))
    # cabeca
    c.rect(8, 14, 31, 35, body); c.rect(8, 14, 9, 35, body_d); c.rect(30, 14, 31, 35, body_d)
    c.rect(11, 18, 28, 31, scr)
    c.rect(14, 22, 17, 25, acc); c.rect(22, 22, 25, 25, acc)
    c.rect(16, 28, 23, 28, acc)
    # antena
    c.rect(19, 6, 20, 13, hexc("#8a94a8")); c.ellipse(19.5, 5, 2.5, 2.5, acc)
    # orelhas
    c.rect(5, 20, 7, 28, body_d); c.rect(32, 20, 34, 28, body_d)
    c.outline(INK)
    return c.image()


PEOPLE = {
    "opera": dict(skin="#f1d3b3", hair="#2b1d14", hairstyle="slick", top="#2b3f73", outfit="suit", tie="#5b8cff", pants="#22304f", acc=["badge"], badge="#c4b2ff"),
    "mag": dict(skin="#f0c8a0", hair="#121212", hairstyle="messy", top="#2d2a3e", outfit="hoodie", accent="#8b7bff", acc=["glasses"], beard=True, pants="#1f2433"),
    "luna": dict(skin="#e8b98f", hair="#c45a88", hairstyle="long", top="#ff8fb1", outfit="cardigan", inner="#fff4e8", acc=["beret", "earrings"], beretcolor="#6b3fa0", pants="#3a4a7a"),
    "nexus": dict(skin="#8d5a3b", hair="#140d09", hairstyle="curly", top="#ff9f3a", outfit="vest", pants="#2b2f3a", acc=["glasses"], glasses="#ffb35c"),
    "atlas": dict(skin="#a86a43", hair="#0e0a08", hairstyle="buzz", top="#2f9e6e", outfit="workjacket", pants="#3a3f4a", acc=["cap"], capcolor="#1f6e4c", shoes="#5a3a22"),
    "orion": dict(skin="#f5d6bf", hair="#e2b84a", hairstyle="short", top="#2ab6e0", outfit="polo", pants="#2b2f3a", acc=["headset"]),
    "aurora": dict(skin="#c98f63", hair="#3a2414", hairstyle="bun", top="#9cc93f", outfit="blazer", inner="#fffbe8", pants="#3d3a2e", acc=["glasses", "earrings"], glasses="#7a4b23"),
    "themis": dict(skin="#f3d9c4", hair="#151021", hairstyle="long_straight", top="#a777d6", outfit="blazer", inner="#ffffff", skirt="#3b2a55", shoes="#2a1d3a", acc=["earrings"]),
    "mercurio": dict(skin="#e8b98f", hair="#5a2d14", hairstyle="quiff", top="#f2c230", outfit="jacket", inner="#1c1c1c", pants="#2b3550", acc=["sunglasses"]),
    "driele": dict(skin="#7a4a2f", hair="#b8432c", hairstyle="curly_long", top="#ff8a6a", outfit="sweater", pants="#3a2e4a", acc=["pen", "scarf"], scarfcolor="#ffd25c"),
}

for name, spec in PEOPLE.items():
    person(spec).save(f"{OUT}/{name}.png")
robot({"accent": "#3fd0ff"}).save(f"{OUT}/flow.png")
print("ok", len(PEOPLE) + 1)
