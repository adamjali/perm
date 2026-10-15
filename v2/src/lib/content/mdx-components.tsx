/**
 * MDX Component Mapping
 *
 * Custom components injected into MDX content.
 * Styled to match the neobrutalist design system.
 */

import type { MDXComponents } from "mdx/types";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/ui/nav-link";
import VideoPlayer from "@/components/content/VideoPlayer";
import ScreenshotFigure from "@/components/content/ScreenshotFigure";
import VideoFigure from "@/components/content/VideoFigure";
import PrintableChecklist from "@/components/content/PrintableChecklist";
import { OnHoldNow } from "@/components/content/OnHoldNow";
import { DolNow } from "@/components/content/DolNow";
import { Lightbox } from "@/components/ui/lightbox";
import { InfoIcon, LightbulbIcon, WarningIcon, WarningOctagonIcon } from "@phosphor-icons/react/ssr";

/* ------------------------------------------------------------------ */
/* Custom MDX blocks                                                   */
/* ------------------------------------------------------------------ */

function Callout({
  type = "info",
  title,
  stat,
  children,
}: {
  type?: "info" | "warning" | "tip" | "important" | "stat";
  title?: string;
  /** A short figure, or a live one (`stat={<DolNow show="pwdMonth" />}`). */
  stat?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Stat variant: neobrutalist card with large stat badge
  if (type === "stat") {
    return (
      <div className="not-prose my-6 flex flex-col gap-4 border border-border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        {stat && (
          <div className="flex min-h-16 min-w-16 max-w-[10rem] flex-shrink-0 items-center justify-center self-start border border-border bg-primary px-3 py-2 text-center font-heading text-xl font-bold leading-tight text-black sm:min-h-20 sm:min-w-20 sm:self-auto sm:text-2xl">
            {stat}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <p className="mb-1 font-heading text-base font-bold text-foreground">{title}</p>
          )}
          <div className="text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    );
  }

  const styles = {
    info: "border-l-2 border-primary bg-primary/5",
    warning: "border-l-2 border-data-warn bg-data-warn/5",
    tip: "border-l-2 border-data-info bg-data-info/5",
    important: "border-l-2 border-destructive bg-destructive/5",
  };

  const icons = {
    info: { Icon: InfoIcon, tone: "text-primary-text" },
    warning: { Icon: WarningIcon, tone: "text-data-warn-ink" },
    tip: { Icon: LightbulbIcon, tone: "text-data-info-ink" },
    important: { Icon: WarningOctagonIcon, tone: "text-data-bad-ink" },
  };
  const { Icon, tone } = icons[type];

  return (
    <div className={cn("my-6 p-4 border border-border", styles[type])}>
      {title && (
        <p className="mb-2 flex items-start gap-2 font-heading text-base font-bold">
          <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", tone)} weight="bold" />
          <span>{title}</span>
        </p>
      )}
      <div className="text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function ProductCTA({
  title = "Try PERM Tracker",
  description = "Free for applicants and attorneys: live per-case DOL status with email alerts, stage timelines, and every deadline computed per case.",
  href = "/signup",
  buttonText = "Get Started Free",
}: {
  title?: string;
  description?: string;
  href?: string;
  buttonText?: string;
}) {
  return (
    <div className="not-prose my-8 border border-border bg-primary/5 p-6">
      <p className="mb-2 font-heading text-lg font-bold text-foreground">{title}</p>{" "}
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <NavLink
        href={href}
        className="inline-block border border-black bg-primary px-5 py-2.5 font-heading text-sm font-bold transition-colors duration-150 dark:border-white"
        style={{ color: "black" }}
        spinnerClassName="text-black"
        spinnerSize={14}
      >
        {buttonText}
      </NavLink>
    </div>
  );
}

