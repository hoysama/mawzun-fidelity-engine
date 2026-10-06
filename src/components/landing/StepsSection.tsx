import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";

/**
 * The three real layers, in order, over one stats row.
 *
 * The layers are the product's own pipeline, not a marketing sequence: the
 * first two are lookups over imported tables and the third is a model's
 * structured findings, gated on the quotation actually appearing in the text.
 * Every figure in the row below is a declared count from the same records.
 */

const STEPS = [
  {
    ordinal: "١",
    title: "الطبقة الحتمية",
    body: "الأرقام والإحالات وألفاظ درجة الثبوت، والمطابقة الحرفية للاقتباس القرآني — بحث ومطابقة بلا نموذج.",
  },
  {
    ordinal: "٢",
    title: "الطبقة المعجمية",
    body: "المسرد والمصطلح، وقوة الحكم، وأدوات الشرط — بحثًا في جداول معتمدة لا في تخمين.",
  },
  {
    ordinal: "٣",
    title: "الطبقة الدلالية",
    body: "وقائع منظّمة من نموذج، وكل اقتباس يُتحقَّق من وجوده في النص حرفيًا قبل أن يُقبل.",
  },
];

const FIGURES = [
  { value: "٣", label: "طبقات فحص" },
  { value: "٢", label: "طبقتان حتميتان" },
  { value: "٣", label: "حالات للحكم" },
  { value: "٤", label: "مستويات للمحتوى" },
  { value: "٧", label: "بوابات في خط البناء" },
  { value: "٠", label: "اقتباس مُختلَق مقبول" },
];

export function StepsSection() {
  return (
    <section className="flex flex-col gap-space-lg">
      <h2 className={cx(t.h2, "text-on-surface")}>ثلاث طبقات، ثم حكم واحد</h2>

      <ol className="grid gap-space-lg md:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.ordinal}
            className="flex flex-col gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm"
          >
            <span
              className={cx(
                t.codeMd,
                "flex h-7 w-7 items-center justify-center rounded-pill bg-moss-600 text-on-primary",
              )}
            >
              {step.ordinal}
            </span>
            <h3 className={cx(t.h4, "text-on-surface")}>{step.title}</h3>
            <p className={cx(t.bodySm, "text-on-surface-variant")}>{step.body}</p>
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-2 gap-space-md rounded-xl border border-moss-200 bg-moss-50 p-space-lg md:grid-cols-3 lg:grid-cols-6">
        {FIGURES.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-space-xs">
            <dt className={cx(t.bodySm, "text-moss-700")}>{figure.label}</dt>
            <dd className={cx(t.stat, "text-moss-800")}>{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
