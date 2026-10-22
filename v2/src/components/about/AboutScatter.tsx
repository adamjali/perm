"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { STAGE_MEDIA } from "@/components/scroll/useScrollStage";

/**
 * The About page's portrait among the real pages the site reads (preview, Oct 21 2026; the owner's
 * image-led direction, pattern 5 in ~/.claude/explanations/20261021_details_so/PATTERNS.md).
 *
 * From 1024px the portrait sits in the middle of the hero's right half and six federal pages sit round
 * it, small and flat. As the reader scrolls past the hero each page drifts up at its own depth, a few
 * dozen pixels at most, written as a CSS variable (--drift) on each page on scroll and never run by itself. Below
 * 1024px, and under reduced motion, the same pages lie still: a plain grid under the portrait on a phone.
 *
 * Every page is the agency's own (federal works, 17 U.S.C. 105), captured for the guides and the
 * homepage's road; each carries its agency and page under it on a solid label.
 */

interface Doc {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Who publishes it, and the page or form, on the label under it. Form numbers use a non-breaking hyphen. */
  agency: string;
  page: string;
  /** Where it sits round the portrait from 1024px, as percentages of the right half. */
  place: { left: string; top: string; width: string };
  /** How much of the drift it takes: nearer pages move further. */
  depth: number;
}

export const ABOUT_DOCS: Doc[] = [
  {
    src: "/images/content/figures/guides/how-the-perm-queue-works-dol-page.webp",
    width: 1600,
    height: 625,
    alt: "DOL's PERM processing times page: the filing month its analysts are working on and its average wait, as DOL publishes them.",
    agency: "DOL",
    page: "Processing times",
    place: { left: "-2%", top: "0%", width: "43%" },
    depth: 0.9,
  },
  {
    src: "/images/content/figures/guides/perm-rfi-issued-what-to-do-flag-rfi-status.webp",
    width: 1600,
    height: 1173,
    alt: "DOL's case status search on flag.dol.gov, answering RFI ISSUED for one LinkedIn Corporation PERM case.",
    agency: "DOL",
    page: "Case status search",
    place: { left: "71%", top: "0%", width: "33%" },
    depth: 0.45,
  },
  {
    src: "/images/road/visa-bulletin-oct-2026.webp",
    width: 560,
    height: 486,
    alt: "The final action dates chart for employment-based cases in the State Department's October 2026 visa bulletin.",
    agency: "State Dept.",
    page: "Visa bulletin",
    place: { left: "-4%", top: "31%", width: "30%" },
    depth: 0.6,
  },
  {
    src: "/images/road/eta-9089.webp",
    width: 560,
    height: 449,
    alt: "The first page of Form ETA-9089, Application for Permanent Employment Certification.",
    agency: "DOL",
    page: "Form ETA‑9089",
    place: { left: "72%", top: "32%", width: "30%" },
    depth: 1,
  },
  {
    src: "/images/road/eta-9141.webp",
    width: 560,
    height: 449,
    alt: "The first page of Form ETA-9141, Application for Prevailing Wage Determination.",
    agency: "DOL",
    page: "Form ETA‑9141",
    place: { left: "0%", top: "64%", width: "29%" },
    depth: 0.35,
  },
  {
    src: "/images/road/i-485.webp",
    width: 560,
    height: 449,
    alt: "The first page of Form I-485, Application to Register Permanent Residence or Adjust Status.",
    agency: "USCIS",
    page: "Form I‑485",
    place: { left: "71%", top: "65.5%", width: "29%" },
    depth: 0.7,
  },
];

/** The drift at full scroll past the hero, as a share of the hero's height (about 48px on a 720px hero). */
const DRIFT_PER_PX = 0.066;

export function AboutScatter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(STAGE_MEDIA);
    const update = () => {
      const rect = el.getBoundingClientRect();
      const scrolled = Math.min(rect.height, Math.max(0, -rect.top + 120));
      const drift = `${(scrolled * DRIFT_PER_PX).toFixed(1)}px`;
      el.querySelectorAll<HTMLElement>("[data-drift]").forEach((li) => li.style.setProperty("--drift", drift));
    };
    let on = false;
    const sync = () => {
      if (media.matches && !on) {
        on = true;
        update();
        window.addEventListener("scroll", update, { passive: true });
      } else if (!media.matches && on) {
        on = false;
        window.removeEventListener("scroll", update);
        el.querySelectorAll<HTMLElement>("[data-drift]").forEach((li) => li.style.removeProperty("--drift"));
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("scroll", update);
      media.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-about-scatter=""
      className="relative mx-auto w-full max-w-md lg:mx-0 lg:flex lg:min-h-[720px] lg:max-w-none lg:flex-col lg:items-center lg:justify-center"
    >
      <div className="relative z-10 mx-auto w-full max-w-sm lg:w-[40%]">{children}</div>{" "}
      <ul
        aria-label="Federal pages the site reads, and the forms a case moves through"
        className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 [&>*]:min-w-0 sm:grid-cols-3 lg:mt-0 lg:block"
      >
        {ABOUT_DOCS.map((d) => (
          <Fragment key={d.src}>
            {" "}
            <li
              data-drift=""
              style={
                {
                  "--l": d.place.left,
                  "--t": d.place.top,
                  "--w": d.place.width,
                  "--depth": d.depth,
                } as CSSProperties
              }
              className="lg:absolute lg:left-[var(--l)] lg:top-[var(--t)] lg:w-[var(--w)] lg:motion-safe:[transform:translate3d(0,calc(var(--drift,0px)*var(--depth)*-1),0)]"
            >
              <figure className="border-2 border-[var(--object-border)] bg-card">
                <img
                  src={d.src}
                  width={d.width}
                  height={d.height}
                  alt={d.alt}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full max-lg:aspect-[4/3] max-lg:object-cover max-lg:object-left-top"
                />{" "}
                <figcaption className="border-t-2 border-[var(--object-border)] bg-card px-2.5 py-1.5 text-sm leading-snug">
                  <span className="block text-muted-foreground">{d.agency}</span>{" "}
                  <span className="block font-semibold">{d.page}</span>
                </figcaption>
              </figure>
            </li>
          </Fragment>
        ))}
      </ul>{" "}
      <p className="mt-6 text-sm text-muted-foreground lg:absolute lg:bottom-1 lg:left-0 lg:right-0 lg:mt-0 lg:text-center">
        The federal pages every figure here comes from, and the forms a case moves through.
      </p>
    </div>
  );
}
