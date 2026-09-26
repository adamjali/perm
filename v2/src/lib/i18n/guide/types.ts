import type { ReactNode } from "react";

import type { CountryKey } from "@/lib/perm";
import type { GuideCategory } from "../cutoffs";

/**
 * Everything a localized guide says, in one typed object per language, so a
 * language cannot ship with a section missing: TypeScript refuses it.
 *
 * Interpolated figures arrive as nodes the page has already formatted in the
 * reader's locale and wrapped in `translate="no"`; the copy only places them.
 */

/** DOL's PERM status words the guide explains, spelled exactly as FLAG shows them. */
export const GLOSSED_STATUSES = [
  "ANALYST REVIEW",
  "APPLICATION ON HOLD",
  "RFI ISSUED",
  "PENDING AUDIT RESPONSE",
  "SUPERVISED RECRUITMENT",
  "NORD ISSUED",
  "RECONSIDERATION APPEALS",
  "BALCA APPEALS",
  "CERTIFIED",
  "CERTIFIED - EXPIRED",
  "DENIED",
  "WITHDRAWN",
] as const;
export type GlossedStatus = (typeof GLOSSED_STATUSES)[number];

export const SECTION_IDS = ["check", "queue", "steps", "eb3-other-workers", "cutoffs", "statuses"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface GuideCopy {
  /** The <title>, before the site's " | PERM Tracker". */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lede: ReactNode;
  translationNote: ReactNode;
  onThisPage: string;
  toc: Record<SectionId, string>;
  check: {
    h2: string;
    intro: ReactNode;
    label: string;
    button: string;
    formats: ReactNode;
    after: ReactNode;
    noNumber: ReactNode;
  };
  queue: {
    h2: string;
    permLabel: string;
    averageLabel: string;
    /** "{n} days", with the number already formatted. */
    days: (n: ReactNode) => ReactNode;
    pwdLabel: string;
    asOf: (date: ReactNode) => ReactNode;
    missing: ReactNode;
    meaning: ReactNode[];
  };
  steps: {
    h2: string;
    intro: ReactNode;
    items: Array<{ form: string; name: string; body: ReactNode }>;
    skipPerm: ReactNode;
  };
  ew3: { h2: string; body: ReactNode[] };
  cutoffs: {
    h2: string;
    intro: (bulletinMonth: ReactNode) => ReactNode;
    birth: ReactNode;
    head: { category: string; finalAction: string; datesForFiling: string };
    countryName: Partial<Record<CountryKey, string>>;
    category: Record<GuideCategory, string>;
    /** Glosses printed after the bulletin's own letter. */
    current: string;
    unavailable: string;
    notPrinted: string;
    legend: ReactNode[];
    missing: ReactNode;
  };
  statuses: { h2: string; intro: ReactNode; gloss: Record<GlossedStatus, string> };
  limits: { h2: string; items: ReactNode[] };
  more: { h2: string; links: Array<{ href: string; label: string }> };
}
