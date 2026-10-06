import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";

import { StakesSection, SecuritySection, CTASection } from "@/components/home";
import { SectionDivider } from "@/components/home/SectionDivider";
import { AttorneyHero } from "@/components/home/AttorneyHero";
import { AttorneyTour } from "@/components/home/AttorneyTour";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * The practitioner pitch, on its own page: the app itself, page by page, then
 * the stakes and the security table, addressed to attorneys and their teams.
 * The homepage leads with the person waiting on a case and links here.
 *
 * Fully static: every section is presentational, so this prerenders and
 * revalidates on the public tree's default schedule.
 */

export const metadata: Metadata = withSocialCard({
  title: "Free PERM Case Management for Attorneys",
  description:
    "Enter a case's dates once and every PERM deadline, filing window and wage expiration is worked out, with reminders. Free for attorneys and their teams.",
  alternates: {
    canonical: "/for-attorneys",
  },
  openGraph: {
    ...openGraphBase,
    title: "Free PERM Case Management for Attorneys | PERM Tracker",
    description:
      "Every deadline computed per case, with reminders, calendar sync and a client-ready timeline. Free.",
    url: "/for-attorneys",
  },
}, "for-attorneys");

export default function ForAttorneysPage() {
  return (
    <>
      <AttorneyHero />
      <AttorneyTour />
      <StakesSection />
      <SectionDivider kind="ledger" fill="var(--muted)" />
      <SecuritySection />
      <SectionDivider kind="step" above="var(--muted)" fill="var(--primary)" />
      <CTASection />
    </>
  );
}
