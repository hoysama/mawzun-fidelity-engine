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
    <section className="relative isolate grid items-center gap-space-xl overflow-hidden rounded-2xl border border-outline-variant bg-linear-to-b from-moss-50 to-surface-container-lowest px-margin-desktop py-space-xl lg:grid-cols-2">
      {/* The band's soft moss glow, exactly as the previous build carried it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 end-[-8%] -z-10 h-72 w-72 rounded-pill bg-moss-100/70 blur-3xl"
      />
      <div className="flex flex-col gap-space-md">
        <h1 className={cx(t.hero, "text-balance text-on-surface")}>
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
              "inline-flex items-center rounded-pill bg-moss-600 px-space-xl py-3 font-semibold text-on-primary transition-colors hover:bg-moss-700",
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
