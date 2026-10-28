/**
 * MDX Component Mapping
 *
 * Custom components injected into MDX content.
 * Styled to match the site.
 */

import type { MDXComponents } from "mdx/types";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { citationRuns } from "@/lib/content/citationRuns";
import { buttonVariants } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import VideoPlayer from "@/components/content/VideoPlayer";
import ScreenshotFigure from "@/components/content/ScreenshotFigure";
import VideoFigure from "@/components/content/VideoFigure";
import PrintableChecklist from "@/components/content/PrintableChecklist";
import { EbLinesNow } from "@/components/content/EbLinesNow";
import { EbApprovalsNow } from "@/components/content/EbApprovalsNow";
import { EbSplitNow } from "@/components/content/EbSplitNow";
import { JourneyNow } from "@/components/content/JourneyNow";
import { OnHoldNow } from "@/components/content/OnHoldNow";
import { DolNow } from "@/components/content/DolNow";
import { RecruitmentNow } from "@/components/content/RecruitmentNow";
import { BulletinReleaseNow } from "@/components/content/BulletinReleaseNow";
import { ComparisonTable } from "@/components/content/ComparisonTable";
import { RuleCompare } from "@/components/policy/RuleCompare";
import { RuleStatus } from "@/components/policy/RuleStatus";
import { QueueFigure } from "@/components/figures/dol-queue/QueueFigure";
import { RfiFigure } from "@/components/figures/rfi-path/RfiFigure";
import { BulletinFigure } from "@/components/figures/bulletin-cutoff/BulletinFigure";
import { PwdQueueFigure } from "@/components/figures/pwd-queue/PwdQueueFigure";
import { Lightbox } from "@/components/ui/lightbox";
import { ScrollBox } from "@/components/ui/scroll-box";
import { InfoIcon, LightbulbIcon, WarningIcon, WarningOctagonIcon } from "@phosphor-icons/react/ssr";

// The drawings load their kit only on the articles that use them.
const FilingWindowFigure = dynamic(() => import("@/components/figures/filing-window/FilingWindowFigure"));
const PwdValidityFigure = dynamic(() => import("@/components/figures/pwd-validity/PwdValidityFigure"));
const I140ClocksFigure = dynamic(() => import("@/components/figures/i140-clocks/I140ClocksFigure"));

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
  // Stat variant: a card with a large stat
  if (type === "stat") {
    return (
      <div className="not-prose my-6 flex flex-col gap-4 border border-border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        {stat && (
          <div className="max-w-[10rem] flex-shrink-0 self-start font-heading text-2xl font-bold leading-tight text-foreground tabular-nums sm:self-auto sm:text-3xl">
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
    info: "border-l-4 border-primary bg-tint",
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
    <div className="not-prose my-8 bg-tint p-6">
      <p className="mb-2 font-heading text-lg font-bold text-foreground">{title}</p>{" "}
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <NavLink
        href={href}
        className={buttonVariants()}
        spinnerClassName="text-primary-foreground"
        spinnerSize={14}
      >
        {buttonText}
      </NavLink>
    </div>
  );
}

function StepByStep({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 space-y-4 border-l border-border pl-6">
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
      <div className="absolute -left-[38px] flex size-7 items-center justify-center border border-input bg-background font-mono text-sm font-bold text-foreground">
        {number}
      </div>
      <p className="mb-1 font-heading text-base font-bold">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
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
  // How far ahead of filing employers start, from DOL's record (live).
  RecruitmentNow,
  // When the next bulletin usually comes out, from the archive's captures.
  BulletinReleaseNow,
  // The filing window as a measuring bench: the reader moves the last recruitment step.
  FilingWindowFigure,
  // A wage determination's validity as a bench: the reader moves the first recruitment step.
  PwdValidityFigure,
  // Two of the 180-day clocks as lanes: the reader moves the day they leave.
  I140ClocksFigure,
  // DOL's line as a conveyor, run forward at DOL's pace: reads today's line (an async server component).
  QueueFigure,
  // An RFI as a siding off DOL's line, run forward on the measured RFI clock (an async server component).
  RfiFigure,
  // A visa bulletin cutoff as a gate on a rail of priority dates, stepped through one line's real bulletins (an async server component).
  BulletinFigure,
  // DOL's wage-request line as a conveyor, run forward in DOL's working days (an async server component).
  PwdQueueFigure,
  // Where one rule stands, and rules side by side, from the rule watch's record: the article moves
  // the run OIRA or the Register does (async server components; /api/revalidate-policy expires them).
  RuleStatus,
  RuleCompare,
  // EB-2 and EB-3 for one country, and how many PERM jobs meet the EB-2 bar, live (async server components).
  EbLinesNow,
  EbApprovalsNow,
  EbSplitNow,
  JourneyNow,

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
      className="bg-tint px-1.5 py-0.5 font-mono text-sm"
      {...props}
    >
      {props.className === "language-document" && typeof children === "string"
        ? citationRuns(children).map((run, i) =>
            run.cite ? (
              <span key={i} className="whitespace-nowrap">
                {run.text}
              </span>
            ) : (
              run.text
            ),
          )
        : children}
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
    <ScrollBox label="Table" className="my-6 overscroll-x-none">
      <table className="w-full border border-border text-sm" {...props}>
        {children}
      </table>
    </ScrollBox>
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
