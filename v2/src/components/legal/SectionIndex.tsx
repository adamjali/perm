import { Fragment } from "react";
import Link from "next/link";

/**
 * A jump list for a long legal page.
 *
 * WHY THIS AND NOT A TRIM. The privacy policy runs 19 numbered sections and
 * about 1,500 words, terms runs 18 and about 1,850, and neither had a single
 * anchor: the only way to reach section 14 was to scroll past thirteen. On
 * these pages the text IS the product and cutting it would be wrong, so the
 * fix is structure. Someone arriving to check one thing (what happens to their
 * data, how to delete an account) gets there in one click.
 *
 * The list is derived from the same array the headings are rendered from, so a
 * new section cannot appear on the page and be missing from the index.
 *
 * `scroll-mt` on each heading is load-bearing: the site header is sticky and
 * publishes its own height, so an anchor without that offset lands the heading
 * underneath the bar. It uses `--site-header-max-h`, the variable that never
 * shrinks, because a jump is instantaneous and the bar has not resized yet.
 */

export interface LegalSection {
  /** The anchor, and the fragment in the URL. */
  id: string;
  /** The heading text, exactly as the section prints it. */
  title: string;
}

export function SectionIndex({
  sections,
  label = "On this page",
}: {
  sections: readonly LegalSection[];
  label?: string;
}) {
  if (sections.length === 0) return null;
  return (
    <nav aria-label={label} className="mt-8 border-2 border-border bg-card p-5 shadow-hard">
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>{" "}
      <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 [&>*]:min-w-0">
        {sections.map((s) => (
          // A Fragment with a trailing space, not a bare <li>. React renders
          // array items with NOTHING between them, so 19 list items reached the
          // DOM as "1. Introduction2. Information We Collect3. How We Use...",
          // and Google has reproduced exactly that shape in a live listing.
          // Caught by the rendered sweep after the source gate passed, which is
          // the documented reason the rendered one is the authoritative check.
          <Fragment key={s.id}>
            <li>
              <Link
                href={`#${s.id}`}
                className="inline-flex min-h-[36px] items-center text-base underline decoration-border decoration-2 underline-offset-2 hover:decoration-primary hover:text-primary"
              >
                {s.title}
              </Link>
            </li>{" "}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
