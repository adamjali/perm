"use client";

/**
 * SocialProofSection (formerly TestimonialsSection)
 *
 * Trust badges, Senja reviews widget, and link to leave a review.
 * Neobrutalist styling consistent with other homepage sections.
 */

import Script from "next/script";
import { useEffect, useRef } from "react";
import { ChatDots, Star } from "@phosphor-icons/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { APP_RATING, shouldAdvertiseRating } from "@/lib/structuredData";

interface TrustBadge {
  icon: React.ReactNode;
  label: string;
}

const trustBadges: TrustBadge[] = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2 L17 6 L17 11 Q17 17 10 18 Q3 17 3 11 L3 6 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10 L9 12 L13 8" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="square" />
      </svg>
    ),
    label: "Encrypted Data",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="14" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 4 L10 10 L17 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="15" cy="5" r="3" fill="var(--primary)" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    label: "DOL Compliant",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="13" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="13" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    label: "Applicants and Attorneys",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5" cy="10" r="2.5" fill="var(--stage-pwd)" stroke="currentColor" strokeWidth="1" />
        <circle cx="10" cy="10" r="2.5" fill="var(--stage-recruitment)" stroke="currentColor" strokeWidth="1" />
        <circle cx="15" cy="10" r="2.5" fill="var(--stage-eta9089)" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    label: "5 PERM Stages",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10" y1="5" x2="10" y2="10" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="10" x2="14" y2="12" stroke="var(--primary)" strokeWidth="1.5" />
      </svg>
    ),
    label: "Real-Time Updates",
  },
];

/**
 * Give Senja's "powered by" link an accessible name.
 *
 * The widget renders an icon-only anchor with no text and no label, which is
 * the ONLY failure in two Lighthouse categories on the homepage: Accessibility
 * sits at 97 instead of 100 ("Links do not have a discernible name") and
 * Agentic Browsing at 2/3 ("Accessibility tree is not well-formed"), both
 * naming `div.senja-embed > div.sj-avatars > a.sj-powered-by`. A screen reader
 * announces it as "link", and an agent walking the tree gets a destination it
 * cannot describe.
 *
 * We cannot change their markup, so we label it after it arrives. Adding an
 * accessible name to an element that has none cannot break anything: there is
 * no name to override.
 *
 * Scoped to the embed container rather than document.body - a subtree observer
 * on the whole document runs on every React commit for the life of the page.
 * It searches the shadow root too, because the embed is configured
 * `data-mode="shadow"` and may render either way depending on their build.
 * Self-disconnects once labelled, and gives up after a bounded window so a
 * widget that never loads does not leave an observer running.
 *
 * If Senja renames the class this silently stops working and we are back to
 * exactly today's behaviour, which is the right way for a patch on somebody
 * else's DOM to fail.
 */
function useLabelSenjaAttribution(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const label = (): boolean => {
      const roots: (HTMLElement | ShadowRoot)[] = [host];
      const embed = host.querySelector<HTMLElement>(".senja-embed");
      if (embed?.shadowRoot) roots.push(embed.shadowRoot);

      let labelled = false;
      for (const root of roots) {
        root
          .querySelectorAll<HTMLAnchorElement>("a.sj-powered-by")
          .forEach((a) => {
            // Never overwrite a name they may have added themselves.
            if (a.getAttribute("aria-label") || a.textContent?.trim()) return;
            a.setAttribute("aria-label", "Reviews powered by Senja");
            labelled = true;
          });
      }
      return labelled;
    };

    if (label()) return;

    const observer = new MutationObserver(() => {
      if (label()) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });
    const giveUp = setTimeout(() => observer.disconnect(), 20_000);

    return () => {
      observer.disconnect();
      clearTimeout(giveUp);
    };
  }, [ref]);
}

export function TestimonialsSection() {
  const senjaRef = useRef<HTMLDivElement>(null);
  useLabelSenjaAttribution(senjaRef);

  return (
    <section className="relative py-12 sm:py-16 overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* All content in single stagger container (1 Intersection Observer) */}
        <ScrollReveal direction="up" stagger>
          {/* Section header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
              <Star className="h-3.5 w-3.5" />
              Reviews
            </div>{" "}
            <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
              What Our Users Say
            </h2>{" "}
            <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground">
              Applicants and attorneys use PERM Tracker to follow the queue and track their deadlines.
            </p>
          </div>

          {/* Trust badges row */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-10">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground"
              >
                <span className="flex-shrink-0">{badge.icon}</span>{" "}
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          {/*
            The rating, as REAL text in the served HTML. Google requires a
            marked-up aggregate rating to be readily visible on the page, and
            the Senja embed arrives via a third-party script - invisible to
            any text extraction and dependent on that script executing. This
            line is built from the same APP_RATING constant as the JSON-LD,
            so the visible number and the marked-up number cannot drift.
          */}
          {shouldAdvertiseRating() ? (
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="flex" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} weight="fill" className="h-5 w-5 text-primary" />
              ))}
            </span>{" "}
            <span className="font-heading font-bold text-lg">
              {Number(APP_RATING.value).toFixed(1)}
            </span>{" "}
            <span className="text-sm text-muted-foreground">
              from {APP_RATING.count} reviews
            </span>
          </div>
          ) : null}

          {/*
            The Senja embed is gated on the SAME threshold as our own rating
            line, and that is the whole point of gating it.

            A rendered-QA pass caught the hole: we suppressed our 5.0 while
            this widget kept printing gold stars, an average and "from 2
            reviews" a few pixels lower, in its own palette and with an emoji.
            So the claim the gate exists to withhold was still on the page,
            just published by someone else. A gate that does not cover its
            subject reads exactly like a pass - the same defect class as an
            audit missing a colour pair, and it was found by looking rather
            than by any check we own.

            Below the floor the band keeps the trust badges and the CTA, so
            there is still a reason to be here and a way to contribute. What
            goes quiet is the scorekeeping, wherever it is rendered from.
            Raising APP_RATING.count past MIN_REVIEWS_TO_ADVERTISE brings the
            line, the schema and this widget back together.
          */}
          {shouldAdvertiseRating() ? (
            <div ref={senjaRef}>
              <Script
                src="https://widget.senja.io/widget/3563db96-3a71-4d2a-b7e8-70550d4dd814/platform.js"
                strategy="lazyOnload"
              />
              <div
                className="senja-embed"
                data-id="3563db96-3a71-4d2a-b7e8-70550d4dd814"
                data-mode="shadow"
                data-lazyload="true"
                style={{ display: "block", width: "100%" }}
              />
            </div>
          ) : null}

          {/* Review link. This stays at every review count: it is the thing
              that gets us past the floor. */}
          <div className="mt-10 text-center">
            <a
              href="https://senja.io/p/perm-tracker/r/FXAjpr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-3 border-border bg-primary px-5 py-2.5 font-heading text-sm font-bold uppercase tracking-wide text-black shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <ChatDots className="h-4 w-4" />
              Leave a Review
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default TestimonialsSection;
