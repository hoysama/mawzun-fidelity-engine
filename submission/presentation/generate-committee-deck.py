#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mawzun committee deck — Arabic RTL slides rendered with Pillow + libraqm,
assembled into submission/presentation/mawzun-committee-deck.pdf.

This deck is a SIBLING of mawzun-deck.pdf: it imports every shared helper and
the palette from generate-deck.py (which is __main__-guarded, so importing it
does not render or write anything) and mirrors its `chrome` with a page total
of 18 so both decks read as one family.

  * F / block / card / chip / reg / check_slide / new_slide / box / hline reused verbatim;
  * the only re-implementation is `chrome`, identical to the original except the
    pageno denominator (the original hard-codes "/ 11");
  * every drawn region is registered and four counted assertions are printed:
    overflow, bounds violations, overlap, and RTL order for mirrored rows.
"""
import os
import sys
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True  # importing the kit must not leave a __pycache__

# ------------------------------------------------------------------- shared kit
_spec = importlib.util.spec_from_file_location(
    "mawzun_deck", os.path.join(HERE, "generate-deck.py"))
dk = importlib.util.module_from_spec(_spec)
sys.modules["mawzun_deck"] = dk
_spec.loader.exec_module(dk)

W, H = dk.W, dk.H
TOTAL = 18
OUTDIR = HERE
SLIDEDIR = os.path.join(OUTDIR, "committee-slides")
os.makedirs(SLIDEDIR, exist_ok=True)

# palette (aliased from the shared kit so both decks cannot drift)
BG = dk.BG
LOW = dk.LOW
WHITE = dk.WHITE
PRIMARY = dk.PRIMARY
PCONT = dk.PCONT
SECONDARY = dk.SECONDARY
OUTLINE = dk.OUTLINE
ON = dk.ON
ONVAR = dk.ONVAR
GREEN = dk.GREEN
GREEN_INK = dk.GREEN_INK
ERROR = dk.ERROR
ERROR_BG = dk.ERROR_BG
ERROR_INK = dk.ERROR_INK
RULE_BG = dk.RULE_BG
AMBER_BG = dk.AMBER_BG
AMBER_INK = dk.AMBER_INK

# shared helpers (verbatim from the kit)
block = dk.block
card = dk.card
chip = dk.chip
reg = dk.reg
box = dk.box
hline = dk.hline
new_slide = dk.new_slide
check_slide = dk.check_slide


def chrome(img, draw, num, title, kicker="موزون | مقياس أمانة النقل"):
    """Same chrome as generate-deck.chrome, with an 18-page denominator."""
    dk._current = f"s{num:02d}"
    dk.REG = []
    d = draw
    box(d, 30, 30, W - 30, H - 30, fill=None, outline=OUTLINE, width=2, radius=30)
    reg("kicker", block(d, kicker, "semi", 1050, 66, W - 62, 108, ONVAR,
                        align="right", hi=24, lo=18, name="kicker"))
    reg("pageno", block(d, f"{num:02d} / {TOTAL}", "mono", 62, 70, 260, 104, OUTLINE,
                        align="left", hi=22, lo=18, mono=True, name="pageno"))
    tb = reg("title", block(d, title, "black", 260, 130, W - 62, 236, PRIMARY,
                            align="right", hi=62, lo=36, name="title"))
    hline(d, 62, W - 62, 258, RULE_BG, 3)
    hline(d, 62, W - 62, 992, RULE_BG, 2)
    reg("foot_r", block(d, "مقياس أمانة النقل بين النص الشرعي الأصلي والنص المشتق", "reg",
                        760, 1000, W - 62, 1036, ONVAR, align="right", hi=20, lo=16, name="foot_r"))
    reg("foot_l", block(d, "هاكاثون الذكاء الاصطناعي — المسار الثاني", "reg",
                        62, 1000, 740, 1036, ONVAR, align="left", hi=20, lo=16, name="foot_l"))
    return tb


# ------------------------------------------------------------------- card makers
def infocard(d, x0, y0, x1, y1, head, body, name, fill=LOW, outline=OUTLINE,
             hink=PRIMARY, bink=ONVAR, hhi=36, hlo=22, bhi=28, blo=17,
             rule=True):
    card(d, x0, y0, x1, y1, fill=fill, outline=outline, name=name)
    reg(name + "h", block(d, head, "black", x0 + 28, y0 + 16, x1 - 28, y0 + 92, hink,
                          align="right", hi=hhi, lo=hlo, name=name + "h"))
    if rule:
        hline(d, x0 + 28, x1 - 28, y0 + 106, RULE_BG, 2)
    reg(name + "b", block(d, body, "reg", x0 + 28, y0 + 120, x1 - 28, y1 - 16, bink,
                          align="right", hi=bhi, lo=blo, name=name + "b"))


def statcard(d, x0, y0, x1, y1, number, label, name):
    card(d, x0, y0, x1, y1, fill=WHITE, outline=SECONDARY, width=3, name=name)
    reg(name + "n", block(d, number, "mono", x0 + 20, y0 + 18, x1 - 20, y0 + 116,
                          SECONDARY, align="right", hi=66, lo=34, mono=True, name=name + "n"))
    reg(name + "l", block(d, label, "semi", x0 + 20, y0 + 128, x1 - 20, y1 - 16,
                          PRIMARY, align="right", hi=30, lo=17, name=name + "l"))


def qacard(d, y0, y1, q, a, name):
    card(d, 90, y0, 1830, y1, fill=LOW, outline=OUTLINE, name=name)
    reg(name + "q", block(d, q, "bold", 120, y0 + 10, 1800, y0 + 98, PRIMARY,
                          align="right", hi=34, lo=22, name=name + "q"))
    reg(name + "a", block(d, a, "reg", 120, y0 + 104, 1800, y1 - 12, ONVAR,
                          align="right", hi=26, lo=15, name=name + "a"))


def rowcard(d, y0, y1, head, body, name, fill=LOW, outline=OUTLINE, hink=SECONDARY,
            bink=ON, split=1170):
    """Full-width row, header compartment on the right (RTL)."""
    card(d, 90, y0, 1830, y1, fill=fill, outline=outline, name=name)
    reg(name + "h", block(d, head, "black", split + 10, y0 + 14, 1800, y1 - 14, hink,
                          align="right", hi=34, lo=20, name=name + "h"))
    d.line([split, y0 + 14, split, y1 - 14], fill=RULE_BG, width=3)
    reg(name + "b", block(d, body, "reg", 120, y0 + 12, split - 20, y1 - 12, bink,
                          align="right", hi=30, lo=17, name=name + "b"))


# ============================================================================= SLIDES
def slide01(img, d):
    chrome(img, d, 1, "موزون | مقياس أمانة النقل", kicker="عرض تقديمي أمام لجنة التحكيم")
    reg("claim", block(d, "موزون يقيس أمانة النقل بين نصّ شرعي أصلي ونصّ مشتق: "
                          "لا يكتب نصًّا، ولا يفتي، بل يُخرج حكمًا واحدًا بسببه وموضعه ودليله.",
                       "bold", 150, 300, 1770, 470, ON, align="right", hi=50, lo=30, name="claim"))
    card(d, 150, 505, 1770, 625, fill=PCONT, outline=PCONT, name="track")
    reg("track_t", block(d, "المسار الثاني: صناعة المحتوى متعدد اللغات والتوطين الثقافي · فريق موزون",
                         "black", 200, 520, 1720, 610, WHITE, align="right", hi=40, lo=26, name="track_t"))
    kw = ["حكم واحد بثلاث حالات", "سبب وموضع ودليل", "سجل SHA-256 يعيد إنتاج الحكم"]
    xs = [1770, 1180, 590]
    for i, (k, xr) in enumerate(zip(kw, xs)):
        card(d, xr - 540, 690, xr, 810, fill=LOW, outline=OUTLINE, name=f"kw{i}")
        reg(f"kw{i}t", block(d, k, "semi", xr - 510, 706, xr - 30, 794, PCONT,
                             align="right", hi=28, lo=19, name=f"kw{i}t"))
    reg("live", block(d, "https://mawzun-project.hoysamax.workers.dev", "mono",
                      150, 858, 1770, 902, SECONDARY, align="right", hi=28, lo=20, mono=True, name="live"))


def slide02(img, d):
    chrome(img, d, 2, "المشكلة: النقل يفقد معناه بلا أن يلاحظ أحد")
    reg("sub", block(d, "الانزياح يقع في لفظ صغير يحمل حكمًا كبيرًا، فيمرّ سليمًا من كل مدقّق لغوي.",
                     "reg", 300, 288, 1858, 366, ONVAR, align="right", hi=32, lo=22, name="sub"))
    card(d, 1075, 400, 1830, 830, fill=LOW, outline=SECONDARY, width=3, name="p_src")
    reg("p_src_l", block(d, "النص الأصلي", "semi", 1110, 422, 1795, 468, SECONDARY,
                         align="right", hi=30, lo=22, name="p_src_l"))
    reg("p_src_b", block(d, "«لا يجوز بيع الطعام قبل قبضه.»", "bold",
                         1110, 500, 1795, 640, ON, align="right", hi=46, lo=30, name="p_src_b"))
    card(d, 1110, 690, 1795, 780, fill=ERROR_BG, outline=ERROR, name="p_src_f")
    reg("p_src_f_t", block(d, "القوة: منع — ملزم", "bold", 1140, 706, 1765, 764, ERROR_INK,
                           align="right", hi=34, lo=24, name="p_src_f_t"))
    card(d, 90, 400, 845, 830, fill=LOW, outline=ERROR, width=3, name="p_dev")
    reg("p_dev_l", block(d, "النص المشتق", "semi", 125, 422, 810, 468, ERROR,
                         align="right", hi=30, lo=22, name="p_dev_l"))
    reg("p_dev_b", block(d, "It is not recommended to sell food before taking possession.",
                         "bold", 125, 500, 810, 640, ON, align="right", hi=42, lo=24, name="p_dev_b"))
    card(d, 125, 690, 810, 780, fill=ERROR_BG, outline=ERROR, name="p_dev_f")
    reg("p_dev_f_t", block(d, "القوة: كراهة — غير ملزم", "bold", 155, 706, 780, 764, ERROR_INK,
                           align="right", hi=34, lo=24, name="p_dev_f_t"))
    dk.arrow_left(d, 1050, 905, 560, ERROR)
    reg("arrow", block(d, "انزياح في قوة الحكم", "bold", 858, 470, 1050, 640, ERROR,
                       align="right", hi=28, lo=20, name="arrow"))
    reg("note", block(d, "نقل المحتوى الشرعي بين نصّين يفقد معناه بلا أن يلاحظ أحد؛ "
                         "الخطأ ليس في اللغة، بل في أمانة النقل.",
                      "reg", 150, 862, 1858, 920, ONVAR, align="right", hi=28, lo=20, name="note"))


def slide03(img, d):
    chrome(img, d, 3, "الفجوة: لا مقياس يُعيد إنتاج الحكم")
    cards = [
        ("أدوات الترجمة", "تُحسّن الأسلوب والطلاقة، ولا تقيس أمانة المعنى ولا قوة الحكم."),
        ("النموذج اللغوي", "يكتب نصًّا ولا يشهد على نقل: لا يُصدر حكمًا قابلًا لإعادة التشغيل."),
        ("غياب المقياس", "لا مقياس يربط النقل بمصدر معتمد ويُخرج موضعًا ودليلًا ووقفًا."),
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
    for a, b in ((0, 1), (1, 2)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            dk.ISSUES["rtl"].append(f"s03 card order c{a}/c{b} inverted")
    reg("s03_res", block(d, "الفجوة: لا أداة تمتدّ من النص الشرعي إلى حكم واحد مُعلَّل قابل لإعادة التشغيل.",
                         "bold", 150, 840, 1858, 912, SECONDARY,
                         align="right", hi=34, lo=22, name="s03_res"))


def slide04(img, d):
    chrome(img, d, 4, "الفكرة في سطر واحد")
    reg("idea", block(d, "موزون لا يكتب نصًّا ولا يفتي — يقيس أمانة النقل بين نصّ شرعي أصلي ونصّ مشتق، "
                         "ويُخرج حكمًا واحدًا بثلاث حالات مرفقًا بسببه وموضعه ودليله.",
                      "bold", 150, 300, 1858, 560, ON, align="right", hi=46, lo=28, name="idea"))
    cards = [
        ("يقيس", "يقارن النقل بين النصّين ويُخرج حكمًا بموضع ودليل."),
        ("لا يفتي", "لا يُرجّح مذهبًا ولا يحكم على صحة رأي، ويوقف عند الشك."),
        ("لا يكتب", "ليس مولّد نصّ ولا محرّرًا لغويًا: سلامة اللغة شرط لازم لا كافٍ."),
    ]
    xr = [1830, 1213, 596]
    boxes = []
    for i, (h, b) in enumerate(cards):
        x0 = xr[i] - 540
        boxes.append(card(d, x0, 610, xr[i], 830, fill=WHITE, outline=OUTLINE, name=f"k{i}"))
        reg(f"k{i}h", block(d, h, "black", x0 + 26, 626, xr[i] - 26, 690, SECONDARY,
                            align="right", hi=34, lo=24, name=f"k{i}h"))
        hline(d, x0 + 26, xr[i] - 26, 704, RULE_BG, 2)
        reg(f"k{i}b", block(d, b, "reg", x0 + 26, 716, xr[i] - 26, 814, ONVAR,
                            align="right", hi=26, lo=17, name=f"k{i}b"))
    for a, b in ((0, 1), (1, 2)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            dk.ISSUES["rtl"].append(f"s04 card order k{a}/k{b} inverted")
    reg("res", block(d, "النتيجة: أداة قرار للمراجع البشري، لا بديلًا عنه.",
                     "semi", 150, 870, 1858, 940, GREEN_INK, align="right", hi=34, lo=22, name="res"))


def slide05(img, d):
    chrome(img, d, 5, "الحل — المدخلات: أربعة عناصر")
    # (x0, y0, x1, y1, head, body) — right column read before left (RTL)
    layout = [
        (990, 320, 1830, 600, "النص الأصلي", "نصّ شرعي معتمد يصلح مرجعًا للمقارنة."),
        (90, 320, 930, 600, "النص المشتق", "ترجمة أو تلخيص أو إعادة صياغة يُراد قياس أمانتها."),
        (990, 640, 1830, 920, "نوع العمل", "ترجمة / تلخيص / إعادة صياغة: يحدّد مسار المقارنة."),
        (90, 640, 930, 920, "مستوى المحتوى (أ–د)", "يرفع الصرامة أو يخفضها؛ والمستوى (د) يوقف ويحيل."),
    ]
    boxes = []
    for i, (x0, y0, x1, y1, h, b) in enumerate(layout):
        infocard(d, x0, y0, x1, y1, h, b, f"io{i}")
        boxes.append((x0, y0, x1, y1))
    # RTL: top-right before top-left, bottom-right before bottom-left
    if not (boxes[0][0] >= boxes[1][2] - 1 and boxes[2][0] >= boxes[3][2] - 1):
        dk.ISSUES["rtl"].append("s05 input grid not right-to-left")


def slide06(img, d):
    chrome(img, d, 6, "الحل — الطبقات الثلاث")
    layers = [
        ("الطبقة 1 — حتمية",
         "أرقام وإحالات ودرجة ثبوت، ومطابقة حرفية للاقتباس القرآني على نص المصحف المعتمد، "
         "مع استشهاد بالآية. تعمل بلا نموذج."),
        ("الطبقة 2 — معجمية",
         "قاموس المصطلحات، وجدول قوة الحكم، وأدوات الشرط والحصر — بحثًا في جداول."),
        ("الطبقة 3 — دلالية",
         "نموذج يُنتج وقائع لا أحكامًا، وكل اقتباس يُتحقق حرفيًا وإلا رُفض."),
    ]
    xr = 1858
    ends = []
    for i, (h, b) in enumerate(layers):
        x0 = xr - 545
        card(d, x0, 320, xr, 760, fill=PCONT, outline=PCONT, name=f"L{i}")
        reg(f"L{i}h", block(d, h, "black", x0 + 28, 348, xr - 28, 422, WHITE,
                            align="right", hi=38, lo=24, name=f"L{i}h"))
        hline(d, x0 + 28, xr - 28, 442, "#4a5568", 2)
        reg(f"L{i}b", block(d, b, "reg", x0 + 28, 466, xr - 28, 738, "#c8d2e5",
                            align="right", hi=28, lo=18, name=f"L{i}b"))
        ends.append((x0, xr))
        if i < 2:
            dk.arrow_left(d, x0 - 8, x0 - 52, 470, SECONDARY)
        xr = x0 - 78
    if not (ends[0][0] >= ends[1][1] and ends[1][0] >= ends[2][1]):
        dk.ISSUES["rtl"].append("s06 layer flow not right-to-left")
    reg("note", block(d, "الطبقتان الأولى والثانية تعملان بلا نموذج؛ والحكم دالة حتمية على الوقائع.",
                      "semi", 150, 810, 1858, 890, SECONDARY, align="right", hi=32, lo=20, name="note"))


def slide07(img, d):
    chrome(img, d, 7, "الحل — الحكم: واحد بثلاث حالات")
    reg("desc", block(d, "حكم واحد يخرج من دالة حتمية على الوقائع، ومعه دائمًا السبب والموضع والدليل.",
                      "reg", 150, 292, 1858, 372, ONVAR, align="right", hi=32, lo=22, name="desc"))
    states = [
        ("مطابق", "النقل يحفظ المعنى وقوة الحكم، والدليل مطابق.", GREEN, GREEN_INK),
        ("يحتاج تعديل", "انزياح محدَّد يُرفق بموضعه ودليله للمراجعة.", AMBER_BG, AMBER_INK),
        ("وقف وتحويل", "شك أو مستوى (د): يتوقف ويحيل إلى جهة مؤهلة.", ERROR_BG, ERROR_INK),
    ]
    xr = [1830, 1213, 596]
    boxes = []
    for i, (h, b, fill, ink) in enumerate(states):
        x0 = xr[i] - 540
        boxes.append(card(d, x0, 430, xr[i], 730, fill=fill, outline=OUTLINE, width=3, name=f"v{i}"))
        reg(f"v{i}h", block(d, h, "black", x0 + 28, 462, xr[i] - 28, 540, ink,
                            align="right", hi=38, lo=24, name=f"v{i}h"))
        hline(d, x0 + 28, xr[i] - 28, 560, OUTLINE, 2)
        reg(f"v{i}b", block(d, b, "reg", x0 + 28, 584, xr[i] - 28, 714, ink,
                            align="right", hi=28, lo=18, name=f"v{i}b"))
    for a, b in ((0, 1), (1, 2)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            dk.ISSUES["rtl"].append(f"s07 state order v{a}/v{b} inverted")
    reg("tail", block(d, "«وقف وتحويل» نتيجة معتبرة لا فشل: الامتناع حكمٌ مُعلَن لا خطأ تشغيلي.",
                      "semi", 150, 790, 1858, 890, PRIMARY, align="right", hi=34, lo=22, name="tail"))


def slide08(img, d):
    chrome(img, d, 8, "الاسترجاع الحيّ: لا فهرس ولا نسخة مخزّنة")
    reg("stmt", block(d, "يُقرأ النص المعتمد لحظة الفحص ويُرفق بالإحالة الكاملة، ويُختم في السجل — "
                         "لا مخزون مسبق ولا فهرس يُعطي أقرب شبيه.",
                      "bold", 150, 296, 1858, 430, ON, align="right", hi=36, lo=24, name="stmt"))
    fields = [
        ("المصدر", "النص المعتمد لحظة الفحص"),
        ("العنوان", "موضع النص في مصدره"),
        ("لحظة القراءة", "وقت الاسترجاع نفسه"),
        ("البصمة", "ختم النص المسترجع في السجل"),
    ]
    xr = [1830, 1390, 950, 510]
    boxes = []
    for i, (h, b) in enumerate(fields):
        x0 = xr[i] - 420
        boxes.append(card(d, x0, 480, xr[i], 700, fill=WHITE, outline=SECONDARY, width=3, name=f"f{i}"))
        reg(f"f{i}h", block(d, h, "black", x0 + 20, 502, xr[i] - 20, 580, SECONDARY,
                            align="right", hi=32, lo=22, name=f"f{i}h"))
        hline(d, x0 + 20, xr[i] - 20, 600, RULE_BG, 2)
        reg(f"f{i}b", block(d, b, "reg", x0 + 20, 616, xr[i] - 20, 684, ONVAR,
                            align="right", hi=24, lo=16, name=f"f{i}b"))
    for a, b in ((0, 1), (1, 2), (2, 3)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            dk.ISSUES["rtl"].append(f"s08 field order f{a}/f{b} inverted")
    reg("tail", block(d, "الفحص يحتاج القطع في الموضع المعتمد، والفهرس يعطي أقرب شبيه لا الأصل.",
                      "semi", 150, 760, 1858, 860, SECONDARY, align="right", hi=34, lo=22, name="tail"))


def slide09(img, d):
    chrome(img, d, 9, "السجل: بصمة SHA-256 وإعادة تشغيل بلا شبكة")
    reg("stmt", block(d, "لكل فحص سجل مختوم: بصمة SHA-256، ومعرّف النموذج، وبصمة المطالبة، "
                         "وما لم يُفحص معلَن فيه لا صامت.",
                      "bold", 150, 296, 1858, 420, ON, align="right", hi=34, lo=22, name="stmt"))
    card(d, 90, 470, 1830, 700, fill=LOW, outline=OUTLINE, name="rec")
    reg("rec_h", block(d, "بصمة سجل حقيقي (سيناريو: لا يجوز ← not recommended)", "semi",
                       120, 494, 1800, 548, PRIMARY, align="right", hi=30, lo=20, name="rec_h"))
    dig = "e02880eec6b08a303fa64a8acc387e653373d93835a39e84e928c613e685ad20"
    reg("rec_d", block(d, dig[:32] + " " + dig[32:], "mono", 120, 566, 1800, 640, PRIMARY,
                       align="right", hi=30, lo=20, mono=True, name="rec_d"))
    reg("rec_n", block(d, "إعادة تشغيل السجل تُعيد إنتاج الحكم نفسه بلا شبكة.", "semi",
                       120, 650, 1800, 690, GREEN_INK, align="right", hi=26, lo=18, name="rec_n"))
    reg("tail", block(d, "ما لم يُفحص يُعلَن صراحةً: غياب الطبقة الدلالية أو تعذّر الوصول إلى المصدر "
                         "يظهر في السجل بدل أن يمرّ صامتًا.",
                      "reg", 150, 760, 1858, 900, ONVAR, align="right", hi=30, lo=20, name="tail"))


def slide10(img, d):
    chrome(img, d, 10, "الدليل — الأرقام")
    stats = [
        ("37", "زوج مُعنون في المدوّنة"),
        ("36/37", "النتيجة على المدوّنة"),
        ("21/21", "كشف الانزياح"),
        ("0", "إيجاب سلبي"),
    ]
    xr = [1830, 1390, 950, 510]
    boxes = []
    for i, (n, l) in enumerate(stats):
        x0 = xr[i] - 420
        statcard(d, x0, 300, xr[i], 520, n, l, f"st{i}")
        boxes.append((x0, 300, xr[i], 520))
    for a, b in ((0, 1), (1, 2), (2, 3)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            dk.ISSUES["rtl"].append(f"s10 stat order st{a}/st{b} inverted")
    details = [
        ("توزيع المدوّنة", "24 ترجمة · 8 تلخيص · 5 إعادة صياغة."),
        ("الإنذار الكاذب", "واحد مسمّى وموصوف: «cln-02»."),
        ("التشغيل", "سبع بوابات تُشغَّل بأمر واحد."),
    ]
    xr = [1830, 1213, 596]
    boxes = []
    for i, (h, b) in enumerate(details):
        x0 = xr[i] - 540
        boxes.append(card(d, x0, 570, xr[i], 770, fill=LOW, outline=OUTLINE, name=f"d{i}"))
        reg(f"d{i}h", block(d, h, "black", x0 + 26, 590, xr[i] - 26, 652, SECONDARY,
                            align="right", hi=32, lo=22, name=f"d{i}h"))
        hline(d, x0 + 26, xr[i] - 26, 666, RULE_BG, 2)
        reg(f"d{i}b", block(d, b, "reg", x0 + 26, 680, xr[i] - 26, 754, ONVAR,
                            align="right", hi=26, lo=17, name=f"d{i}b"))
    for a, b in ((0, 1), (1, 2)):
        if not (boxes[a][0] >= boxes[b][2] - 1):
            dk.ISSUES["rtl"].append(f"s10 detail order d{a}/d{b} inverted")
    reg("note", block(d, "كل رقم أعلاه من تشغيل المدوّنة في المستودع عبر «bun run benchmark»، لا تقدير.",
                      "semi", 150, 820, 1858, 910, PRIMARY, align="right", hi=32, lo=20, name="note"))


def slide11(img, d):
    chrome(img, d, 11, "الدليل — التحقق الحيّ على الرابط المنشور")
    reg("stmt", block(d, "طلبٌ على النموذج المنشور فيه آية قُرئت بحرف محرَّف عاد بحكم «يحتاج تعديل»، "
                         "ومعه واقعة تشير إلى الآية 2:153 واستشهادها.",
                      "bold", 150, 296, 1858, 440, ON, align="right", hi=36, lo=24, name="stmt"))
    card(d, 990, 480, 1830, 700, fill=AMBER_BG, outline=OUTLINE, width=3, name="va")
    reg("va_h", block(d, "الحكم المُعاد", "semi", 1020, 502, 1800, 556, AMBER_INK,
                      align="right", hi=30, lo=20, name="va_h"))
    reg("va_b", block(d, "«يحتاج تعديل»", "black", 1020, 572, 1800, 680, AMBER_INK,
                      align="right", hi=44, lo=28, name="va_b"))
    card(d, 90, 480, 930, 700, fill=LOW, outline=OUTLINE, name="vb")
    reg("vb_h", block(d, "الواقعة المرفقة", "semi", 120, 502, 900, 556, PRIMARY,
                      align="right", hi=30, lo=20, name="vb_h"))
    reg("vb_b", block(d, "الآية 2:153 مع استشهادها", "bold", 120, 572, 900, 680, PRIMARY,
                      align="right", hi=34, lo=22, name="vb_b"))
    reg("tail", block(d, "وإصلاح حرف واحد هو سؤال اختبار من الحزمة الرسمية نفسها: التصحيح المحدَّد "
                         "يقلب الحكم إلى «مطابق».",
                      "reg", 150, 760, 1858, 900, SECONDARY, align="right", hi=30, lo=20, name="tail"))


def slide12(img, d):
    chrome(img, d, 12, "ما لا يفحصه موزون — الصدق قبل الادعاء")
    rows = [
        ("الاكتمال — بُعد غير مفحوص",
         "إسقاط جملة يُنبه ولا يُلتقط بالمقابلة المعجمية، فأضفنا إشارة عند نقص المشتق تمنع الشهادة بالأمانة."),
        ("ثلاثة مصادر ترد 403",
         "تُعلَن غير متاحة صراحةً، ولا يُخترع لها بديل."),
        ("إنذار كاذب واحد مسمّى",
         "معلَن وموصوف: «cln-02» — لا يُخفى ولا يُجمَّل."),
    ]
    ys = [(300, 470), (490, 660), (680, 850)]
    for i, ((h, b), (y0, y1)) in enumerate(zip(rows, ys)):
        fill = ERROR_BG if i == 0 else LOW
        outl = ERROR if i == 0 else OUTLINE
        card(d, 90, y0, 1830, y1, fill=fill, outline=outl, width=3 if i == 0 else 2, name=f"l{i}")
        reg(f"l{i}h", block(d, h, "bold", 120, y0 + 16, 1800, y0 + 78,
                            ERROR_INK if i == 0 else PRIMARY, align="right", hi=34, lo=22, name=f"l{i}h"))
        reg(f"l{i}b", block(d, b, "reg", 120, y0 + 84, 1800, y1 - 14, ONVAR,
                            align="right", hi=30, lo=18, name=f"l{i}b"))
    reg("hon", block(d, "الصدق قبل الادعاء: نُعلن ما لا نفحصه، ولا نُمرّ صامتًا على بُعد لم نقِسه.",
                     "semi", 150, 868, 1858, 950, SECONDARY, align="right", hi=32, lo=20, name="hon"))


QA = [
    ("س١: كيف نعلم أن النظام يعمل فعلًا ولا يعيد قيمًا جاهزة؟",
     "ج: سجل «Observability» حيّ للطلب نفسه (outcome: ok، الحالة 200، بلا استثناءات)، وسطر من "
     "شيفرتنا يقول أي نموذج أجاب وفي أي محاولة، وسجل الفحص يحمل معرّف النموذج وبصمة المطالبة. "
     "والبصمة تتغيّر بتغيّر المدخل، والحكم يتغيّر بين «مطابق» و«يحتاج تعديل» و«وقف وتحويل» بحسب النص."),
    ("س٢: هل تُفتون أو ترجّحون مذهبًا؟",
     "ج: لا. موزون يقيس أمانة النقل لا الحكم، ولا يصدر ترجيحًا، ومستوى المحتوى (د) يوقف الفحص "
     "ويحيل إلى جهة مؤهلة. والامتناع عندنا نتيجة معتبرة لا فشل."),
    ("س٣: ما الفرق بينكم وبين نموذج لغوي كبير يُسأل مباشرة؟",
     "ج: الاتجاه معاكس. النموذج يكتب نصًا، وموزون يقيس النقل بين نصين بقيود معتمدة من حزمة المنظّم "
     "ويُخرج حكمًا قابلًا لإعادة التشغيل. والنموذج عندنا يُنتج وقائع لا أحكامًا، وكل اقتباس منه "
     "يُتحقق حرفيًا وإلا رُفض."),
    ("س٤: هل تستخدمون «RAG»؟",
     "ج: لا بالمعنى المتعارف: لا فهرس ولا تضمين. عندنا استرجاع حيّ للنص المعتمد وقت الفحص، "
     "للتحقق لا للتوليد. والسبب أن التحقق يحتاج القطع، والفهرس يعطي أقرب شبيه."),
    ("س٥: ولماذا لا تستخدمون «Vectorize»؟",
     "ج: لأننا قِسنا. في «embeddinggemma-300m» كان تشابه «الصابرين» و«الصابرون» بتبديل حرف واحد "
     "0.9846، وهو أعلى من تشابه الآية نفسها مكتوبةً بلا تشكيل (0.7952). فلا عتبة تفصل تبدّل حرف "
     "من تبدّل كلمة، ولا توسيع حكم من إبدال كلمة."),
    ("س٦: لو تغيّر النموذج غدًا، تتغيّر نتائجكم؟",
     "ج: الجواب في التصميم: الطبقتان الأولى والثانية حتميتان بلا نموذج، والحكم دالة حتمية على "
     "الوقائع، والسجل يسمّي النموذج ويحمل بصمة المطالبة وبصمة السجل. فالنتيجة تُفسَّر ولا تُدّعى."),
    ("س٧: ما الذي لا يفحصه نظامكم؟",
     "ج: الاكتمال بُعد غير مفحوص — إسقاط جملة لا يُلتقط بالمقابلة المعجمية، فأضفنا إشارة عند نقص "
     "المشتق تمنع الشهادة بالأمانة. وثلاثة من المصادر التسعة ترد 403 فتُعلَن غير متاحة ولا يُخترع "
     "لها بديل. وإنذار كاذب واحد في المدوّنة مسمّى وموصوف."),
    ("س٨: أرقامكم حقيقية أم معملية؟",
     "ج: مدوّنة 37 زوجًا بأنواع انزياح مصنّفة، والنتيجة 36/37، وكشف الانزياح 21/21، وصفر إيجاب "
     "سلبي، وإنذار كاذب واحد مسمّى. ومشغّلها أمر واحد: «bun run benchmark»."),
    ("س٩: هل النظام جاهز للتشغيل؟",
     "ج: عامل واحد على «Cloudflare» بلا قاعدة بيانات وبلا تخزين، ومفتاح سرّي واحد، وسلسلة نماذج "
     "فيها ثلاثة مجانية ثم نموذجان محليان كمهبط، ولكل مرشّح مهلة إجهاض."),
    ("س١٠: هل تستخدمون بيانات حقيقية أو بيانات مستفيدين؟",
     "ج: لا. المدخلات اصطناعية مجهولة، ولا تُخزَّن، ولا يجمع النظام بيانات شخصية. والمفاتيح في "
     "متغيّرات مشفّرة لا في المستودع."),
    ("س١١: وما الذي في المستودع للتثبّت؟",
     "ج: مستودع عام برخصة «MIT» برابط حيّ، وسجل مصادر وأدوات بإصداراتها وتراخيصها، وسبع بوابات "
     "تُشغَّل بأمر: «engine:check» و«benchmark» و«retrieval:check» و«hadith:check» "
     "و«invariant:check» و«lint» و«docs:check»."),
    ("س١٢: لو أثبتنا أن نتيجة عندكم خاطئة الآن؟",
     "ج: الحكم ليس ادّعاء صحة حكم شرعي، بل قياس أمانة نقل بحدود معلنة. وكل انزياح يُخرج موضعه "
     "وسببه ودليله فيُراجَع. وإن ثبت إنذار كاذب تتبّعناه وسمّيناه كما سمّينا «cln-02»."),
]

QA_PARTS = ["الجزء الأول", "الجزء الثاني", "الجزء الثالث", "الجزء الرابع"]


def make_qa_slide(idx):
    def fn(img, d):
        chrome(img, d, 13 + idx, f"أسئلة تحشيرية وأجوبة — {QA_PARTS[idx]}")
        base = idx * 3
        for j in range(3):
            y0 = 296 + j * 224
            q, a = QA[base + j]
            qacard(d, y0, y0 + 214, q, a, f"qa{j}")
    return fn


def slide17(img, d):
    chrome(img, d, 17, "خطة الاستمرار")
    items = [
        ("توسيع الاسترجاع",
         "فتح المصادر الثلاثة المغلقة (403) عبر مسار مرخّص أو مراجعة بشرية للمقابلات المعتمدة."),
        ("إغلاق الإنذار الكاذب",
         "ربط قوة الحكم بترتيب الموضع لرفع دقة التصنيف وإزالة الإنذار الواحد."),
        ("المراجعة الدورية",
         "بنك القيود يُراجَع دوريًا ويوقّع عليه مختص محتوى شرعي عند كل تحديث."),
    ]
    ys = [(310, 510), (530, 730), (750, 950)]
    for i, ((h, b), (y0, y1)) in enumerate(zip(items, ys)):
        rowcard(d, y0, y1, h, b, f"p{i}", fill=LOW if i % 2 == 0 else WHITE)


def slide18(img, d):
    chrome(img, d, 18, "موزون | مقياس أمانة النقل", kicker="شكرًا — أسئلتكم")
    reg("c1", block(d, "قياس واحد: أمانة المعنى، مع موضع ودليل، ووقف حين يجب الوقف.",
                    "black", 150, 300, 1858, 400, ON, align="right", hi=46, lo=28, name="c1"))
    card(d, 90, 440, 1858, 600, fill=PCONT, outline=PCONT, name="url")
    reg("url_h", block(d, "النموذج الحيّ", "semi", 130, 460, 1818, 512, "#c8d2e5",
                       align="right", hi=30, lo=22, name="url_h"))
    reg("url_b", block(d, "https://mawzun-project.hoysamax.workers.dev", "mono",
                       130, 520, 1818, 582, GREEN, align="right", hi=34, lo=22, mono=True, name="url_b"))
    card(d, 90, 620, 1858, 780, fill=LOW, outline=OUTLINE, name="verify")
    reg("verify_h", block(d, "تشغيل البوابات", "semi", 130, 640, 1818, 692, ONVAR,
                          align="right", hi=30, lo=20, name="verify_h"))
    reg("verify_c", block(d, "bun run engine:check · benchmark · retrieval:check · hadith:check · "
                             "invariant:check · lint · docs:check",
                          "mono", 130, 700, 1818, 762, PRIMARY,
                          align="right", hi=30, lo=16, mono=True, name="verify_c"))
    reg("c2", block(d, "ما ندّعيه: قياس أمانة نقل بحدود معلنة. وما لا ندّعيه: صحة حكم شرعي، "
                       "أو اكتمال بُعد لم يُفحص.",
                    "bold", 150, 812, 1858, 950, SECONDARY, align="right", hi=36, lo=22, name="c2"))


SLIDE_FUNCS = [
    slide01, slide02, slide03, slide04, slide05, slide06, slide07, slide08,
    slide09, slide10, slide11, slide12,
    make_qa_slide(0), make_qa_slide(1), make_qa_slide(2), make_qa_slide(3),
    slide17, slide18,
]


def main():
    assert len(SLIDE_FUNCS) == TOTAL, f"expected {TOTAL} slides, got {len(SLIDE_FUNCS)}"
    pages = []
    for i, fn in enumerate(SLIDE_FUNCS, start=1):
        img, d = new_slide()
        fn(img, d)
        check_slide(i)
        img.save(os.path.join(SLIDEDIR, f"slide-{i:02d}.png"))
        pages.append(img)
    pdf = os.path.join(OUTDIR, "mawzun-committee-deck.pdf")
    pages[0].save(pdf, "PDF", resolution=96.0, save_all=True, append_images=pages[1:])
    print(f"pages={len(pages)}")
    print(f"pdf={pdf} bytes={os.path.getsize(pdf)}")
    for k, v in dk.ISSUES.items():
        print(f"{k}: {len(v)}")
        for line in v[:20]:
            print("   ", line)
    print("OK" if all(len(v) == 0 for v in dk.ISSUES.values()) else "ISSUES PRESENT")


if __name__ == "__main__":
    main()
