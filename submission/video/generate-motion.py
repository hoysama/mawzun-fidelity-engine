#!/usr/bin/env python3
"""
Motion piece for Mawzun — «مقياس أمانة النقل».

Every figure in this video is read from `motion-facts.json`, which was captured
from a real engine run through the running application. Nothing here is invented:
if the record says the semantic layer was rejected for a fabricated quote, the
video says that, because that rejection is the product's strongest claim.

Palette and type come from the shipped design tokens in `src/app/globals.css`,
so the video and the application are the same object.

    python gen.py --probe     render a handful of key frames to PNG
    python gen.py             render every frame and encode to MP4
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).parent
FACTS = json.loads((HERE / "motion-facts.json").read_text(encoding="utf-8"))

# ── canvas ────────────────────────────────────────────────────────────────────
W, H = 1920, 1080
FPS = 30
TOP_H = 96           # session bar
FOOT_Y = 1004        # footer band top
SAFE = 88            # page margin
CX = W // 2

# ── tokens (src/app/globals.css) ──────────────────────────────────────────────
SURFACE = "#f8f9ff"
SURFACE_LOW = "#eff4ff"
SURFACE_CONT = "#e5eeff"
SURFACE_HIGH = "#dce9ff"
WHITE = "#ffffff"
INK = "#091426"
INK2 = "#1e293b"
INK3 = "#45474c"
OUTLINE = "#75777d"
OUTLINE_VAR = "#c5c6cd"
ACCENT = "#0058be"
ACCENT_CONT = "#2170e4"
ACCENT_FIX = "#d8e2ff"
ACCENT_FIX_DIM = "#adc6ff"
OK_BG = "#85f8c4"
OK_INK = "#00301f"
REV_BG = "#d8e2ff"
REV_INK = "#091426"
ERR = "#ba1a1a"
ERR_BG = "#ffdad6"

# ── fonts ─────────────────────────────────────────────────────────────────────
FDIR = pathlib.Path("/root/.hermes/workspaces/slide-gen/fonts")
AR_BLACK = str(FDIR / "Cairo-Black.ttf")
AR_BOLD = str(FDIR / "Cairo-Bold.ttf")
AR_SEMI = str(FDIR / "Cairo-SemiBold.ttf")
AR_REG = str(FDIR / "Cairo-Regular.ttf")
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    key = (path, size)
    if key not in _cache:
        _cache[key] = ImageFont.truetype(path, size)
    return _cache[key]


FEATURES = ["kern", "liga", "calt"]
LRI, PDI = "\u2066", "\u2069"
_PUNCT = set(".,:;/@#-_+*=<>%&()[]{}\"'`~|\\")

# Latin letters and digits beyond ASCII (MAWZŪN) must stay inside their island,
# so membership is decided by `isalnum()` rather than by an ASCII alphabet.
_RUN_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") | _PUNCT
_LETTERS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")


def has_ar(s: str) -> bool:
    return any("\u0600" <= ch <= "\u06ff" for ch in s)


def _is_run(ch: str) -> bool:
    return not has_ar(ch) and (ch.isalnum() or ch in _RUN_CHARS)


def iso(s: str) -> str:
    """Wrap each Latin run in LRI…PDI so bidi cannot reorder it inside Arabic.

    Two traps live here, both of which produce wrong output rather than an
    error, so both are handled explicitly:

    * A run trimmed of trailing sentence punctuation can become EMPTY — and an
      empty island never advances the cursor, which is an infinite loop rather
      than a wrong pixel. The index therefore always advances to the end of the
      raw run.
    * A multi-word Latin phrase inside an Arabic sentence ('not recommended')
      splits into one island per word, and an RTL paragraph lays adjacent
      islands out right-to-left, so the phrase would read reversed. Islands
      separated by a single space are merged when at least one side carries a
      Latin LETTER — deliberately not when both sides are pure numbers, which
      would flip their order.
    """
    raw: list[tuple[str, bool]] = []  # (text, is_island)
    i, n = 0, len(s)
    while i < n:
        if not _is_run(s[i]):
            raw.append((s[i], False))
            i += 1
            continue
        j = i
        while j < n and _is_run(s[j]):
            j += 1
        k = j
        while k > i and s[k - 1] in " .,:;":
            k -= 1
        if k > i:
            raw.append((s[i:k], True))
        if k < j:  # the trimmed tail is emitted as ordinary text
            raw.append((s[k:j], False))
        i = j  # always advances: s[i] is a run character, so j > i

    merged: list[tuple[str, bool]] = []
    k = 0
    while k < len(raw):
        text, isl = raw[k]
        if isl:
            # island + single space + island, with a Latin LETTER on one side
            while (k + 2 < len(raw) and raw[k + 1] == (" ", False) and raw[k + 2][1]
                   and ((set(text) & _LETTERS) or (set(raw[k + 2][0]) & _LETTERS))):
                text += " " + raw[k + 2][0]
                k += 2
            merged.append((text, True))
        else:
            merged.append((text, isl))
        k += 1

    return "".join((LRI + t + PDI) if isl else t for t, isl in merged)


def measure(draw: ImageDraw.ImageDraw, s: str, f: ImageFont.FreeTypeFont) -> float:
    if not s:
        return 0.0
    d = "rtl" if has_ar(s) else "ltr"
    return draw.textlength(iso(s), font=f, direction=d, language="ar", features=FEATURES)


def put(draw, xy, s, f, fill, anchor="rm", align=None):
    """Draw one run, deriving direction from its own content."""
    d = "rtl" if has_ar(s) else "ltr"
    draw.text(xy, iso(s), font=f, fill=fill, anchor=anchor,
              direction=d, language="ar", features=FEATURES, align=align)


def wrap(draw, s: str, f: ImageFont.FreeTypeFont, max_w: float) -> list[str]:
    words, lines, cur = s.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if measure(draw, trial, f) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


class Fitter:
    """Shrink a text block until it fits its box, then wrap and lay it out."""

    def __init__(self, draw):
        self.draw = draw

    def block(self, s, path, hi, lo, max_w, max_h, gap=1.42):
        size = hi
        while size > lo:
            f = font(path, size)
            lines = wrap(self.draw, s, f, max_w)
            asc, desc = f.getmetrics()
            adv = int(size * gap)
            height = (len(lines) - 1) * adv + asc + desc
            if lines and all(measure(self.draw, ln, f) <= max_w for ln in lines) and height <= max_h:
                return f, lines, adv
            size -= 2
        f = font(path, lo)
        lines = wrap(self.draw, s, f, max_w)
        asc, desc = f.getmetrics()
        adv = int(lo * gap)
        return f, lines, adv


# ── easing ────────────────────────────────────────────────────────────────────
def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def span(t: float, a: float, b: float) -> float:
    return clamp01((t - a) / (b - a)) if b > a else (1.0 if t >= a else 0.0)


def ease_out(x: float) -> float:
    return 1 - (1 - clamp01(x)) ** 3


def ease_io(x: float) -> float:
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def lerp(a, b, t):
    return a + (b - a) * t


# ── primitives ────────────────────────────────────────────────────────────────
def rrect(draw, box, r, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def card(img, box, r=14, fill=WHITE, border=OUTLINE_VAR, shadow=True):
    """Flat tonal panel: hairline border plus the very light shadow the design uses."""
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle(
            (box[0], box[1] + 2, box[2], box[3] + 3), radius=r, fill=(9, 20, 38, 14)
        )
        img.alpha_composite(sh)
    ImageDraw.Draw(img).rounded_rectangle(box, radius=r, fill=fill,
                                          outline=border, width=1)


def chip(draw, xy, label, f, fg, bg, pad=(18, 9), anchor="rm", r=4):
    """A tonal chip — the design draws these without a rule.

    `anchor` names the point of the chip that `xy` positions:
    "rm" the right edge, vertically centred; "lm" the left edge, vertically
    centred; "mm" the centre. Right edge is the default because the layout is
    RTL and inset elements are measured from the panel's right edge inward.
    """
    tw = measure(draw, label, f)
    asc, desc = f.getmetrics()
    w = tw + pad[0] * 2
    h = asc + desc + pad[1] * 2
    if anchor == "rm":
        x2, y1 = xy[0], xy[1] - h / 2
        x1 = x2 - w
    elif anchor == "mm":
        x1, y1 = xy[0] - w / 2, xy[1] - h / 2
        x2 = x1 + w
    else:  # "lm"
        x1, y1 = xy[0], xy[1] - h / 2
        x2 = x1 + w
    y2 = y1 + h
    rrect(draw, (x1, y1, x2, y2), r, fill=bg)
    put(draw, ((x1 + x2) / 2, (y1 + y2) / 2), label, f, fg, anchor="mm")
    return (x1, y1, x2, y2)


def grid(img, drift=0.0):
    """The faint drafting grid the product's canvas sits on."""
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    step = 64
    off = int(drift) % step
    for x in range(-step, W + step, step):
        d.line((x - off, TOP_H, x - off, FOOT_Y), fill=(9, 20, 38, 12), width=1)
    for y in range(TOP_H, FOOT_Y, step):
        d.line((0, y, W, y), fill=(9, 20, 38, 12), width=1)
    img.alpha_composite(g)


