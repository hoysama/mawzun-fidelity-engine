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
| مطوّراً جديداً يشغّل المشروع أول مرة | [التركيب والتشغيل](/docs/getting-started/installation) |
| تبحث عن خريطة المجلدات والملفات | [بنية المشروع](/docs/getting-started/project-structure) |
| تريد معرفة الأوامر المتاحة | [الأوامر والسكربتات](/docs/getting-started/scripts) |
| تريد تشغيل الفحص ومعرفة حدوده خطوة بخطوة | [التشغيل والحدود](/docs/getting-started/operation-and-limits) |
| مهتماً بالمعمارية العامة | [النظرة المعمارية العامة](/docs/architecture/overview) |
| تريد مراجعة نظام التصميم والرموز | [نظام التصميم](/docs/architecture/design-system) |
| تريد فهم الصفحة الواحدة والأقسام المرقّمة | [التوجيه والأقسام](/docs/architecture/routing-and-stages) |
| تريد كتالوج المكوّنات وواجهاتها | [المكوّنات](/docs/architecture/components) |
| تريد فهم توثيق Markdown وفحص `docs:check` | [محرك التوثيق](/docs/architecture/docs-engine) |
| تريد فهم ما الذي يقيسه موزون وحدوده | [فحص أمانة النقل](/docs/workflow/fidelity-audit) |
| تريد تفصيل مسار الفحص خطوة بخطوة | [مسار التدقيق](/docs/workflow/audit-pipeline) |
| تريد فلسفة الضبط ومنع الانزياح | [مبدأ الحماية الدلالية](/docs/workflow/semantic-guard) |
| تريد معرفة من أين يُسترجع النصّ المعتمد وكيف تُسند كل نتيجة | [الاسترجاع والإحالات](/docs/workflow/rag-retrieval) |
| تكتب كوداً وتريد الاصطلاحات الملزمة | [الاصطلاحات البرمجية](/docs/reference/conventions) |
| تبحث عن معنى مصطلح عربي/إنجليزي | [المسرد](/docs/reference/glossary) |
| تريد معرفة المصادر الشرعية والتراخيص | [سجل المصادر والأدوات والتراخيص](/docs/reference/sources-and-licences) |
| تريد حالة المصادر المعتمدة التسعة وسياسات استخدامها | [سجل مصادر الاسترجاع وحالاتها](/docs/reference/rag-sources) |
| تريد الأرقام: كيف يُقاس الأداء وما النتائج | [قياس أمانة النقل](/docs/reference/measurement) |
| تريد مطابقة المعايير الملزمة الثمانية بمواضعها من موزون | [مطابقة المعيار العلمي الملزم](/docs/reference/binding-standard) |
| تريد حالة كل مخرج من مخرجات التسليم | [قائمة جاهزية التسليم](/docs/reference/submission-checklist) |

## أقسام التوثيق

- **البداية السريعة (`getting-started/`)** — [التركيب والتشغيل](/docs/getting-started/installation)،
  [بنية المشروع](/docs/getting-started/project-structure)، [الأوامر والسكربتات](/docs/getting-started/scripts)،
  [التشغيل والحدود](/docs/getting-started/operation-and-limits).
- **المعمارية (`architecture/`)** — [النظرة العامة](/docs/architecture/overview)،
  [التوجيه والأقسام](/docs/architecture/routing-and-stages)، [نظام التصميم](/docs/architecture/design-system)،
  [المكوّنات](/docs/architecture/components)، [محرك التوثيق](/docs/architecture/docs-engine).
- **سير العمل (`workflow/`)** — [فحص أمانة النقل](/docs/workflow/fidelity-audit)،
  [مسار التدقيق](/docs/workflow/audit-pipeline)، [مبدأ الحماية الدلالية](/docs/workflow/semantic-guard)،
  [الاسترجاع والإحالات](/docs/workflow/rag-retrieval).
- **المراجع (`reference/`)** — [الاصطلاحات البرمجية](/docs/reference/conventions)،
  و[المسرد ثنائي اللغة](/docs/reference/glossary)،
  و[سجل المصادر والأدوات والتراخيص](/docs/reference/sources-and-licences)،
  و[سجل مصادر الاسترجاع وحالاتها](/docs/reference/rag-sources)،
  و[مطابقة المعيار العلمي الملزم](/docs/reference/binding-standard).
- **سجلات القرارات (`adr/`)** — [Bun حصراً](/docs/adr/0001-bun-only)،
  [RTL أولاً](/docs/adr/0002-rtl-first)، [رموز التصميم](/docs/adr/0003-design-tokens).

## قواعد إلزامية مختصرة

1. **مدير الحزم: Bun حصراً** — لا `npm`/`yarn`/`pnpm`. انظر [ADR-0001](/docs/adr/0001-bun-only).
2. **فرع `main` محمي** — كل تغيير غير توثيقي يبدأ من فرع مستقل.
3. **وسم وأرشفة قبل أي تعديل أو حذف** — راجع [الاصطلاحات](/docs/reference/conventions).

القواعد الكاملة والمُلزمة موجودة في [`AGENTS.md`](https://github.com/Asrar-7r/mawzun-project/blob/main/AGENTS.md).
