---
title: التوجيه والأقسام
description: كيف تعمل الصفحة الواحدة في موزون، وكيف تُشتق الأقسام الخمسة ومراسيها من مصدر حقيقة واحد.
order: 2
---

# التوجيه والأقسام

## التوجيه (App Router)

يعتمد المشروع على App Router في Next.js 16، لكن التنقّل اليوم لا يعتمد على مسارات مراحل:

- `src/app/page.tsx` هي الصفحة الوحيدة، وتُصيّر `AuditWorkspace` — وهي مساحة العمل كاملة.
- `layout.tsx` الجذري يُغلّف كل الصفحات بـ [`AppShell`](/docs/architecture/components#appshell)
  (شريط علوي فقط، بلا شريط جانبي) ويمرّر حالة الفحص عبر `AuditProvider`.
- `src/app/api/audit/route.ts` هو مسار الخادم الوحيد: `POST /api/audit`، يخدم الطبقة الدلالية
  («L3») وحدها بسلسلة نماذج **عبر مزوّدين** («OpenRouter» وربط «Cloudflare Workers AI»).

لا توجد مسارات مثل `/01-input` أو `/06-results`، ولا يوجد مركز توثيق `/docs` داخل التطبيق.

> **اصطلاح Next.js 16:** تُقرأ وسائط المسار كـ **Promise** وتُفكّ بـ `await`، كما في نوع
> الصفحة `LayoutProps<'/'>`.

## مصدر الحقيقة للأقسام: `src/lib/stages.ts`

ملف واحد يُعرّف الأقسام الخمسة في مصفوفة `STAGES` ثابتة (`readonly`)، ولكل قسم معرّف قسم
(`id`) هو مرساته، وترتيب، وعنوان، وأيقونتان:

```ts
export const STAGES: readonly Stage[] = [
  { id: "step-1", ordinal: "01", title: "الإدخال والتوصيف", icon: "edit_note", doneIcon: "check_circle" },
  { id: "step-2", ordinal: "02", title: "القيود المعتمدة", icon: "rule_folder", doneIcon: "check_circle" },
  { id: "step-3", ordinal: "03", title: "الفحص ثلاثي الطبقات", icon: "fact_check", doneIcon: "check_circle" },
  { id: "step-4", ordinal: "04", title: "الحكم التقريري", icon: "gavel", doneIcon: "check_circle" },
  { id: "step-5", ordinal: "05", title: "الشهادة والسجل", icon: "verified", doneIcon: "verified" },
] as const;
```

### الصادرات

`stages.ts` لا يُصدر دوال مساعدة ولا ثوابت أطراف: صادراته هي النوع `Stage` والمصفوفة الثابتة
`STAGES` فحسب. فالمرساة تُبنى عند الاستهلاك كـ ``#${stage.id}``، وترتيب القسم يُحسب محليًا بـ
`STAGES.findIndex((s) => s.id === id)` بدل دالة مشتركة. راجع
[`parts.tsx`](/docs/architecture/components#shared-primitives-partsttsx) حيث يُبنى `Stepper`،
و`TopBar` حيث تُختار روابط التنقّل الأربعة من `STAGES` بالفهرس.

### من يستهلكها؟

- [`Stepper`](/docs/architecture/components#stepper) — يبني شريط المراحل ويحسب الحالة النشطة.
- [`TopBar`](/docs/architecture/components#topbar) — يبني روابط التنقّل إلى المراسي.
- `SearchModal` — يدرج الأقسام الخمسة في نتائج البحث.

ولأن الجميع يقرأ من نفس المصفوفة، فإضافة قسم واحد تنعكس فورًا على الواجهات كلها.

## الأقسام الخمسة

| # | المرساة | القسم | المكوّن |
| --- | --- | --- | --- |
| 01 | `#step-1` | الإدخال والتوصيف | [`InputSection`](/docs/architecture/components#inputsection) |
| 02 | `#step-2` | القيود المعتمدة | [`ConstraintsSection`](/docs/architecture/components#constraintssection) |
| 03 | `#step-3` | الفحص ثلاثي الطبقات | [`PipelineSection`](/docs/architecture/components#pipelinesection) |
| 04 | `#step-4` | الحكم التقريري | [`VerdictSection`](/docs/architecture/components#verdictsection) |
| 05 | `#step-5` | الشهادة والسجل | [`LedgerSection`](/docs/architecture/components#ledgersection) |

`AuditWorkspace` يزرع الأقسام الخمسة بالترتيب داخل حاوية واحدة، ويعرض فوقها شريط جلسة يحمل
`Stepper`. يُبرز القسم النشط عبر `IntersectionObserver` لا عبر مستمع تمرير.

## إضافة قسم جديد

1. أضف عنصرًا إلى `STAGES` بالترتيب الصحيح (`id`, `ordinal`, `title`, `icon`, `doneIcon`).
2. أنشئ مكوّن القسم، واستدعِه في `AuditWorkspace` بوسم يحمل `id={stage.id}`.
3. لا حاجة لتعديل التنقّل — يُحدَّث تلقائيًا من المصفوفة.

راجع [بنية المشروع](/docs/getting-started/project-structure) لموقع هذه الملفات، و
[محرك التوثيق](/docs/architecture/docs-engine) لتفصيل كتابة التوثيق وفحصه.