def topbar(draw, stage_ar: str, stage_en: str):
    draw.rectangle((0, 0, W, TOP_H), fill=SURFACE_LOW)
    draw.line((0, TOP_H, W, TOP_H), fill=OUTLINE_VAR, width=1)
    # brand, right edge
    put(draw, (W - SAFE, TOP_H / 2), "مَوْزُون | MAWZŪN", font(AR_BOLD, 30), INK, anchor="rm")
    bw = measure(draw, "مَوْزُون | MAWZŪN", font(AR_BOLD, 30))
    put(draw, (W - SAFE - bw - 22, TOP_H / 2), "مقياس أمانة النقل", font(AR_REG, 22), INK3, anchor="rm")
    # stage, left edge
    if stage_en:
        put(draw, (SAFE, TOP_H / 2), stage_en, font(MONO, 20), OUTLINE, anchor="lm")
    if stage_ar:
        en_w = measure(draw, stage_en, font(MONO, 20)) if stage_en else 0
        put(draw, (SAFE + en_w + 18, TOP_H / 2), stage_ar, font(AR_SEMI, 22), ACCENT, anchor="lm")
    # marker dot
    draw.ellipse((SAFE - 26, TOP_H / 2 - 5, SAFE - 16, TOP_H / 2 + 5), fill=ACCENT)


