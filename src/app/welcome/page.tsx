import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { StatCards } from "@/components/landing/StatCards";
import { StepsSection } from "@/components/landing/StepsSection";

/**
 * The welcome route.
 *
 * A purely introductory landing page for the audit workspace at `/`, assembled
 * from server components: it holds no input at all. The hero carries a single
 * link into the workspace, where the reviewer types the source text.
 */
export const metadata: Metadata = {
  title: "موزون | مقياس أمانة النقل",
  description:
    "نقيس أمانة النقل بين النص الأصلي وما اشتُقّ منه: ثلاث طبقات — حتمية ومعجمية ودلالية — وحكم واحد بثلاث حالات، مع سجلٍّ موثَّق بالبصمة.",
};

export default function Welcome() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-space-xl py-space-xl">
      <Hero />
      <StatCards />
      <StepsSection />
    </div>
  );
}