function StepByStep({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 space-y-4 border-l border-primary/30 pl-6">
      {children}
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute -left-[33px] flex h-6 w-6 items-center justify-center border border-border bg-primary font-mono text-sm font-bold text-black">
        {number}
      </div>
      <p className="mb-1 font-heading text-base font-bold">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function ComparisonTable({
  headers = [],
  rows = [],
}: {
  headers?: string[];
  // A cell may hold a live figure (<DolNow />), so cells are nodes, not strings.
  rows?: React.ReactNode[][];
}) {
  if (!headers.length || !rows.length) return null;

  if (process.env.NODE_ENV === "development") {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.length !== headers.length) {
        console.warn(`[ComparisonTable] Row ${i} has ${rows[i]!.length} cells but headers has ${headers.length}`);
      }
    }
  }

  return (
    <div className="my-6 overflow-x-auto overscroll-x-none">
      <table className="w-full border border-border text-sm">
        <thead>
          <tr className="bg-muted">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-border px-4 py-2 text-left font-heading font-bold"
              >
                {h}{" "}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="transition-colors hover:bg-muted/50"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border px-4 py-2">
                  {cell}{" "}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Default MDX element overrides                                       */
/* ------------------------------------------------------------------ */

export const mdxComponents: MDXComponents = {
  // Custom blocks
  Callout,
  ProductCTA,
  StepByStep,
  Step,
  ComparisonTable,
  VideoPlayer,
  ScreenshotFigure,
  VideoFigure,
  PrintableChecklist,
  // Live figures: an async server component reading the sweep's census, so a
  // guide's count is true on the day it is read (see OnHoldNow's comment).
  OnHoldNow,
  // DOL's queue month and average, dated, so no article types a figure that ages.
  DolNow,

  // Headings
  //
  // Every block renderer emits a trailing space. MDX renders sibling blocks
  // with NOTHING between them, so `</h3><p>` reaches anything walking the DOM
  // as one run of characters: a live guide served "Timing Requirements||Per 20
  // CFR 656.17(e)". CSS hides it because both children are block-level, and
  // Google has reproduced this exact defect verbatim in a real search listing.
  // A whitespace text node between two block elements collapses to nothing
  // visually, so this costs no layout.
  h1: ({ children, id, ...props }) => (
    <>
      <h1
        id={id}
        className="mb-6 mt-12 font-heading text-3xl font-bold tracking-tight sm:text-4xl"
        {...props}
      >
        {children}
      </h1>{" "}
    </>
  ),
  h2: ({ children, id, ...props }) => (
    <>
      <h2
        id={id}
        className="mb-4 mt-10 scroll-mt-24 font-heading text-2xl font-bold tracking-tight"
        {...props}
      >
        {children}
      </h2>{" "}
    </>
  ),
  h3: ({ children, id, ...props }) => (
    <>
      <h3
        id={id}
        className="mb-3 mt-8 scroll-mt-24 font-heading text-xl font-bold"
        {...props}
      >
        {children}
      </h3>{" "}
    </>
  ),
  h4: ({ children, id, ...props }) => (
    <>
      <h4
        id={id}
        className="mb-2 mt-6 scroll-mt-24 font-heading text-lg font-bold"
        {...props}
      >
        {children}
      </h4>{" "}
    </>
  ),

  // Body text
  p: ({ children, ...props }) => (
    <>
      <p className="mb-4 leading-relaxed text-soft" {...props}>
        {children}
      </p>{" "}
    </>
  ),

  // Links
  a: ({ href, children, ...props }) => {
    const isExternal = href?.startsWith("http");
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="link"
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href ?? "#"}
        className="link"
        {...props}
      >
        {children}
      </Link>
    );
  },

  // Lists
  ul: ({ children, ...props }) => (
    <ul className="mb-4 ml-6 list-disc space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed text-soft" {...props}>
      {children}
    </li>
  ),

  // Code
  code: ({ children, ...props }) => (
    <code
      className="rounded-none border border-border bg-muted px-1.5 py-0.5 font-mono text-sm"
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="my-6 overflow-x-auto overscroll-x-none border border-border bg-[#0d1117] p-4 text-sm"
      {...props}
    >
      {children}
    </pre>
  ),

  // Blockquote
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-6 border-l-2 border-primary pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: (props) => (
    <hr className="my-8 border-t border-border" {...props} />
  ),

  // Images
  img: ({ src, alt, ...props }) => (
    <figure className="my-6">
      <Lightbox src={src ?? ""} alt={alt ?? ""} caption={alt ?? undefined}>
        <Image
          src={src ?? ""}
          alt={alt ?? ""}
          width={800}
          height={450}
          className="w-full border border-border"
          {...props}
        />
      </Lightbox>
      {alt && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {alt}
        </figcaption>
      )}
    </figure>
  ),

  // Table
  table: ({ children, ...props }) => (
    <div className="my-6 overflow-x-auto overscroll-x-none">
      <table className="w-full border border-border text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted" {...props}>
      {children}
    </thead>
  ),
  // The trailing space in each cell is deliberate. Cells render adjacent with
  // nothing between them, so "Stage" and "Estimated Time" reach any DOM
  // extractor as "StageEstimated Time" - every markdown table in every
  // article, invisible in a browser because cells are laid out separately.
  th: ({ children, ...props }) => (
    <th
      className="border border-border px-4 py-2 text-left font-heading font-bold"
      {...props}
    >
      {children}{" "}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-4 py-2" {...props}>
      {children}{" "}
    </td>
  ),

  // Strong / Em
  strong: ({ children, ...props }) => (
    <strong className="font-bold text-foreground" {...props}>
      {children}
    </strong>
  ),
};
