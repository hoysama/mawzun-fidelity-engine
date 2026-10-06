import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { StatCards } from "@/components/landing/StatCards";
import { StepsSection } from "@/components/landing/StepsSection";

/**
 * The welcome route.
 *
 * A landing page for the audit workspace at `/`, assembled from server
 * components: the hero's only client island is the source-text field, which
 * writes the reviewer's text to session storage and hands it to the workspace
 * with a document navigation.
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