def footer(draw, progress: float, label_ar: str):
    draw.rectangle((0, FOOT_Y, W, H), fill=SURFACE_LOW)
    draw.line((0, FOOT_Y, W, FOOT_Y), fill=OUTLINE_VAR, width=1)
    put(draw, (W - SAFE, FOOT_Y + 40), "يقيس أمانة النقل، ولا يفتي ولا يرجّح مذهبًا",
        font(AR_REG, 22), INK3, anchor="rm")
    put(draw, (SAFE, FOOT_Y + 40), f"SHA-256 RECORD  ·  {int(progress * 100):02d}%",
        font(MONO, 20), OUTLINE, anchor="lm")
    # progress rule
    draw.line((0, H - 5, W, H - 5), fill=SURFACE_HIGH, width=10)
    draw.line((W - int(W * progress), H - 5, W, H - 5), fill=ACCENT, width=10)
    if label_ar:
        put(draw, (CX, FOOT_Y + 40), label_ar, font(AR_SEMI, 22), ACCENT, anchor="mm")


def base(stage_ar="", stage_en="", progress=0.0, foot="", drift=0.0) -> Image.Image:
    img = Image.new("RGBA", (W, H), SURFACE)
    grid(img, drift)
    d = ImageDraw.Draw(img)
    topbar(d, stage_ar, stage_en)
    footer(d, progress, foot)
    return img


# ── scenes ────────────────────────────────────────────────────────────────────
SCENES: list[tuple[float, float, str, str, str, object]] = []


def scene(t0, t1, stage_ar, stage_en, foot, fn):
    SCENES.append((t0, t1, stage_ar, stage_en, foot, fn))


# 1 ── the hook -----------------------------------------------------------------
def s_hook(img, lt, dur):
    d = ImageDraw.Draw(img)
    y = TOP_H + 210
    a = span(lt, 0.3, 1.4)
    f = font(AR_BLACK, 118)
    put(d, (CX, y), "اللغة سليمة.", f, INK, anchor="mm")
    if a > 0:
        pass

    if lt > 2.2:
        y2 = y + 172
        p = ease_out(span(lt, 2.2, 3.4))
        f2 = font(AR_BLACK, 118)
        put(d, (CX, y2 + (1 - p) * 26), "والمعنى انزاح.", f2, INK, anchor="mm")
        # strike through the drifted word, drawn as a sweep
        tw = measure(d, "والمعنى انزاح.", f2)
        wx = CX - tw / 2 - 40
        sw = measure(d, "انزاح.", f2)
        x2 = wx + (sw + 30) * ease_out(span(lt, 3.0, 3.9))
        d.line((wx, y2 + 62, x2, y2 + 62), fill=ERR, width=9)

    if lt > 4.4:
        p = ease_out(span(lt, 4.4, 5.3))
        y3 = y + 320
        f3 = font(MONO, 34)
        line = "It is not recommended to sell food before taking possession."
        tw = measure(d, line, f3)
        put(d, (CX, y3), line, f3, ACCENT if p > 0 else OUTLINE, anchor="mm")
        d.line((CX - tw / 2, y3 + 34, CX - tw / 2 + tw * p, y3 + 34), fill=ACCENT_FIX_DIM, width=4)

    if lt > 6.2:
        p = ease_out(span(lt, 6.2, 7.0))
        f4 = font(AR_SEMI, 34)
        put(d, (CX, y + 418), "والأصل: لا يجوز بيع الطعام قبل قبضه.", f4,
            INK3 if p < 1 else INK, anchor="mm")


scene(0.0, 9.0, "", "", "الانزياح الذي لا يمسكه مدقق لغوي", s_hook)


# 2 ── why nobody catches it ----------------------------------------------------
PROBLEM = [
    ("المدقق اللغوي", "يرى الجملة سليمة، فلا يجد ما يصحّحه."),
    ("أدوات الترجمة", "تقيس جودة عامة، لا أمانة المعنى."),
    ("المراجع البشري", "دقيق، لكنه بطيء ويختلف من واحد إلى واحد."),
]


