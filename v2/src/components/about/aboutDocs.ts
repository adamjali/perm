/**
 * The real pages the site reads, and the forms a case moves through, shown on
 * the About page (owner, Oct 27 2026: one picture in the hero, the portrait;
 * these six sit with the sources, large enough to read). Every page is the
 * agency's own (federal works, 17 U.S.C. 105), captured for the guides and the
 * homepage's road.
 */
export interface AboutDoc {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Who publishes it, and the page or form, on the label under it. Form numbers use a non-breaking hyphen. */
  agency: string;
  page: string;
}

export const ABOUT_DOCS: AboutDoc[] = [
  {
    src: "/images/content/figures/guides/how-the-perm-queue-works-dol-page.webp",
    width: 1600,
    height: 625,
    alt: "DOL's PERM processing times page: the filing month its analysts are working on and its average wait, as DOL publishes them.",
    agency: "DOL",
    page: "Processing times",
  },
  {
    src: "/images/content/figures/guides/perm-rfi-issued-what-to-do-flag-rfi-status.webp",
    width: 1600,
    height: 1173,
    alt: "DOL's case status search on flag.dol.gov, answering RFI ISSUED for one LinkedIn Corporation PERM case.",
    agency: "DOL",
    page: "Case status search",
  },
  {
    src: "/images/road/visa-bulletin-oct-2026.webp",
    width: 560,
    height: 486,
    alt: "The final action dates chart for employment-based cases in the State Department's October 2026 visa bulletin.",
    agency: "State Dept.",
    page: "Visa bulletin",
  },
  {
    src: "/images/road/eta-9089.webp",
    width: 560,
    height: 449,
    alt: "The first page of Form ETA-9089, Application for Permanent Employment Certification.",
    agency: "DOL",
    page: "Form ETA‑9089",
  },
  {
    src: "/images/road/eta-9141.webp",
    width: 560,
    height: 449,
    alt: "The first page of Form ETA-9141, Application for Prevailing Wage Determination.",
    agency: "DOL",
    page: "Form ETA‑9141",
  },
  {
    src: "/images/road/i-485.webp",
    width: 560,
    height: 449,
    alt: "The first page of Form I-485, Application to Register Permanent Residence or Adjust Status.",
    agency: "USCIS",
    page: "Form I‑485",
  },
];
