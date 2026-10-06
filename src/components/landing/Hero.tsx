import Link from "next/link";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { SourceEntry } from "@/components/landing/SourceEntry";

/**
 * The welcome hero: the product's one-line claim, a lead line, the single call
 * to action, and the source-text hand-off.
 *
 * A server component, so the copy and the claim ship as markup and only the
 * interactive field below crosses into the client bundle. The anchor carries
 * nothing but its own label — the icon font renders a ligature *name* as text,
 * so an icon inside it would put that name into the link's accessible name.
 */
export function Hero() {
  return (
    <section className="grid items-center gap-space-xl lg:grid-cols-2">
      <div className="flex flex-col gap-space-md">
        <h1 className={cx(t.display, "text-on-surface")}>
          نقيس أمانة النقل بين الأصل وما اشتُقّ منه
        </h1>
        <p className={cx(t.bodyLg, "max-w-prose text-on-surface-variant")}>
          ثلاث طبقات صارمة — حتمية، ومعجمية، ودلالية — ثم حكمٌ واحد بثلاث حالات، وسجلٌّ موثَّق
          بالبصمة قابلٌ لإعادة التشغيل.
        </p>
        <div>
          <Link
            href="/"
            className={cx(
              t.label,
              "inline-flex items-center rounded-xs bg-primary px-space-md py-2 font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container",
            )}
          >
            ابدأ الفحص
          </Link>
        </div>
      </div>

      <SourceEntry />
    </section>
  );
}