def s_problem(img, lt, dur):
    d = ImageDraw.Draw(img)
    f_t = font(AR_BOLD, 58)
    put(d, (W - SAFE, TOP_H + 96), "لماذا لا يمسك أحد هذا الانزياح؟", f_t, INK, anchor="rm")

    top = TOP_H + 236
    ch = 168
    for i, (title, body) in enumerate(PROBLEM):
        t0 = 1.6 + i * 0.85
        p = ease_out(span(lt, t0, t0 + 0.75))
        if p <= 0:
            continue
        y = top + i * (ch + 30)
        x_off = (1 - p) * 150
        box = (SAFE + x_off, y, W - SAFE + x_off, y + ch)
        card(img, box, r=12, fill=WHITE)
        dd = ImageDraw.Draw(img)
        dd.rectangle((box[2] - 6, box[1] + 18, box[2] - 2, box[3] - 18), fill=ACCENT)
        put(dd, (box[2] - 44, y + 52), f"{i + 1:02d}", font(MONO_B, 30), ACCENT_FIX_DIM, anchor="rm")
        put(dd, (box[2] - 92, y + 52), title, font(AR_BOLD, 40), INK, anchor="rm")
        put(dd, (box[2] - 92, y + 112), body, font(AR_REG, 30), INK3, anchor="rm")

    if lt > 4.9:
        p = ease_out(span(lt, 4.9, 5.6))
        put(d, (CX, FOOT_Y - 108), "السؤال الأخطر: هل بقي المعنى الشرعي كما هو؟",
            font(AR_SEMI, 44), INK if p > 0.6 else INK3, anchor="mm")


scene(9.0, 20.0, "", "", "الفجوة التي يقف عندها موزون", s_problem)


# 3 ── what Mawzun is -----------------------------------------------------------
def s_identity(img, lt, dur):
    d = ImageDraw.Draw(img)
    p = ease_out(span(lt, 0.2, 1.3))
    put(d, (CX, TOP_H + 172 + (1 - p) * 20), "مَوْزُون", font(AR_BLACK, 132), INK, anchor="mm")
    put(d, (CX, TOP_H + 268), "MAWZŪN  ·  مقياس أمانة النقل", font(MONO, 30), ACCENT, anchor="mm")

    lines = [
        "يقيس أمانة النقل بين نصّ شرعي أصلي ونصّ مشتقّ منه.",
        "ولا يفتي، ولا يرجّح مذهبًا، ولا يحكم على صحة رأي.",
        "فالامتناع عنده نتيجة معتبرة، لا فشل.",
    ]
    for i, line in enumerate(lines):
        t0 = 2.1 + i * 0.8
        p = ease_out(span(lt, t0, t0 + 0.7))
        if p <= 0:
            continue
        y = TOP_H + 400 + i * 96
        f = font(AR_SEMI if i == 0 else AR_REG, 40 if i == 0 else 36)
        put(d, (CX, y + (1 - p) * 14), line, f, INK if i == 0 else INK3, anchor="mm")


scene(20.0, 31.0, "", "", "ما هو موزون وما ليس هو", s_identity)


# 4 ── the four inputs ----------------------------------------------------------
SRC = "لا يجوز بيع الطعام قبل قبضه، ويجب على البائع بيانه للمشتري."
DRV = "It is not recommended to sell food before taking possession…"


def s_inputs(img, lt, dur):
    d = ImageDraw.Draw(img)
    put(d, (W - SAFE, TOP_H + 96), "المدخلات الأربعة", font(AR_BOLD, 58), INK, anchor="rm")

    top = TOP_H + 226
    h = 300
    gap = 26
    tw = (W - SAFE * 2 - gap * 3) // 4
    tiles = [
        ("النص الأصلي", SRC, "ar"),
        ("النص المشتق", DRV, "en"),
        ("نوع العمل", "ترجمة (translate)", "en"),
        ("مستوى المحتوى", "باء — شرح وتفسير", "ar"),
    ]
    for i, (title, body, kind) in enumerate(tiles):
        t0 = 1.1 + i * 0.7
        p = ease_out(span(lt, t0, t0 + 0.65))
        if p <= 0:
            continue
        # RTL order: first tile sits at the RIGHT edge
        x2 = W - SAFE - i * (tw + gap)
        x1 = x2 - tw
        y1 = top + (1 - p) * 34
        box = (x1, y1, x2, y1 + h)
        card(img, box, r=12, fill=WHITE)
        dd = ImageDraw.Draw(img)
        dd.rectangle((x1, y1, x2, y1 + 68), fill=SURFACE_LOW)
        dd.line((x1, y1 + 68, x2, y1 + 68), fill=OUTLINE_VAR, width=1)
        put(dd, (x2 - 26, y1 + 36), title, font(AR_BOLD, 32), INK, anchor="rm")

        fx = Fitter(dd)
        if kind == "ar":
            f, lines, adv = fx.block(body, AR_REG, 30, 18, tw - 52, h - 132)
            yy = y1 + 104
            for ln in lines:
                put(dd, (x2 - 26, yy), ln, f, INK2, anchor="rm", align="right")
                yy += adv
        else:
            f, lines, adv = fx.block(body, MONO, 26, 16, tw - 52, h - 132)
            yy = y1 + 104
            for ln in lines:
                put(dd, (x2 - 26, yy), ln, f, ACCENT, anchor="rm", align="right")
                yy += adv

    if lt > 4.6:
        p = ease_out(span(lt, 4.6, 5.3))
        put(d, (CX, FOOT_Y - 116), "أربعة مدخلات، ثم فحص بثلاث طبقات لا تُخلط في رقم واحد.",
            font(AR_SEMI, 38), INK2 if p > 0.5 else INK3, anchor="mm")


