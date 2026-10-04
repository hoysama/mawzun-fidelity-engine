---
title: فهرس التوثيق
description: خريطة شاملة لتوثيق منصة موزون — نقطة البداية لكل ما تحتاجه لفهم النظام والمساهمة فيه.
order: 0
---

# توثيق موزون

مرحباً بك في مركز توثيق **موزون | مقياس أمانة النقل**. هذه الوثائق هي المصدر الرسمي
المعتمد لفهم معمارية الصفحة الواحدة، ومحرك الفحص ثلاثي الطبقات، والحكم المختوم القابل
لإعادة التشغيل، وقواعد المساهمة.

> محتوى هذا المجلد (`docs/`) هو **مصدر الحقيقة الوحيد** للتوثيق. تُقرأ الملفات مباشرة على
> GitHub؛ ولا يوجد مركز توثيق داخل التطبيق (`/docs`) بعد الآن — أُزيل مع مسارات المراحل.

## من أين أبدأ؟

| إن كنت… | فابدأ من |
| --- | --- |
| مطوّراً جديداً يشغّل المشروع أول مرة | [التركيب والتشغيل](./getting-started/installation.md) |
| تبحث عن خريطة المجلدات والملفات | [بنية المشروع](./getting-started/project-structure.md) |
| تريد معرفة الأوامر المتاحة | [الأوامر والسكربتات](./getting-started/scripts.md) |
| تريد تشغيل الفحص ومعرفة حدوده خطوة بخطوة | [التشغيل والحدود](./getting-started/operation-and-limits.md) |
| مهتماً بالمعمارية العامة | [النظرة المعمارية العامة](./architecture/overview.md) |
| تريد مراجعة نظام التصميم والرموز | [نظام التصميم](./architecture/design-system.md) |
| تريد فهم الصفحة الواحدة والأقسام المرقّمة | [التوجيه والأقسام](./architecture/routing-and-stages.md) |
| تريد كتالوج المكوّنات وواجهاتها | [المكوّنات](./architecture/components.md) |
| تريد فهم توثيق Markdown وفحص `docs:check` | [محرك التوثيق](./architecture/docs-engine.md) |
| تريد فهم ما الذي يقيسه موزون وحدوده | [فحص أمانة النقل](./workflow/fidelity-audit.md) |
| تريد تفصيل مسار الفحص خطوة بخطوة | [مسار التدقيق](./workflow/audit-pipeline.md) |
| تريد فلسفة الضبط ومنع الانزياح | [مبدأ الحماية الدلالية](./workflow/semantic-guard.md) |
| تريد معرفة من أين يُسترجع النصّ المعتمد وكيف تُسند كل نتيجة | [الاسترجاع والإحالات](./workflow/rag-retrieval.md) |
| تكتب كوداً وتريد الاصطلاحات الملزمة | [الاصطلاحات البرمجية](./reference/conventions.md) |
| تبحث عن معنى مصطلح عربي/إنجليزي | [المسرد](./reference/glossary.md) |
| تريد معرفة المصادر الشرعية والتراخيص | [سجل المصادر والأدوات والتراخيص](./reference/sources-and-licences.md) |
| تريد حالة المصادر المعتمدة التسعة وسياسات استخدامها | [سجل مصادر الاسترجاع وحالاتها](./reference/rag-sources.md) |
| تريد الأرقام: كيف يُقاس الأداء وما النتائج | [قياس أمانة النقل](./reference/measurement.md) |
| تريد مطابقة المعايير الملزمة الثمانية بمواضعها من موزون | [مطابقة المعيار العلمي الملزم](./reference/binding-standard.md) |
| تريد حالة كل مخرج من مخرجات التسليم | [قائمة جاهزية التسليم](./reference/submission-checklist.md) |

## أقسام التوثيق

- **البداية السريعة (`getting-started/`)** — [التركيب والتشغيل](./getting-started/installation.md)،
  [بنية المشروع](./getting-started/project-structure.md)، [الأوامر والسكربتات](./getting-started/scripts.md)،
  [التشغيل والحدود](./getting-started/operation-and-limits.md).
- **المعمارية (`architecture/`)** — [النظرة العامة](./architecture/overview.md)،
  [التوجيه والأقسام](./architecture/routing-and-stages.md)، [نظام التصميم](./architecture/design-system.md)،
  [المكوّنات](./architecture/components.md)، [محرك التوثيق](./architecture/docs-engine.md).
- **سير العمل (`workflow/`)** — [فحص أمانة النقل](./workflow/fidelity-audit.md)،
  [مسار التدقيق](./workflow/audit-pipeline.md)، [مبدأ الحماية الدلالية](./workflow/semantic-guard.md)،
  [الاسترجاع والإحالات](./workflow/rag-retrieval.md).
- **المراجع (`reference/`)** — [الاصطلاحات البرمجية](./reference/conventions.md)،
  و[المسرد ثنائي اللغة](./reference/glossary.md)،
  و[سجل المصادر والأدوات والتراخيص](./reference/sources-and-licences.md)،
  و[سجل مصادر الاسترجاع وحالاتها](./reference/rag-sources.md)،
  و[مطابقة المعيار العلمي الملزم](./reference/binding-standard.md).
- **سجلات القرارات (`adr/`)** — [Bun حصراً](./adr/0001-bun-only.md)،
  [RTL أولاً](./adr/0002-rtl-first.md)، [رموز التصميم](./adr/0003-design-tokens.md).

## قواعد إلزامية مختصرة

1. **مدير الحزم: Bun حصراً** — لا `npm`/`yarn`/`pnpm`. انظر [ADR-0001](./adr/0001-bun-only.md).
2. **فرع `main` محمي** — كل تغيير غير توثيقي يبدأ من فرع مستقل.
3. **وسم وأرشفة قبل أي تعديل أو حذف** — راجع [الاصطلاحات](./reference/conventions.md).

القواعد الكاملة والمُلزمة موجودة في [`AGENTS.md`](https://github.com/Asrar-7r/mawzun-project/blob/main/AGENTS.md).
