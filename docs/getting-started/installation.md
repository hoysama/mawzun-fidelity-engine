---
title: التركيب والتشغيل
description: كيف تُثبّت اعتماديات موزون وتشغّل بيئة التطوير محلياً باستخدام Bun حصراً.
order: 1
---

# التركيب والتشغيل

## المتطلبات المسبقة

| المتطلب | الإصدار | ملاحظة |
| --- | --- | --- |
| [Bun](https://bun.sh/) | `1.4.2` | مدير الحزم الوحيد المسموح به |
| Node.js | `>= 20` | مطلوب فقط لبعض أدوات البناء |
| Git | أي إصدار حديث | لإدارة الفروع والوسوم |

> **تحذير:** هذا المستودع **Bun فقط**. استخدام `npm` أو `yarn` أو `pnpm` ممنوع،
> وحارس `preinstall` في [`scripts/ensure-bun.mjs`](https://github.com/Asrar-7r/mawzun-project/blob/main/scripts/ensure-bun.mjs)
> يُوقف أي عملية تثبيت تبدأ من مدير حزم آخر.

## الخطوات

```bash
# 1. استنساخ المستودع
git clone https://github.com/Asrar-7r/mawzun-project.git
cd mawzun-project

# 2. تثبيت الاعتماديات بـ Bun
bun install

# 3. تشغيل خادم التطوير
bun dev
```

ثم افتح [http://localhost:3000](http://localhost:3000) في المتصفح. تعرض الصفحة الجذرية `/`
**مساحة العمل كاملة في صفحة واحدة**: خمسة أقسام مرقّمة (`#step-1` … `#step-5`) بلا مسارات
مراحل ولا شريط جانبي. انظر [التوجيه والأقسام](../architecture/routing-and-stages.md).

## كيف يفرض المشروع Bun؟

- `package.json` يثبّت الأداة عبر `"packageManager": "bun@1.4.2"`.
- ملف القفل المرجعي هو `bun.lock` (مُلتزم به). لا يوجد `package-lock.json` ولا `yarn.lock`.
- سكربت `preinstall` يتحقق من متغيّر البيئة `npm_config_user_agent` ويرفض التثبيت إن بدأ من npm/yarn/pnpm.

## بعد التثبيت

التحقق من سلامة البيئة والمنطق:

```bash
bun run lint         # فحص ESLint على كامل الكود
bun run docs:check   # سلامة التوثيق: ترويسات + ترتيب + روابط
bun run engine:check # تحقق سلوكي من محرك الفحص
```

راجع [الأوامر والسكربتات](./scripts.md) لبقية الأوامر، و
[الخطوات التالية](#الخطوات-التالية) لبدء التطوير.

## الخطوات التالية

1. اطّلع على [بنية المشروع](./project-structure.md).
2. اقرأ [الاصطلاحات البرمجية](../reference/conventions.md) قبل كتابة أي كود.
3. راجع [مسار التدقيق](../workflow/audit-pipeline.md) لفهم منطق الفحص.

## استكشاف الأخطاء

- **فشل التثبيت برسالة Bun-only:** تأكد أنك تستخدم `bun install` وليس `npm install`.
- **اختلاف ملف القفل:** لا تُنشئ أبداً `package-lock.json`؛ شغّل `bun install` فقط.
- **تعذّر الإقلاع:** تأكد من خلو المنفذ `3000`؛ غيّره عبر `bun dev -- -p 3001`.