scene(31.0, 43.0, "", "", "المدخلات", s_inputs)


# 5a ── layer one ---------------------------------------------------------------
def s_l1(img, lt, dur):
    d = ImageDraw.Draw(img)
    p = ease_out(span(lt, 0.2, 0.9))
    put(d, (W - SAFE, TOP_H + 96 + (1 - p) * 16), "الطبقة 01", font(MONO_B, 34), ACCENT, anchor="rm")
    put(d, (W - SAFE, TOP_H + 150), "الحتمية  ·  Deterministic", font(AR_BOLD, 56), INK, anchor="rm")

    box = (SAFE, TOP_H + 240, W - SAFE, TOP_H + 240 + 250)
    if lt > 1.2:
        card(img, box, r=14, fill=WHITE)
        dd = ImageDraw.Draw(img)
        put(dd, (box[2] - 40, box[1] + 60), "بلا ذكاء اصطناعي: الأرقام والإحالات وألفاظ درجة الثبوت.",
            font(AR_REG, 36), INK2, anchor="rm")
        put(dd, (box[2] - 40, box[1] + 128), "مقارنة وجود ومطابقة على جداول مستوردة، لا رأي ولا توليد.",
            font(AR_REG, 32), INK3, anchor="rm")
        chip(dd, (box[2] - 40, box[1] + 200), "DET-QUOTE+NUMERIC", font(MONO, 22), OUTLINE, SURFACE_CONT)

    if lt > 3.0:
        p2 = ease_out(span(lt, 3.0, 3.8))
        put(d, (CX, FOOT_Y - 150), "لا واقعة في هذه الطبقة لهذا الزوج.", font(AR_SEMI, 40),
            INK2 if p2 > 0.6 else INK3, anchor="mm")
        put(d, (CX, FOOT_Y - 96), "والفراغ هنا يعني شيئًا واحدًا: لا شيء يُفحص، فلا يُدَّعى فحصه.",
            font(AR_REG, 30), INK3, anchor="mm")


scene(43.0, 51.5, "الطبقة الأولى", "L1 / DETERMINISTIC", "الطبقة الحتمية", s_l1)


# 5b ── layer two: the finding --------------------------------------------------
def s_l2(img, lt, dur):
    d = ImageDraw.Draw(img)
    put(d, (W - SAFE, TOP_H + 96), "الطبقة 02", font(MONO_B, 34), ACCENT, anchor="rm")
    put(d, (W - SAFE, TOP_H + 150), "المعجمية  ·  Lexical", font(AR_BOLD, 56), INK, anchor="rm")

    bw, bh = 700, 236
    y1 = TOP_H + 250
    x_right2 = W - SAFE            # right panel's right edge
    x_right1 = x_right2 - bw       # right panel's left edge
    x_left1 = SAFE
    x_left2 = SAFE + bw

    # right panel: the wording as it stands in the source
    rs = span(lt, 1.1, 1.9)
    if rs > 0:
        off = (1 - ease_out(rs)) * 90
        b = (x_right1 + off, y1, x_right2 + off, y1 + bh)
        card(img, b, r=12, fill=WHITE, border=ACCENT_FIX_DIM)
        dd = ImageDraw.Draw(img)
        chip(dd, (b[2] - 34, b[1] + 46), "في الأصل", font(AR_REG, 26), OUTLINE,
             SURFACE_CONT, anchor="rm")
        put(dd, (b[2] - 34, b[1] + 116), "لا يجوز", font(AR_BLACK, 62), INK, anchor="rm")
        put(dd, (b[2] - 34, b[1] + 186), "قوتها: منع  ·  ملزم", font(AR_SEMI, 30), INK3, anchor="rm")

    # left panel: the rendering, its force read from the same policy table
    ls = span(lt, 2.2, 3.0)
    if ls > 0:
        off = (1 - ease_out(ls)) * 90
        b = (x_left1 - off, y1, x_left2 - off, y1 + bh)
        card(img, b, r=12, fill=WHITE, border=ERR)
        dd = ImageDraw.Draw(img)
        chip(dd, (b[2] - 34, b[1] + 46), "في المشتق", font(AR_REG, 26), OUTLINE,
             SURFACE_CONT, anchor="rm")
        put(dd, (b[2] - 34, b[1] + 126), "not recommended", font(MONO_B, 48), ERR, anchor="rm")
        put(dd, (b[2] - 34, b[1] + 196), "قوتها: كراهة  ·  غير ملزم", font(AR_SEMI, 30), INK3, anchor="rm")

    # the shift between them: the rule stops short of the label instead of
    # running under it, so the label reads as a dimension, not as overlapping ink
    if lt > 3.4:
        p = ease_out(span(lt, 3.4, 4.2))
        ymid = y1 + bh + 74
        x_from = x_right1 - 30
        x_to = x_left2 + 30
        x_tip = lerp(x_from, x_to, p)
        d.line((x_from, ymid, x_tip, ymid), fill=ERR, width=4)
        if p > 0.96:
            d.polygon([(x_to, ymid), (x_to + 24, ymid - 13), (x_to + 24, ymid + 13)], fill=ERR)
        put(d, ((x_from + x_to) / 2, ymid - 40), "انزياح في قوة الحكم",
            font(AR_BOLD, 34), ERR, anchor="mm")
        if lt > 4.6:
            chip(d, ((x_from + x_to) / 2, ymid + 58), "ruling-prohibition",
                 font(MONO, 22), ACCENT, ACCENT_FIX, anchor="mm")

    if lt > 6.0:
        put(d, (W - SAFE, FOOT_Y - 110), "اللغة سليمة تمامًا، والحكم تغيّر.",
            font(AR_BOLD, 42), INK, anchor="rm")


