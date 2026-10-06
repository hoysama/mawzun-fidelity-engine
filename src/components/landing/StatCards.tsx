import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";

/**
 * Two dashboard cards for the only figures the product actually holds.
 *
 * There is no time series anywhere in the records, so the charts do not draw
 * one: each shows achieved against total, labelled «المحقَّق» and «الإجمالي».
 * The headline card reports a benchmark result — ٣٦ of ٣٧ on the test corpus —
 * and is captioned as one; nothing here is a growth rate, a customer count or a
 * year. The second card reports the engine's own checks, ٦١ of ٦١.
 */

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Render a Latin integer with the Arabic-Indic digits the copy uses. */
function ar(value: number): string {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

/** Achieved / total as two bars: the achieved filled, the total as a track. */
function MiniBars({ achieved, total, label }: { achieved: number; total: number; label: string }) {
  const height = 40;
  const scale = Math.max(total, 1);
  const bar = (value: number) => Math.max(2, Math.round((value / scale) * height));

  return (
    <svg viewBox="0 0 72 44" role="img" aria-label={label} className="h-11 w-[72px] shrink-0">
      <rect
        x="6"
        y={height - bar(achieved)}
        width="24"
        height={bar(achieved)}
        rx="2"
        fill="var(--color-primary)"
      />
      <rect
        x="42"
        y={height - bar(total)}
        width="24"
        height={bar(total)}
        rx="2"
        fill="var(--color-surface-container-high)"
        stroke="var(--color-outline-variant)"
      />
    </svg>
  );
}

function StatCard({
  title,
  value,
  caption,
  achieved,
  total,
}: {
  title: string;
  value: string;
  caption: string;
  achieved: number;
  total: number;
}) {
  const series = `المحقَّق ${ar(achieved)} من الإجمالي ${ar(total)}`;

  return (
    <article className="flex flex-col gap-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
      <span className={cx(t.label, "font-semibold text-on-surface")}>{title}</span>

      <div className="flex items-end justify-between gap-space-md">
        <span className={cx(t.display, "text-primary")}>{value}</span>
        <MiniBars achieved={achieved} total={total} label={series} />
      </div>

      <div className={cx(t.code, "flex items-center justify-between text-on-surface-variant")}>
        <span className="flex items-center gap-space-xs">
          <span className="h-2 w-2 rounded-full bg-primary" />
          المحقَّق {ar(achieved)}
        </span>
        <span className="flex items-center gap-space-xs">
          <span className="h-2 w-2 rounded-full bg-surface-container-high ring-1 ring-outline-variant" />
          الإجمالي {ar(total)}
        </span>
      </div>

      <p className={cx(t.bodySm, "border-t border-outline-variant pt-space-sm text-on-surface-variant")}>
        {caption}
      </p>
    </article>
  );
}

export function StatCards() {
  return (
    <section className="grid gap-space-lg md:grid-cols-2">
      <StatCard
        title="نتيجة معيارية"
        value="٩٧٪"
        caption="٣٦ من ٣٧ في متن الاختبار المعياري"
        achieved={36}
        total={37}
      />
      <StatCard
        title="اختبارات المحرك"
        value="٦١/٦١"
        caption="٦١ من ٦١ اختبارًا في خط الفحص"
        achieved={61}
        total={61}
      />
    </section>
  );
}
