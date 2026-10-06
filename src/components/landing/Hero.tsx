import Link from "next/link";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";

/**
 * The welcome hero: the product's one-line claim and lead line over a single
 * call to action into the audit workspace.
 *
 * The hero is purely introductory and holds no input: the reviewer types the
 * source text in the workspace, and only there. There is exactly one control,
 * and it points at the same destination the workspace always lived at — «ابدأ
 * الفحص» links to `/`, where the five-section check runs.
 *
 * A server component, so the copy, the claim and the action all ship as markup
 * and nothing on the landing crosses into the client bundle.
 */
export function Hero() {
  return (
    <section className="relative isolate flex flex-col items-center gap-space-lg overflow-hidden rounded-2xl border border-outline-variant bg-linear-to-b from-moss-50 to-surface-container-lowest px-margin-desktop py-space-xl text-center">
      {/* The band's soft moss glow, exactly as the previous build carried it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 end-[-8%] -z-10 h-72 w-72 rounded-pill bg-moss-100/70 blur-3xl"
      />
      <div className="flex max-w-3xl flex-col items-center gap-space-md">
        <h1 className={cx(t.hero, "text-balance text-on-surface")}>
          نقيس أمانة النقل بين الأصل وما اشتُقّ منه
        </h1>
        <p className={cx(t.bodyLg, "max-w-prose text-on-surface-variant")}>
          ثلاث طبقات صارمة — حتمية، ومعجمية، ودلالية — ثم حكمٌ واحد بثلاث حالات، وسجلٌّ موثَّق
          بالبصمة قابلٌ لإعادة التشغيل.
        </p>
      </div>

      <Link
        href="/"
        className={cx(
          t.label,
          "inline-flex items-center justify-center rounded-pill bg-moss-600 px-space-xl py-3 font-semibold text-on-primary transition-colors hover:bg-moss-700",
        )}
      >
        ابدأ الفحص
      </Link>
    </section>
  );
}