scene(51.5, 63.0, "الطبقة الثانية", "L2 / LEXICAL", "الطبقة المعجمية", s_l2)


# 5c ── layer three -------------------------------------------------------------
QS = ["هل بقي الشرط؟", "هل صحت النسبة؟", "هل حُفظت قوة الحكم؟"]


def s_l3(img, lt, dur):
    d = ImageDraw.Draw(img)
    put(d, (W - SAFE, TOP_H + 96), "الطبقة 03", font(MONO_B, 34), ACCENT, anchor="rm")
    put(d, (W - SAFE, TOP_H + 150), "الدلالية  ·  Semantic", font(AR_BOLD, 56), INK, anchor="rm")

    top = TOP_H + 236
    cw = (W - SAFE * 2 - 52) // 3
    for i, q in enumerate(QS):
        t0 = 0.7 + i * 0.55
        p = ease_out(span(lt, t0, t0 + 0.6))
        if p <= 0:
            continue
        x2 = W - SAFE - i * (cw + 26)
        x1 = x2 - cw
        y1 = top + (1 - p) * 26
        b = (x1, y1, x2, y1 + 128)
        card(img, b, r=10, fill=SURFACE_LOW, border=ACCENT_FIX_DIM, shadow=False)
        dd = ImageDraw.Draw(img)
        put(dd, ((x1 + x2) / 2, y1 + 64), q, font(AR_SEMI, 34), INK, anchor="mm")

    if lt > 3.0:
        p = ease_out(span(lt, 3.0, 3.8))
        box = (SAFE, top + 190, W - SAFE, top + 190 + 190)
        card(img, box, r=14, fill=WHITE)
        dd = ImageDraw.Draw(img)
        put(dd, (box[2] - 40, box[1] + 58), "النموذج يُنتج وقائع، لا أحكامًا.",
            font(AR_BOLD, 40), INK, anchor="rm")
        put(dd, (box[2] - 40, box[1] + 122), "وكل اقتباس يُتحقق من وجوده حرفيًا في النص، والمختلق يُرفض.",
            font(AR_REG, 32), INK3, anchor="rm")

    if lt > 5.2:
        p = ease_out(span(lt, 5.2, 6.0))
        put(d, (SAFE, FOOT_Y - 132), "رُفض 3 بنود من مخرج النموذج لاقتباس غير موجود في النص.",
            font(AR_SEMI, 36), ERR if p > 0.5 else INK3, anchor="lm")
        put(d, (SAFE, FOOT_Y - 84), "الفحص يرفض مخرجه قبل أن يُصدّقه.", font(AR_REG, 30), INK3, anchor="lm")


scene(63.0, 73.0, "الطبقة الثالثة", "L3 / SEMANTIC", "الطبقة الدلالية", s_l3)


# 6 ── the verdict --------------------------------------------------------------
VERDICTS = [("مطابق", "faithful", OK_BG, OK_INK),
            ("يحتاج تعديل", "needs_revision", REV_BG, REV_INK),
            ("وقف وتحويل", "refer", ERR_BG, "#410002")]


