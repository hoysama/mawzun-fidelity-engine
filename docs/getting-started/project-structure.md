---
title: بنية المشروع
description: خريطة المجلدات والملفات في موزون ومسؤولية كل جزء منها.
order: 2
---

# بنية المشروع

```text
mawzun-project/
├── docs/                     # ← هذا التوثيق (مصدر الحقيقة)
├── public/                   # الأصول الثابتة
├── scripts/
│   ├── ensure-bun.mjs        # حارس يمنع npm/yarn/pnpm
│   ├── check-docs.mjs        # فحص التوثيق (docs:check)
│   └── engine-check.ts       # التحقق السلوكي من المحرك (engine:check)
├── src/
│   ├── app/                  # App Router
│   │   ├── globals.css       # رموز التصميم (@theme) ونمط الجذر
│   │   ├── layout.tsx        # الجذر: RTL + الخطوط + AppShell + AuditProvider
│   │   ├── page.tsx          # الصفحة الوحيدة: AuditWorkspace
│   │   └── api/audit/
│   │       └── route.ts      # POST /api/audit (سلسلة نماذج L3 عبر مزوّدين)
│   ├── components/
│   │   ├── audit/            # مساحة العمل: AuditWorkspace، الأقسام الخمسة، parts
│   │   ├── layout/           # AppShell, TopBar, SearchModal, SettingsModal
│   │   └── ui/               # Icon (العناصر الأساسية المتبقية)
│   ├── context/
│   │   ├── AuditContext.tsx  # حالة الفحص والسجل والتحقق
│   │   └── ToastContext.tsx  # الإشعارات العابرة
│   └── lib/
│       ├── audit/            # محرّك الفحص ثلاثي الطبقات
│       │   ├── constraint-bank.ts     # القيود الـ20 وأصولها
│       │   ├── ruling-strength.ts     # جدول قوة الحكم
│       │   ├── layer1-deterministic.ts
│       │   ├── layer2-lexical.ts
│       │   ├── layer3-semantic.ts
│       │   ├── verdict.ts             # الحكم ثلاثي الحالات
│       │   ├── record.ts              # السجل المختوم
│       │   ├── normalize.ts           # مفتاح المقارنة العربية
│       │   ├── layer-context.ts
│       │   ├── types.ts
│       │   └── index.ts               # runAudit
│       ├── cx.ts             # دمج أسماء أصناف Tailwind
│       ├── stages.ts         # مصدر حقيقة الأقسام الخمسة
│       └── typography.ts     # أدوار الطباعة
├── stitch_mawzun/            # مراجع تصميم Stitch الأصلية
│   └── mawzun_semantic_verification_system/   # التصدير الذي وُلدت منه رموز التصميم الحالية
├── archive/                  # تُنشأ عند الحاجة: نسخ ما قبل التعديل (غير متعقَّبة في Git)
├── AGENTS.md                 # القواعد الإلزامية
├── wrangler.jsonc            # تكوين Cloudflare (ربط AI)
└── bun.lock                  # ملف القفل المرجعي
```

## المجلدات المحورية

### `src/app/`
يعتمد على **App Router** في Next.js 16، لكن لا مسارات مراحل: `page.tsx` تُصيّر مساحة العمل
كاملة، و`layout.tsx` يمرّر الحالة ويغلّف بالهيكل. المسار الوحيد على الخادم هو `api/audit`.
التنسيقات العامة ورموز التصميم في [globals.css](../architecture/design-system.md).

### `src/components/`
- **`audit/`** — مساحة العمل والقسم الواحد: `AuditWorkspace`, `InputSection`, `ConstraintsSection`,
  `PipelineSection`, `VerdictSection`, `LedgerSection`, و`parts.tsx` بالأساس المشترك.
- **`layout/`** — الهيكل الثابت المشترك (`AppShell`, `TopBar`) والنوافذ (`SearchModal`, `SettingsModal`).
- **`ui/`** — عنصر أساسي محايد متبقٍّ (`Icon`). الألواح والرقائق في مساحة العمل مبنيّة في
  `components/audit/parts.tsx`.

### `src/lib/`
- **`audit/`** — المحرك كله: بنك القيود، جدول قوة الحكم، الطبقات 1–3، الحكم، السجل، والموحّد.
  نقطة الدخول `runAudit`. راجع [مسار التدقيق](../workflow/audit-pipeline.md).
- **`stages.ts`** — مصدر الحقيقة الوحيد للأقسام الخمسة ومراسيها، يستهلكه الشريط العلوي وشريط
  المراحل والبحث. راجع [التوجيه والأقسام](../architecture/routing-and-stages.md).

### `stitch_mawzun/`
مراجع التصميم الأصلية المُصدَّرة من Stitch. التصدير الذي وُلدت منه رموز التصميم المستخدمة
اليوم هو `mawzun_semantic_verification_system/` وفيه `DESIGN.md` و`code.html` و`screen.png`،
وهو المرجع الذي تشير إليه تعليقات `src/app/globals.css` و`src/components/audit/parts.tsx`.
التصديرات الأخرى (`mawzun_1` إلى `mawzun_6`) محفوظة كتاريخ تصميمي.

### `archive/`
لقطات الملفات قبل أي تعديل أو حذف، منظّمة بتاريخ `YYYYMMDD`. إلزامية وفق
[قواعد المشروع](../reference/conventions.md#الوسوم-والأرشفة). المجلد **غير متعقَّب في Git**
ولا يُنشأ إلا عند أخذ لقطة، فهو لا يظهر في شجرة المستودع المستنسخة.

## ما ليس مضمّناً في Git

`.gitignore` يستثني `node_modules/`, `.next/`, `.open-next/`, `out/`, `build/`, `.env*`، ويستثني
ESLint صراحةً مجلدات البناء (`.next/`, `.open-next/`, `out/`, `build/`) و`archive/`، ويتجاهل
`node_modules/` افتراضيًا. راجع `eslint.config.mjs` و`.gitignore` للتفصيل.
