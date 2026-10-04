---
title: نظام التصميم
description: رموز التصميم في موزون — الألوان والطباعة والمسافات وأنصاف الأقطار والارتفاع.
order: 3
---

# نظام التصميم

نظام التصميم مطبَّق بالكامل كرموز (tokens) في [`src/app/globals.css`](https://github.com/Asrar-7r/mawzun-project/blob/main/src/app/globals.css)
داخل كتلة `@theme` (اصطلاح Tailwind v4). الأصل المرجعي في `stitch_mawzun/mawzun_semantic_guard/DESIGN.md`.

> **قاعدة ذهبية:** لا تُكتب قيم لون أو مقاس مباشرة في المكوّنات؛ استخدم دائماً أصناف الرموز
> (`bg-primary`, `text-headline-lg`, `p-space-md`…). راجع [ADR-0003](../adr/0003-design-tokens.md).

## الألوان

كل لون معرّف كمتغيّر `--color-*`، فيصبح صنفاً جاهزاً في Tailwind.

### الأدوار الأساسية

| الدور | الرمز | الاستخدام |
| --- | --- | --- |
| Primary | `#091426` / `bg-primary` | شرائط الأوامر، القسم النشط، الخواتيم |
| Primary container | `#1e293b` / `bg-primary-container` | خلفيات مميّزة عالية الثقة |
| Secondary | `#0058be` / `bg-secondary` | التنفيذ والقياس الحيّ: البؤر وحالة التشغيل |
| Tertiary | `#00301f` / `bg-tertiary` | حالة «متحقّق/موثّق» (الرقاقة الخضراء `tertiary-fixed`) |
| Error | `#ba1a1a` / `bg-error` | مخالفة القيود المعتمدة |
| Outline variant | `#c5c6cd` / `border-outline-variant` | الحدود الشعرية والفواصل |

### الأسطح

| الرمز | القيمة | الاستخدام |
| --- | --- | --- |
| `surface` | `#f8f9ff` | الخلفية العامة للتطبيق |
| `surface-container-lowest` | `#ffffff` | سطح البطاقات (الأبيض النقي) |
| `surface-container-low` | `#eff4ff` | أسطح ثانوية خفيفة |
| `surface-container` | `#e5eeff` | خلفيات الرقائق والعناصر المحايدة |
| `surface-container-high` | `#dce9ff` | حالات التحويم والحدود السميكة |
| `on-surface` | `#0b1c30` | النص الأساسي |
| `on-surface-variant` | `#45474c` | النص الثانوي |
| `outline` / `outline-variant` | `#75777d` / `#c5c6cd` | الحدود والفواصل |

### المعاني الوظيفية (خرائط في `parts.tsx`)

حالات الوقائع والحكم تُترجم إلى ألوان عبر خرائط مركزية لا عبر قيم مبعثرة:

- **متحقّق / محفوظ (`verified`):** خلفية `tertiary-fixed/40` ونص `on-tertiary-fixed-variant`.
- **يحتاج تعديل (`revision`):** خلفية `secondary-fixed` ونص `on-secondary-fixed-variant`.
- **انزياح / وقف (`escalate`):** خلفية `error-container` ونص `on-error-container`.

## الطباعة

الخطوط: **IBM Plex Sans Arabic** للنصوص (عبر `next/font/google`)، و**JetBrains Mono** للقياس
عن بُعد (المعرّفات والبصمات وأكواد الطبقات).

الأدوار الطباعية موحّدة في [`src/lib/typography.ts`](https://github.com/Asrar-7r/mawzun-project/blob/main/src/lib/typography.ts)
كخريطة `t`، تجمع عائلة الخط مع مقياس الحجم والارتفاع:

| الدور | الصنف | الحجم / الارتفاع |
| --- | --- | --- |
| `t.display` | `font-display-lg text-display-lg` | 30px / 38px |
| `t.h2` | `font-headline-lg text-headline-lg` | 22px / 28px |
| `t.h3` | `font-headline-md text-headline-md` | 18px / 24px |
| `t.h4` | `font-headline-sm text-headline-sm` | 15px / 20px |
| `t.bodyLg` | `font-body-lg text-body-lg` | 15px / 24px |
| `t.body` | `font-body-md text-body-md` | 13px / 20px |
| `t.bodySm` | `font-body-sm text-body-sm` | 12px / 18px |
| `t.label` | `font-label-lg text-label-lg` | 13px / 18px |
| `t.labelSm` | `font-label-md text-label-md` | 11px / 16px |
| `t.codeMd` | `font-code-md text-code-md` | 12px / 18px (JetBrains Mono) |
| `t.code` | `font-code-sm text-code-sm` | 10px / 14px (JetBrains Mono) |

ويُضيف `@theme` خطوة طباعية إضافية `display-lg-mobile` (24px / 32px، وزن 600) لعنوان الواجهة على
الجوال؛ هي رمز CSS في `globals.css` ولا يقابلها مفتاح في خريطة `t`.

```tsx
import { t } from "@/lib/typography";
<h2 className={t.h2}>عنوان</h2>
```

## المسافات

مقياس مخصّص: `space-xs` (0.25rem)، `space-sm` (0.5rem)، `space-md` (0.75rem)،
`space-lg` (1.25rem)، `space-xl` (2rem)، بالإضافة إلى `gutter` (1rem) و`gutter-desktop`
(1.5rem) و`margin` (1rem) و`margin-desktop` (2rem). تُستخدم كأصناف مثل `p-space-md`, `gap-space-sm`.

## أنصاف الأقطار

المقياس مُصدَّر من المرجع بقيم أصغر من افتراضات Tailwind: الأساس (`--radius`) و`radius-xs`
و`radius-sm` = 0.125rem، و`radius-md` = 0.375rem، و`radius-lg` = 0.25rem، و`radius-xl` = 0.5rem،
و`radius-full` = 0.75rem. فالأسماء ليست تصاعدية بالضرورة (`lg` أصغر من `md` في هذا المقياس)؛
التزم بالرموز كما هي. مع اصطلاح «الدقة اللينة»: لا أنصاف أقطار كبيرة تُذيب شبكة بيانات. بطاقات
الأقسام والألواح الخارجية تستخدم `rounded-xl` (0.5rem)، واللوحات الداخلية وحقول النص `rounded-lg`
(0.25rem)، والرقائق والأزرار والشرائح الصغيرة `rounded-xs` (0.125rem)، والنوافذ المنبثقة `rounded-2xl`.

## الارتفاع والعمق

تسلسل هرمي بالطبقات اللونية والحدود الشعرية (1px)، يُسندها ظل واحد خفيف: أُعيد `--shadow-sm`
إلى قيمته المرجعية الخفيفة `0 1px 2px 0 rgb(0 0 0 / 0.05)` فتحمله البطاقات إلى جانب الحدّ:

| المستوى | الوصف |
| --- | --- |
| Level 0 | القماش الأساسي `#f8f9ff` (مسطّح) |
| Level 1 | بطاقة بيضاء بحدّ شعري داخل مساحة العمل |
| Level 2 | لوحات مرتفعة بحدّ أوضح |
| Level 3 | النوافذ واللوائح (عبر `backdrop-blur`) |

## الشبكة والاستجابة

- حاوية المحتوى بعرض أقصى `7xl` عبر `mx-auto` داخل مساحة العمل.
- **سطح المكتب:** شريط علوي ثابت (64px) وقماش مرن؛ روابط الأقسام تظهر في الشريط.
- **الجوال:** تختفي روابط الأقسام من الشريط، ويُتصفّح عبر شريط المراحل القابل للتمرير أفقيًا
  وأزرار القفز، والألواح تصطفّ عموديًا.