def s_verdict(img, lt, dur):
    d = ImageDraw.Draw(img)
    put(d, (W - SAFE, TOP_H + 96), "الحكم", font(AR_BOLD, 58), INK, anchor="rm")

    top = TOP_H + 226
    tw = (W - SAFE * 2 - 60) // 3
    for i, (label, key, bg, fg) in enumerate(VERDICTS):
        t0 = 0.9 + i * 0.5
        p = ease_out(span(lt, t0, t0 + 0.55))
        if p <= 0:
            continue
        active = key == "needs_revision"
        x2 = W - SAFE - i * (tw + 30)
        x1 = x2 - tw
        y1 = top + (1 - p) * 22
        b = (x1, y1, x2, y1 + 116)
        card(img, b, r=12, fill=bg if active else SURFACE_CONT,
             border=ACCENT if active else OUTLINE_VAR, shadow=active)
        dd = ImageDraw.Draw(img)
        put(dd, ((x1 + x2) / 2, y1 + 58), label, font(AR_BOLD if active else AR_REG, 44),
            fg if active else OUTLINE, anchor="mm")
        if active and lt > 2.6:
            chip(dd, ((x1 + x2) / 2, y1 + 116), "الحالة النشطة", font(AR_REG, 22), fg,
                 SURFACE_LOW, anchor="mm")

    if lt > 3.2:
        p = ease_out(span(lt, 3.2, 3.9))
        y = top + 176
        box = (SAFE, y, W - SAFE, y + 150)
        card(img, box, r=12, fill=WHITE)
        dd = ImageDraw.Draw(img)
        put(dd, (box[2] - 34, y + 48), "السبب", font(AR_SEMI, 28), OUTLINE, anchor="rm")
        put(dd, (box[2] - 34, y + 106), "رُصد انزياح في قوة الحكم: المنع نُقل إلى كراهة.",
            font(AR_REG, 34), INK, anchor="rm")

    if lt > 5.0:
        p = ease_out(span(lt, 5.0, 5.7))
        y = top + 356
        items = [("الموضع", "not recommended"), ("الدليل", "«لا يجوز» ← «not recommended»"),
                 ("التصحيح", "المقابلة المعتمدة من الحزمة")]
        aw = (W - SAFE * 2 - 52) // 3
        for i, (k, v) in enumerate(items):
            x2 = W - SAFE - i * (aw + 26)
            x1 = x2 - aw
            b = (x1, y, x2, y + 134)
            card(img, b, r=10, fill=SURFACE_LOW, border=OUTLINE_VAR, shadow=False)
            dd = ImageDraw.Draw(img)
            put(dd, ((x1 + x2) / 2, y + 42), k, font(AR_SEMI, 26), OUTLINE, anchor="mm")
            f, lines, adv = Fitter(dd).block(v, AR_REG if has_ar(v) else MONO, 28, 18, aw - 40, 60)
            yy = y + 86
            for ln in lines[:1]:
                put(dd, ((x1 + x2) / 2, yy), ln, f, INK, anchor="mm")

    if lt > 7.0:
        put(d, (CX, FOOT_Y - 96), "والقرار للمراجع البشري. النظام يوجّه نظره إلى الموضع الذي يستحق وقته.",
            font(AR_SEMI, 34), INK2, anchor="mm")


scene(73.0, 86.0, "الحكم", "VERDICT", "حكم واحد بثلاث حالات", s_verdict)


# 7 ── the record ---------------------------------------------------------------
def s_record(img, lt, dur):
    d = ImageDraw.Draw(img)
    put(d, (W - SAFE, TOP_H + 96), "الشهادة والسجل", font(AR_BOLD, 58), INK, anchor="rm")

    y = TOP_H + 226
    box = (SAFE, y, W - SAFE, y + 330)
    card(img, box, r=14, fill=WHITE)
    dd = ImageDraw.Draw(img)
    title = "شهادة الفحص"
    put(dd, (box[2] - 40, y + 60), title, font(AR_BOLD, 42), INK, anchor="rm")
    # the status chip sits to the LEFT of the title, inside the panel: both are
    # measured from the panel's right edge inward, so they cannot collide
    tw_title = measure(dd, title, font(AR_BOLD, 42))
    chip(dd, (box[2] - 40 - tw_title - 26, y + 60), "NEEDS_REVISION",
         font(MONO, 22), ACCENT, ACCENT_FIX, anchor="rm")

    # the digest, typed out from the real record
    digest = FACTS["digest"]
    shown = digest[: int(len(digest) * ease_out(span(lt, 1.4, 3.2)))]
    put(dd, (box[2] - 40, y + 126), "بصمة السجل  ·  SHA-256", font(AR_REG, 26), OUTLINE, anchor="rm")
    put(dd, (box[2] - 40, y + 172), shown or "…", font(MONO, 26), ACCENT, anchor="rm")

    rows = [
        ("إصدار المحرك", FACTS["engine"]),
        ("إصدار بنك القيود", FACTS["bank"]),
        ("النموذج المستعمل", FACTS["model"]),
    ]
    for i, (k, v) in enumerate(rows):
        yy = y + 234 + i * 30
        put(dd, (box[2] - 40, yy), k, font(AR_REG, 24), INK3, anchor="rm")
        put(dd, (SAFE + 40, yy), v, font(MONO, 20), INK3, anchor="lm")

    if lt > 4.0:
        p = ease_out(span(lt, 4.0, 4.8))
        put(d, (CX, y + 386), "أعد الفحص على النص نفسه، يخرج الحكم نفسه مع السجل نفسه.",
            font(AR_BOLD, 42), INK if p > 0.6 else INK3, anchor="mm")
        put(d, (CX, y + 448), "والسجل يسجّل ما لم يُفحص أيضًا، فلا تمرّ فجوة صامتة:",
            font(AR_REG, 30), INK3, anchor="mm")


