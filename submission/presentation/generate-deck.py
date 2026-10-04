#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mawzun submission deck — Arabic RTL slides rendered with Pillow + libraqm,
assembled into submission/presentation/mawzun-deck.pdf.

Rules implemented (from the arabic-slide-generation-pillow skill):
  * every Latin run inside Arabic prose is wrapped in LRI/PDI before measuring/drawing;
  * text is measured with textlength(direction=..., language="ar") and fit() shrinks
    from hi to lo until BOTH width and height fit the target box;
  * per-line baselines with anchor="rs" (RTL) / "ls" (LTR), advance = 1.5*size;
  * every drawn region is registered and three counted assertions are printed:
    overflow, bounds violations, overlap, and RTL order for mirrored rows.
"""
import os, re
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------------------- geometry
W, H = 1920, 1080
FONTS = "/root/.hermes/workspaces/slide-gen/fonts"
OUTDIR = os.path.dirname(os.path.abspath(__file__))
SLIDEDIR = os.path.join(OUTDIR, "slides")
os.makedirs(SLIDEDIR, exist_ok=True)

FEATURES = ["kern", "liga", "calt"]
LRI, PDI = "\u2066", "\u2069"
ARABIC = re.compile(r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]")

RUNSET = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
RUNSET |= set("@#%&+*()[]{}<>\"'~=/_.,:;|$-")
RUN = re.compile("[" + re.escape("".join(sorted(RUNSET))) + "]+")

# ----------------------------------------------------------------------------- palette
BG        = "#f8f9ff"
LOW       = "#eff4ff"
WHITE     = "#ffffff"
PRIMARY   = "#091426"
PCONT     = "#1e293b"
SECONDARY = "#0058be"
OUTLINE   = "#c5c6cd"
ON        = "#0b1c30"
ONVAR     = "#45474c"
GREEN     = "#85f8c4"
GREEN_INK = "#00301f"
ERROR     = "#ba1a1a"
ERROR_BG  = "#ffdad6"
ERROR_INK = "#93000a"
RULE_BG   = "#dce9ff"
AMBER_BG  = "#fff0d6"
AMBER_INK = "#5c3d00"

FONT_FILES = {
    "black": f"{FONTS}/Cairo-Black.ttf",
    "bold":  f"{FONTS}/Cairo-Bold.ttf",
    "semi":  f"{FONTS}/Cairo-SemiBold.ttf",
    "reg":   f"{FONTS}/Cairo-Regular.ttf",
    "mono":  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "monob": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
}

@lru_cache(maxsize=None)
def F(role, size):
    return ImageFont.truetype(FONT_FILES[role], size)


def has_arabic(s):
    return bool(ARABIC.search(s))


# ----------------------------------------------------------------------------- bidi isolation
def isolate_pieces(s):
    """Split s into ('plain', txt) / ('island', LRI+txt+PDI) preserving order."""
    s = re.sub(r"(?<=[\u0620-\u064A])و(?=[A-Za-z])", "و ", s)
    spans = [[m.start(), m.end()] for m in RUN.finditer(s)]
    merged = []
    for a, b in spans:
        if merged:
            pa, pb = merged[-1]
            gap = s[pb:a]
            if gap == " " and (
                re.search(r"[A-Za-z]", s[pa:pb]) or re.search(r"[A-Za-z]", s[a:b])
            ):
                merged[-1][1] = b
                continue
        merged.append([a, b])
    pieces, last = [], 0
    for a, b in merged:
        if last < a:
            pieces.append(("plain", s[last:a]))
        txt = s[a:b]
        lead = 0
        while lead < len(txt) and txt[lead] in "»،;:":
            lead += 1
        trail = len(txt)
        while trail > lead and txt[trail - 1] in "»،;:":
            trail -= 1
        if trail <= lead:
            pieces.append(("plain", txt))
        else:
            if lead:
                pieces.append(("plain", txt[:lead]))
            pieces.append(("island", LRI + txt[lead:trail] + PDI))
            if trail < len(txt):
                pieces.append(("plain", txt[trail:]))
        last = b
    if last < len(s):
        pieces.append(("plain", s[last:]))
    return pieces


def make_atoms(s):
    atoms = []
    for kind, txt in isolate_pieces(s):
        if kind == "island":
            atoms.append(txt)
        else:
            for w in txt.split(" "):
                if w:
                    atoms.append(w)
    return atoms


def rtl_text(s):
    return "".join(t for _, t in isolate_pieces(s))


# ----------------------------------------------------------------------------- measure / fit
ISSUES = {"overflow": [], "bounds": [], "overlap": [], "rtl": []}
_current = None


def measure(draw, s, font, direction):
    return draw.textlength(s, font=font, direction=direction, language="ar", features=FEATURES)


def wrap_atoms(draw, atoms, font, max_w, direction):
    lines, cur = [], []
    for a in atoms:
        trial = " ".join(cur + [a]) if cur else a
        if cur and measure(draw, trial, font, direction) > max_w:
            lines.append(" ".join(cur))
            cur = [a]
        else:
            cur.append(a)
    if cur:
        lines.append(" ".join(cur))
    return lines


def block(draw, text, role, x0, y0, x1, y1, color, align="right", valign="top",
          hi=40, lo=16, lf=1.5, mono=False, name=None, fit_issues=True):
    """Fit text into (x0,y0,x1,y1); draw per-line; return bbox."""
    if mono:
        direction = "ltr"
        atoms = [text]
    elif not has_arabic(text):
        direction = "ltr"
        atoms = make_atoms(text)
    else:
        direction = "rtl"
        atoms = make_atoms(text)

    max_w, max_h = x1 - x0, y1 - y0
    chosen = None
    size = hi
    while size >= lo:
        f = F(role, size)
        lines = wrap_atoms(draw, atoms, f, max_w, direction)
        asc, desc = f.getmetrics()
        adv = max(int(size * lf), 1)
        bh = (len(lines) - 1) * adv + asc + desc
        mw = max(measure(draw, l, f, direction) for l in lines)
        if mw <= max_w and bh <= max_h:
            chosen = (size, f, lines, adv, asc, desc, bh, mw)
            break
        size -= 2
    if chosen is None:
        size = lo
        f = F(role, size)
        lines = wrap_atoms(draw, atoms, f, max_w, direction)
        asc, desc = f.getmetrics()
        adv = max(int(size * lf), 1)
        bh = (len(lines) - 1) * adv + asc + desc
        mw = max(measure(draw, l, f, direction) for l in lines)
        chosen = (size, f, lines, adv, asc, desc, bh, mw)
        if fit_issues and (mw > max_w or bh > max_h) and _current is not None:
            ISSUES["overflow"].append(f"{_current}:{name or 'blk'} need w{mw:.0f}/h{bh:.0f} box w{max_w}/h{max_h}")

    size, f, lines, adv, asc, desc, bh, mw = chosen
    if align == "right":
        x = x1
        anchor = "rs"
        bx0, bx1 = x1 - mw, x1
    else:
        x = x0
        anchor = "ls"
        bx0, bx1 = x0, x0 + mw
    if valign == "mid":
        top = y0 + (max_h - bh) // 2
    elif valign == "bottom":
        top = y1 - bh
    else:
        top = y0
    for i, l in enumerate(lines):
        yy = top + asc + i * adv
        draw.text((x, yy), l, font=f, fill=color, anchor=anchor,
                  direction=direction, language="ar", features=FEATURES)
    return (bx0, top, bx1, top + bh)


def box(draw, x0, y0, x1, y1, fill=None, outline=None, width=2, radius=18):
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill,
                           outline=outline, width=width)


def hline(draw, x0, x1, y, color, width=2):
    draw.line([x0, y, x1, y], fill=color, width=width)


# ----------------------------------------------------------------------------- per-slide register
REG = []


def reg(name, b):
    REG.append((name, b))
    return b


def check_slide(num):
    """Return (overlaps, bounds) for the regions registered for this slide.

    A container and its own children legitimately intersect, so a pair is skipped
    when one registered name is a prefix of the other (the nested-content
    convention used by `card`: container `rec` -> children `rec_h`, `rec_dig`...).
    """
    overlaps, bounds = [], []
    for i in range(len(REG)):
        n1, b1 = REG[i]
        for j in range(i + 1, len(REG)):
            n2, b2 = REG[j]
            if n1.startswith(n2) or n2.startswith(n1):
                continue
            ox = min(b1[2], b2[2]) - max(b1[0], b2[0])
            oy = min(b1[3], b2[3]) - max(b1[1], b2[1])
            if ox > 2 and oy > 2:
                overlaps.append(f"{num}:{n1}~{n2} x{ox:.0f} y{oy:.0f}")
        if b1[0] < 24 or b1[1] < 24 or b1[2] > W - 24 or b1[3] > H - 24:
            bounds.append(f"{num}:{n1} {tuple(round(v) for v in b1)}")
    ISSUES["overlap"].extend(overlaps)
    ISSUES["bounds"].extend(bounds)
    return overlaps, bounds


# ----------------------------------------------------------------------------- chrome
def new_slide():
    img = Image.new("RGB", (W, H), BG)
    return img, ImageDraw.Draw(img)


def chrome(img, draw, num, title, kicker="موزون | مقياس أمانة النقل"):
    global _current, REG
    _current = f"s{num:02d}"
    REG = []
    d = draw
    box(d, 30, 30, W - 30, H - 30, fill=None, outline=OUTLINE, width=2, radius=30)
    # top-right kicker + page number left
    reg("kicker", block(d, kicker, "semi", 1050, 66, W - 62, 108, ONVAR,
                        align="right", hi=24, lo=18, name="kicker"))
    reg("pageno", block(d, f"{num:02d} / 11", "mono", 62, 70, 260, 104, OUTLINE,
                        align="left", hi=22, lo=18, mono=True, name="pageno"))
    tb = reg("title", block(d, title, "black", 260, 130, W - 62, 236, PRIMARY,
                            align="right", hi=62, lo=36, name="title"))
    hline(d, 62, W - 62, 258, RULE_BG, 3)
    # footer
    hline(d, 62, W - 62, 992, RULE_BG, 2)
    reg("foot_r", block(d, "مقياس أمانة النقل بين النص الشرعي الأصلي والنص المشتق", "reg",
                        760, 1000, W - 62, 1036, ONVAR, align="right", hi=20, lo=16, name="foot_r"))
    reg("foot_l", block(d, "هاكاثون الذكاء الاصطناعي — المسار الثاني", "reg",
                        62, 1000, 740, 1036, ONVAR, align="left", hi=20, lo=16, name="foot_l"))
    return tb


def card(draw, x0, y0, x1, y1, fill=LOW, outline=OUTLINE, radius=18, width=2, name=None):
    box(draw, x0, y0, x1, y1, fill=fill, outline=outline, width=width, radius=radius)
    return reg(name or "card", (x0, y0, x1, y1))


def chip(draw, text, x_right, y0, h, size=26, fill=LOW, ink=PRIMARY, outline=None,
         padx=34, mono=False, role="semi"):
    f = F("mono" if mono else role, size)
    tw = measure(draw, rtl_text(text), f, "ltr" if mono or not has_arabic(text) else "rtl")
    w = tw + 2 * padx
    x0 = x_right - w
    box(draw, x0, y0, x_right, y0 + h, fill=fill, outline=outline, width=2, radius=h // 2)
    tt = text if not (mono or not has_arabic(text)) else rtl_text(text)
    draw.text(((x0 + x_right) / 2, y0 + h / 2), tt, font=f, fill=ink, anchor="mm",
              direction="ltr" if (mono or not has_arabic(text)) else "rtl",
              language="ar", features=FEATURES)
    return (x0, y0, x_right, y0 + h), f


def arrow_left(draw, x_from, x_to, y, color):
    draw.line([x_from, y, x_to + 26, y], fill=color, width=4)
    draw.polygon([(x_to, y), (x_to + 26, y - 13), (x_to + 26, y + 13)], fill=color)


# ============================================================================= SLIDES
def slide01(img, d):
    chrome(img, d, 1, "موزون | مقياس أمانة النقل", kicker="عرض تقديمي أمام لجنة التحكيم")
    # claim
    reg("claim", block(d, "قد تكون الترجمة سليمة نحواً وبلاغة، ومع ذلك تخون المعنى؛ "
                          "موزون يقيس أمانة النقل بين نص شرعي أصلي ونص مشتق.",
                       "bold", 150, 300, 1770, 470, ON, align="right", hi=52, lo=30, name="claim"))
    # track banner
    card(d, 150, 505, 1770, 625, fill=PCONT, outline=PCONT, name="track")
    reg("track_t", block(d, "المسار الثاني: صناعة المحتوى متعدد اللغات والتوطين الثقافي",
                         "black", 200, 520, 1720, 610, WHITE, align="right", hi=44, lo=28, name="track_t"))
    # three keywords
    kw = ["حكم واحد بثلاث حالات", "سبب وموضع ودليل", "سجل SHA-256 يعيد إنتاج الحكم"]
    xs = [1770, 1180, 590]
    for i, (k, xr) in enumerate(zip(kw, xs)):
        card(d, xr - 540, 690, xr, 810, fill=LOW, outline=OUTLINE, name=f"kw{i}")
        reg(f"kw{i}t", block(d, k, "semi", xr - 510, 706, xr - 30, 794, PCONT,
                             align="right", hi=30, lo=20, name=f"kw{i}t"))
    reg("live", block(d, "https://mawzun-project.hoysamax.workers.dev", "mono",
                      150, 858, 1770, 902, SECONDARY, align="right", hi=28, lo=20, mono=True, name="live"))


def slide02(img, d):
    chrome(img, d, 2, "المشكلة: اللغة سليمة والمعنى مُنزاح")
    reg("sub", block(d, "ترجمة سليمة نحواً وبلاغة قد تغيّر قوة الحكم من حظر إلى أولوية، "
                        "فلا يرصدها أي مدقّق لغوي.",
                     "reg", 400, 288, 1858, 366, ONVAR, align="right", hi=34, lo=22, name="sub"))
    # right panel = original
    card(d, 1075, 400, 1830, 830, fill=LOW, outline=SECONDARY, width=3, name="p_src")
    reg("p_src_l", block(d, "النص الأصلي", "semi", 1110, 422, 1795, 468, SECONDARY,
                         align="right", hi=30, lo=22, name="p_src_l"))
    reg("p_src_b", block(d, "«لا يجوز بيع الطعام قبل قبضه.»", "bold",
                         1110, 500, 1795, 640, ON, align="right", hi=46, lo=30, name="p_src_b"))
    card(d, 1110, 690, 1795, 780, fill=ERROR_BG, outline=ERROR, name="p_src_f")
    reg("p_src_f_t", block(d, "القوة: منع — ملزم", "bold", 1140, 706, 1765, 764, ERROR_INK,
                           align="right", hi=34, lo=24, name="p_src_f_t"))
    # left panel = derived
    card(d, 90, 400, 845, 830, fill=LOW, outline=ERROR, width=3, name="p_dev")
    reg("p_dev_l", block(d, "الترجمة المشتقة", "semi", 125, 422, 810, 468, ERROR,
                         align="right", hi=30, lo=22, name="p_dev_l"))
    reg("p_dev_b", block(d, "It is not recommended to sell food before taking possession.",
                         "bold", 125, 500, 810, 640, ON, align="right", hi=42, lo=24, name="p_dev_b"))
    card(d, 125, 690, 810, 780, fill=ERROR_BG, outline=ERROR, name="p_dev_f")
    reg("p_dev_f_t", block(d, "القوة: كراهة — غير ملزم", "bold", 155, 706, 780, 764, ERROR_INK,
                           align="right", hi=34, lo=24, name="p_dev_f_t"))
    # center arrow
    arrow_left(d, 1050, 905, 560, ERROR)
    reg("arrow", block(d, "انزياح في قوة الحكم", "bold", 858, 470, 1050, 640, ERROR,
                       align="right", hi=28, lo=20, name="arrow"))
    reg("note", block(d, "الجملة تمرّ من كل مدقّق نحوي وإملائي: الخطأ ليس في اللغة، بل في أمانة النقل.",
                      "reg", 150, 862, 1858, 920, ONVAR, align="right", hi=28, lo=20, name="note"))


def slide03(img, d):
    chrome(img, d, 3, "لماذا لا يلتقطه أحد؟")
    cards = [
        ("المدقّق اللغوي", "يرى جملة سليمة فيتوقف عند حدود النحو والإملاء والبلاغة، "
                           "ولا يسأل عن معنى الحكم."),
        ("أدوات الترجمة", "تقيس الجودة العامة — طلاقة وتشابهًا — لا أمانة المعنى الشرعي "
                          "ولا قوة الحكم."),
        ("المراجع البشري", "دقيق لكنه بطيء وغير متسق بين المراجعين، ولا يستطيع قياس "
                           "الانزياح على كل نص."),
    ]
    xr = [1830, 1213, 596]
    boxes = []
    for i, (h, b) in enumerate(cards):
        x0 = xr[i] - 540
        boxes.append(card(d, x0, 340, xr[i], 800, fill=LOW, outline=OUTLINE, name=f"c{i}"))
        reg(f"c{i}h", block(d, h, "black", x0 + 30, 372, xr[i] - 30, 442, PRIMARY,
                            align="right", hi=40, lo=26, name=f"c{i}h"))
        hline(d, x0 + 30, xr[i] - 30, 462, RULE_BG, 2)
        reg(f"c{i}b", block(d, b, "reg", x0 + 30, 486, xr[i] - 30, 770, ONVAR,
                            align="right", hi=30, lo=18, name=f"c{i}b"))
    # RTL order assertion: rightmost card starts at or right of the next card's end
    for a, b in ((0, 1), (1, 2)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            ISSUES["rtl"].append(f"s03 card order c{a}/c{b} inverted")
    reg("s03_res", block(d, "النتيجة: انزياح في قوة الحكم يمرّ من كل بوابة، ولا أحد يقيسه.",
                         "bold", 150, 840, 1858, 912, SECONDARY,
                         align="right", hi=36, lo=24, name="s03_res"))


def slide04(img, d):
    chrome(img, d, 4, "ما هو موزون — وما ليس هو")
    card(d, 90, 300, 930, 760, fill=WHITE, outline=SECONDARY, width=3, name="is")
    reg("is_h", block(d, "هو: مقياس أمانة نقل", "black", 130, 330, 890, 402, SECONDARY,
                      align="right", hi=42, lo=28, name="is_h"))
    reg("is_b", block(d, "يقارن المعنى بين نص شرعي أصلي ونص مشتق (ترجمة / تلخيص / إعادة صياغة)، "
                         "ويُصدر حكمًا واحدًا بثلاث حالات، مع السبب والموضع والدليل. "
                         "وهو أداة قرار للمراجع البشري تُوجّه نظره إلى الموضع الذي يستحق وقته.",
                      "reg", 130, 420, 890, 700, ON, align="right", hi=32, lo=20, name="is_b"))
    card(d, 990, 300, 1830, 760, fill=ERROR_BG, outline=ERROR, width=3, name="not")
    reg("not_h", block(d, "ما ليس هو", "black", 1030, 330, 1790, 402, ERROR_INK,
                       align="right", hi=42, lo=28, name="not_h"))
    reg("not_b", block(d, "لا يُفتي.  لا يُرجّح مذهبًا.  لا يحكم على صحة رأي.  "
                          "وليس مدقّقًا لغويًا ولا نحويًا: سلامة اللغة عنده شرط لازم لا كافٍ.",
                       "bold", 1030, 420, 1790, 700, ERROR_INK, align="right", hi=38, lo=24, name="not_b"))
    card(d, 90, 790, 1830, 940, fill=GREEN, outline=GREEN_INK, name="abst")
    reg("abst_h", block(d, "الوقف نتيجة معتبرة لا فشل", "black", 120, 812, 1800, 876, GREEN_INK,
                        align="right", hi=38, lo=26, name="abst_h"))
    reg("abst_b", block(d, "«وقف وتحويل» حالة صريحةٌ كاملة يُعلنها النظام عند الشك أو عند "
                           "مستوى المحتوى (د)، لا خطأ تشغيليًا.",
                        "semi", 120, 878, 1800, 928, GREEN_INK, align="right", hi=28, lo=20, name="abst_b"))


def slide05(img, d):
    chrome(img, d, 5, "آلية العمل: أربعة مدخلات، ثلاث طبقات، حكم واحد")
    # inputs row (RTL): 4 chips
    ins = ["النص الأصلي", "النص المشتق", "نوع العمل: ترجمة / تلخيص / إعادة صياغة",
           "مستوى المحتوى: أ · ب · ج · د"]
    xr = 1858
    for i, t in enumerate(ins):
        b, _ = chip(d, t, xr, 292, 62, size=24, fill=LOW, ink=PRIMARY, outline=OUTLINE)
        reg(f"in{i}", b)
        xr = b[0] - 16
    # layers flow RTL
    layers = [
        ("الطبقة 1 — حتمية",
         "أرقام وإحالات ودرجة ثبوت، ومطابقة حرفية للاقتباس القرآني على نص المصحف المعتمد، مع استشهاد بالآية. بلا نموذج."),
        ("الطبقة 2 — معجمية", "قاموس المصطلحات، جدول قوة الحكم، وعلامات الشرط — بحثًا في جداول."),
        ("الطبقة 3 — دلالية", "نموذج يُنتج وقائع لا أحكامًا؛ وكل اقتباس متحقَّق حرفيًا."),
    ]
    xr = 1858
    ends = []
    for i, (h, b) in enumerate(layers):
        x0 = xr - 545
        card(d, x0, 410, xr, 700, fill=PCONT, outline=PCONT, name=f"L{i}")
        reg(f"L{i}h", block(d, h, "black", x0 + 28, 440, xr - 28, 512, WHITE,
                            align="right", hi=38, lo=24, name=f"L{i}h"))
        hline(d, x0 + 28, xr - 28, 532, "#4a5568", 2)
        reg(f"L{i}b", block(d, b, "reg", x0 + 28, 556, xr - 28, 676, "#c8d2e5",
                            align="right", hi=28, lo=18, name=f"L{i}b"))
        ends.append((x0, xr))
        if i < 2:
            arrow_left(d, x0 - 8, x0 - 52, 555, SECONDARY)
        xr = x0 - 78
    if not (ends[0][0] >= ends[1][1] and ends[1][0] >= ends[2][1]):
        ISSUES["rtl"].append("s05 layer flow not right-to-left")
    # verdict band
    reg("v_h", block(d, "الحكم: واحد بثلاث حالات، ومرفقٌ دائمًا بالسبب والموضع والدليل",
                     "semi", 150, 740, 1858, 800, PRIMARY, align="right", hi=32, lo=22, name="v_h"))
    states = [("مطابق", GREEN, GREEN_INK), ("يحتاج تعديل", AMBER_BG, AMBER_INK),
              ("وقف وتحويل", ERROR_BG, ERROR_INK)]
    xr = 1858
    for i, (t, fill, ink) in enumerate(states):
        b, _ = chip(d, t, xr, 830, 70, size=30, fill=fill, ink=ink, outline=OUTLINE, role="bold")
        reg(f"st{i}", b)
        xr = b[0] - 20
    reg("v_note", block(d, "مستوى (د) يتوقف ويحيل ولا يُحكم فيه آليًا؛ والطبقة الدلالية غيابها يُعلَن، لا يُمرَّر.",
                        "reg", 150, 916, 1858, 966, ONVAR, align="right", hi=26, lo=18, name="v_note"))


def slide06(img, d):
    chrome(img, d, 6, "الأدلة: محرك مُتحقَّق منه وسجل قابل لإعادة التشغيل")
    # engine card (right)
    card(d, 970, 300, 1858, 700, fill=WHITE, outline=SECONDARY, width=3, name="eng")
    reg("eng_h", block(d, "التحقق من المحرك", "semi", 1010, 326, 1818, 380, SECONDARY,
                       align="right", hi=34, lo=24, name="eng_h"))
    reg("eng_big", block(d, "28/28 checks passed", "black", 1010, 396, 1818, 480, GREEN_INK,
                         align="right", hi=52, lo=30, name="eng_big"))
    reg("eng_cmd", block(d, "bun run engine:check", "mono", 1010, 496, 1818, 540, PRIMARY,
                         align="right", hi=28, lo=20, mono=True, name="eng_cmd"))
    reg("eng_note", block(d, "ثمانية سيناريوهات: مستويات المحتوى الأربعة، ونموذج مدسوس يُرفض "
                          "حين يخترع موضعًا، وسيناريو إعادة تشغيل يثبت أن حذف الانزياح يغيّر الحكم.",
                      "reg", 1010, 556, 1818, 676, ONVAR, align="right", hi=28, lo=18, name="eng_note"))
    # record card (left)
    card(d, 90, 300, 940, 700, fill=LOW, outline=OUTLINE, name="rec")
    reg("rec_h", block(d, "السجل المختوم", "semi", 120, 326, 910, 380, PRIMARY,
                       align="right", hi=34, lo=24, name="rec_h"))
    reg("rec_d1", block(d, "بصمة SHA-256 لسجل حقيقي (سيناريو: لا يجوز ← not recommended):",
                        "reg", 120, 392, 910, 440, ONVAR, align="right", hi=26, lo=18, name="rec_d1"))
    dig = "e02880eec6b08a303fa64a8acc387e653373d93835a39e84e928c613e685ad20"
    reg("rec_dig", block(d, dig[:32] + " " + dig[32:], "mono", 120, 448, 910, 520, PRIMARY,
                         align="right", hi=30, lo=20, mono=True, name="rec_dig"))
    reg("rec_f", block(d, "نسخة بنك القيود: 1.0.0   ·   معرّف النموذج: يُثبَّت في السجل عند تشغيل "
                          "الطبقة الدلالية، وفي تشغيل بلا نموذج يُسجَّل null صراحةً.",
                       "reg", 120, 540, 910, 632, ONVAR, align="right", hi=26, lo=18, name="rec_f"))
    reg("rec_r", block(d, "إعادة تشغيل السجل تُعيد إنتاج الحكم نفسه.", "semi",
                       120, 640, 910, 688, GREEN_INK, align="right", hi=28, lo=20, name="rec_r"))
    # model chain + placeholder
    reg("mc", block(d, "المسار الحيّ يجرّب نموذجين على الترتيب: @cf/google/gemma-4-26b-a4b-it "
                       "ثم @cf/meta/llama-3.3-70b-instruct-fp8-fast.",
                    "reg", 150, 716, 1858, 796, ONVAR, align="right", hi=26, lo=18, name="mc"))
    # benchmark results — the numbers come from data/benchmark/results.json, the
    # output of `bun run benchmark` over the sealed corpus. Nothing here is an
    # estimate: the corpus, the runner and the raw results are all in the repo.
    card(d, 90, 812, 1858, 950, fill=GREEN, outline=GREEN_INK, width=3, name="bm")
    reg("bm_h", block(d, "قياس أمانة النقل — تحقيق النفع بمعيار المسار (وزنه ٢٠٪)", "black",
                      120, 826, 1828, 878, GREEN_INK, align="right", hi=32, lo=22, name="bm_h"))
    reg("bm_b", block(d, "٣٧ زوجًا معنونًا: كُشف الانزياح في ٢١ من ٢١ ولم تُفت حالة واحدة، "
                         "ووقف وتحويل ٤ من ٤، وإنذار كاذب واحد من ١٢ زوجًا سليمًا. "
                         "الأمر: bun run benchmark",
                      "reg", 120, 884, 1828, 938, GREEN_INK, align="right", hi=26, lo=16, name="bm_b"))


def slide07(img, d):
    chrome(img, d, 7, "القيمة المضافة: مقارنة ببدائل مُسمّاة")
    cols = [
        ("بديل 1 — مدقّق لغوي سطحي", "يتحقق من النحو والإملاء والبلاغة. "
                                     "لا يراه: تغيّر قوة الحكم. على مثالنا: «لا يجوز ← not recommended» يمرّ سليمًا.",
         LOW, OUTLINE, ONVAR),
        ("بديل 2 — أداة جودة ترجمة عامة", "تقيس الجودة العامة (طلاقة / تشابه) ولا تسأل: هل بقي الحكم ملزمًا؟ "
                                          "ولا تُصدر موضعًا ولا دليلًا ولا وقفًا.",
         LOW, OUTLINE, ONVAR),
        ("موزون", "يرصد الانزياح في قوة الحكم، ويُصدر حكمًا واحدًا بموضع ودليل، "
                  "ويتوقف ويحيل عند الشك.", GREEN, GREEN_INK, GREEN_INK),
    ]
    xr = [1830, 1213, 596]
    boxes = []
    for i, (h, b, fill, ink, bink) in enumerate(cols):
        x0 = xr[i] - 540
        boxes.append(card(d, x0, 320, xr[i], 720, fill=fill, outline=ink, width=3, name=f"v{i}"))
        reg(f"v{i}h", block(d, h, "black", x0 + 28, 350, xr[i] - 28, 420, bink,
                            align="right", hi=36, lo=22, name=f"v{i}h"))
        hline(d, x0 + 28, xr[i] - 28, 440, OUTLINE if i < 2 else GREEN_INK, 2)
        reg(f"v{i}b", block(d, b, "reg", x0 + 28, 466, xr[i] - 28, 692, bink,
                            align="right", hi=30, lo=18, name=f"v{i}b"))
    for a, b in ((0, 1), (1, 2)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            ISSUES["rtl"].append(f"s07 column order v{a}/v{b} inverted")
    card(d, 90, 760, 1858, 950, fill=WHITE, outline=SECONDARY, width=3, name="bank")
    reg("bank_h", block(d, "الميزة البنيوية: بنك قيود قابل للفحص", "black",
                        120, 782, 1828, 840, SECONDARY, align="right", hi=36, lo=24, name="bank_h"))
    reg("bank_b", block(d, "بنك القيود جدول قابل للفحص: لكل قيد حقل origin يشير إلى موضعه من الحزمة العلمية، "
                           "فيفتحه المراجع ويناقشه ويعدّله — لا رأي نموذج لا يُساءَل.",
                        "reg", 120, 852, 1828, 936, ON, align="right", hi=28, lo=18, name="bank_b"))


def slide08(img, d):
    chrome(img, d, 8, "التقنيات ومصدر البيانات")
    items = [
        ("الحزمة التقنية", "Next.js 16 (App Router) · React 19 · Tailwind CSS 4، "
                           "مبنية لـ Cloudflare Workers عبر OpenNext."),
        ("التشغيل والنموذج", "Cloudflare Workers للتنفيذ، وWorkers AI للطبقة الدلالية "
                             "عبر رابط AI بلا مفتاح API."),
        ("مدير الحزم", "bun فقط: حارس preinstall يمنع npm و yarn و pnpm، "
                       "وملف القفل المرجعي bun.lock وحده."),
        ("مصدر البيانات", "الحزمة العلمية «المرجعية والحزمة العلمية والبيانات»: "
                          "لكل قيد حقل origin يشير إلى موضعه من الحزمة. لا شيء من رأي النظام."),
    ]
    ys = [(310, 470), (490, 650), (670, 830), (850, 970)]
    for i, ((h, b), (y0, y1)) in enumerate(zip(items, ys)):
        card(d, 90, y0, 1858, y1, fill=LOW if i % 2 == 0 else WHITE, outline=OUTLINE, name=f"t{i}")
        reg(f"t{i}h", block(d, h, "black", 1160, y0 + 16, 1828, y1 - 16, SECONDARY,
                            align="right", hi=34, lo=22, name=f"t{i}h"))
        d.line([1150, y0 + 14, 1150, y1 - 14], fill=RULE_BG, width=3)
        reg(f"t{i}b", block(d, b, "reg", 120, y0 + 14, 1130, y1 - 14, ON,
                            align="right", hi=30, lo=18, name=f"t{i}b"))


def slide09(img, d):
    chrome(img, d, 9, "الحدود والصدق: ما يفحصه موزون وما لا يفحصه")
    rows = [
        ("مطابقة النص القرآني — مشروطة بالوصول",
         "تُطابق الآية المقتبسة حرفًا بحرف على نص المصحف المعتمد (حفص)، ويُختم النص المسترجع في السجل فيبقى إعادة التشغيل بلا شبكة. "
         "وإن تعذّر الوصول إلى المصدر أعلن التشغيل الفجوة بدل أن يمرّ صامتًا."),
        ("مصطلح بلا قائمة مقابلات معتمدة",
         "إذا نصّت الحزمة على قاعدته دون قائمة مقابلات معتمدة، يُسجَّل ملاحظة تغطية لا نتيجة."),
        ("الطبقة الدلالية قد تكون غائبة",
         "إذا غاب النموذج تُعلَن الطبقة الدلالية غائبة — ولا تمرّ صامتة — ويظهر ذلك في السجل."),
    ]
    ys = [(300, 470), (490, 660), (680, 850)]
    for i, ((h, b), (y0, y1)) in enumerate(zip(rows, ys)):
        card(d, 90, y0, 1858, y1, fill=ERROR_BG if i == 0 else LOW, outline=ERROR if i == 0 else OUTLINE,
             width=3 if i == 0 else 2, name=f"l{i}")
        reg(f"l{i}h", block(d, h, "bold", 120, y0 + 16, 1828, y0 + 78,
                            ERROR_INK if i == 0 else PRIMARY, align="right", hi=34, lo=22, name=f"l{i}h"))
        reg(f"l{i}b", block(d, b, "reg", 120, y0 + 84, 1828, y1 - 14, ONVAR,
                            align="right", hi=30, lo=18, name=f"l{i}b"))
    reg("hon", block(d, "والسجل يثبت السلامة والنسبة والترتيب، لا صحة الحكم الشرعي ولا صحة النص الأصلي: "
                        "تلك مسؤولية المراجع المختص.",
                     "semi", 150, 868, 1858, 950, SECONDARY, align="right", hi=30, lo=20, name="hon"))


def slide10(img, d):
    chrome(img, d, 10, "خطة الاستمرار بعد التحدي")
    items = [
        ("التكلفة والاستضافة", "عامل على Cloudflare Workers وطبقة Workers AI بلا مفتاح؛ "
                               "كلفة تشغيل منخفضة ومسار توسّع جاهز."),
        ("المراجعة الدورية", "بنك القيود وسياسة قوة الحكم يُراجَعان دوريًا، "
                             "ويوقّع عليهما مختص محتوى شرعي عند كل تحديث."),
        ("الخطوة التالية", "توسيع الاسترجاع إلى «dorar.net» و«shamela.ws» و«islamic-content.com» "
                            "— ترد 403 على العميل الآلي — عبر مسار مرخّص أو مراجعة بشرية للمقابلات المعتمدة."),
        ("المسؤوليات", "فريق المشروع التقني: المحرك والنشر والاستمرارية. "
                       "مختص المحتوى الشرعي: البنك وسياسة قوة الحكم والنظر في حالات الوقف والتحويل."),
    ]
    ys = [(310, 470), (490, 650), (670, 810), (830, 950)]
    for i, ((h, b), (y0, y1)) in enumerate(zip(items, ys)):
        card(d, 90, y0, 1858, y1, fill=LOW if i % 2 == 0 else WHITE, outline=OUTLINE, name=f"p{i}")
        reg(f"p{i}h", block(d, h, "black", 1180, y0 + 14, 1828, y1 - 14, SECONDARY,
                            align="right", hi=34, lo=22, name=f"p{i}h"))
        d.line([1170, y0 + 14, 1170, y1 - 14], fill=RULE_BG, width=3)
        reg(f"p{i}b", block(d, b, "reg", 120, y0 + 12, 1150, y1 - 12, ON,
                            align="right", hi=30, lo=18, name=f"p{i}b"))


def slide11(img, d):
    chrome(img, d, 11, "موزون | مقياس أمانة النقل", kicker="شكرًا — أسئلتكم")
    reg("c1", block(d, "قياس واحد: أمانة المعنى، مع موضع ودليل، ووقف حين يجب الوقف.",
                    "black", 150, 330, 1858, 430, ON, align="right", hi=48, lo=28, name="c1"))
    card(d, 90, 470, 1858, 640, fill=PCONT, outline=PCONT, name="url")
    reg("url_h", block(d, "النموذج الحيّ", "semi", 130, 492, 1818, 546, "#c8d2e5",
                       align="right", hi=32, lo=22, name="url_h"))
    reg("url_b", block(d, "https://mawzun-project.hoysamax.workers.dev", "mono",
                       130, 556, 1818, 616, GREEN, align="right", hi=36, lo=22, mono=True, name="url_b"))
    card(d, 90, 670, 1858, 830, fill=LOW, outline=OUTLINE, name="verify")
    reg("verify_h", block(d, "أمر التحقق من المحرك", "semi", 130, 690, 1818, 744, ONVAR,
                     align="right", hi=30, lo=20, name="verify_h"))
    reg("verify_c", block(d, "bun run engine:check", "mono", 130, 752, 1818, 810, PRIMARY,
                     align="right", hi=36, lo=22, mono=True, name="verify_c"))
    reg("c2", block(d, "النتيجة: 28/28 checks passed — و«وقف وتحويل» نتيجة معتبرة لا فشل.",
                    "bold", 150, 862, 1858, 926, SECONDARY, align="right", hi=34, lo=22, name="c2"))


SLIDE_FUNCS = [slide01, slide02, slide03, slide04, slide05, slide06, slide07, slide08, slide09, slide10, slide11]


def main():
    pages = []
    for i, fn in enumerate(SLIDE_FUNCS, start=1):
        img, d = new_slide()
        fn(img, d)
        ov, bd = check_slide(i)
        img.save(os.path.join(SLIDEDIR, f"slide-{i:02d}.png"))
        pages.append(img)
    pdf = os.path.join(OUTDIR, "mawzun-deck.pdf")
    pages[0].save(pdf, "PDF", resolution=96.0, save_all=True, append_images=pages[1:])
    print(f"pages={len(pages)}")
    print(f"pdf={pdf} bytes={os.path.getsize(pdf)}")
    for k, v in ISSUES.items():
        print(f"{k}: {len(v)}")
        for line in v[:20]:
            print("   ", line)
    print("OK" if all(len(v) == 0 for v in ISSUES.values()) else "ISSUES PRESENT")


if __name__ == "__main__":
    main()