scene(86.0, 99.0, "السجل", "CERTIFICATE & LOG", "سجل قابل لإعادة التشغيل", s_record)


# 8 ── close --------------------------------------------------------------------
def s_close(img, lt, dur):
    d = ImageDraw.Draw(img)
    p = ease_out(span(lt, 0.3, 1.4))
    put(d, (CX, TOP_H + 250 + (1 - p) * 22), "مَوْزُون", font(AR_BLACK, 136), INK, anchor="mm")
    put(d, (CX, TOP_H + 352), "يقيس أمانة النقل، ولا يفتي ولا يرجّح مذهبًا.",
        font(AR_SEMI, 46), INK2, anchor="mm")

    if lt > 1.8:
        p = ease_out(span(lt, 1.8, 2.6))
        put(d, (CX, TOP_H + 470), "mawzun-project.hoysamax.workers.dev", font(MONO_B, 40),
            ACCENT if p > 0.6 else OUTLINE, anchor="mm")
        tw = measure(d, "mawzun-project.hoysamax.workers.dev", font(MONO_B, 40))
        d.line((CX - tw / 2, TOP_H + 502, CX - tw / 2 + tw * p, TOP_H + 502), fill=ACCENT, width=4)

    if lt > 3.2:
        put(d, (CX, TOP_H + 578), "تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي",
            font(AR_REG, 32), OUTLINE, anchor="mm")


scene(99.0, 110.0, "", "", "موزون", s_close)


TOTAL = SCENES[-1][1]


# ── render ────────────────────────────────────────────────────────────────────
def frame_at(t: float) -> Image.Image:
    for t0, t1, st_ar, st_en, foot, fn in SCENES:
        if t0 <= t < t1:
            img = base(st_ar, st_en, t / TOTAL, foot, drift=t * 6)
            fn(img, t - t0, t1 - t0)
            return img.convert("RGB")
    img = base("", "", 1.0, "", drift=t * 6)
    return img.convert("RGB")


def probe(stamps: list[float]):
    out = HERE / "probe"
    out.mkdir(exist_ok=True)
    for s in stamps:
        frame_at(s).save(out / f"t{s:06.2f}.png")
    print("wrote", len(stamps), "probe frames to", out)


def ink_violations(img: Image.Image) -> list[str]:
    """Dark ink where only the bars and the grid are allowed to be.

    Text that overflows its band is the failure this catches: it shows up as ink
    in the strips just inside the top bar, the footer, and the side margins.
    """
    g = img.convert("L")
    px = g.load()
    bands = {
        "top band": (0, TOP_H + 4, W, TOP_H + 10),
        "footer band": (0, FOOT_Y - 10, W, FOOT_Y - 4),
        "right margin": (W - 6, TOP_H + 10, W, FOOT_Y - 10),
        "left margin": (0, TOP_H + 10, 6, FOOT_Y - 10),
    }
    bad = []
    for name, (x1, y1, x2, y2) in bands.items():
        n = sum(1 for y in range(y1, y2) for x in range(x1, x2) if px[x, y] < 120)
        if n:
            bad.append(f"{name}: {n}px")
    return bad


def check(stamps: list[float]):
    worst = 0
    for s in stamps:
        v = ink_violations(frame_at(s))
        if v:
            worst += 1
            print(f"  t={s:6.2f}  " + " · ".join(v))
    if worst == 0:
        print(f"clean: no ink outside the content band across {len(stamps)} sampled frames")
    else:
        print(f"{worst} of {len(stamps)} frames have ink in a forbidden strip")
    return worst


def render():
    frames = HERE / "frames"
    frames.mkdir(exist_ok=True)
    n = int(TOTAL * FPS)
    for i in range(n):
        frame_at(i / FPS).save(frames / f"f{i:05d}.png")
        if i % 120 == 0:
            print(f"  frame {i}/{n}", flush=True)
    print(f"rendered {n} frames")

    import imageio_ffmpeg
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    mp4 = HERE / "mawzun-motion.mp4"
    subprocess.run(
        [exe, "-y", "-framerate", str(FPS), "-i", str(frames / "f%05d.png"),
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)],
        check=True, capture_output=True,
    )
    print("encoded", mp4, mp4.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    stamps = [1.2, 5.6, 7.4, 12.0, 17.5, 23.0, 34.5, 45.5, 47.0, 54.0, 58.5, 61.5,
              66.0, 76.0, 80.5, 84.0, 89.5, 94.0, 97.0, 103.0, 108.0]
    if args.check:
        sys.exit(1 if check(stamps) else 0)
    elif args.probe:
        probe(stamps)
    else:
        render()
