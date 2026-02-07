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

/* ------------------------------------------------------------------ */
/* Custom MDX blocks                                                   */
/* ------------------------------------------------------------------ */

function Callout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "tip" | "important";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-l-4 border-primary bg-primary/5",
    warning: "border-l-4 border-yellow-500 bg-yellow-500/5",
    tip: "border-l-4 border-blue-500 bg-blue-500/5",
    important: "border-l-4 border-destructive bg-destructive/5",
  };

  const icons = {
    info: "💡",
    warning: "⚠️",
    tip: "💡",
    important: "🚨",
  };

  return (
    <div className={cn("my-6 p-4 border-2 border-border", styles[type])}>
      {title && (
        <p className="mb-2 font-heading text-sm font-bold uppercase tracking-wide">
          {icons[type]} {title}
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
  description = "Free case tracking for immigration attorneys. Track deadlines, manage cases, never miss a filing date.",
  href = "/signup",
  buttonText = "Get Started Free",
}: {
  title?: string;
  description?: string;
  href?: string;
  buttonText?: string;
}) {
  return (
    <div className="not-prose my-8 border-2 border-border bg-primary/5 p-6 shadow-hard">
      <p className="mb-2 font-heading text-lg font-bold text-foreground">{title}</p>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <NavLink
        href={href}
        className="inline-block border-2 border-black bg-primary px-5 py-2.5 font-heading text-sm font-bold shadow-hard-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border-white"
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
    <div className="my-6 space-y-4 border-l-2 border-primary/30 pl-6">
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
      <div className="absolute -left-[33px] flex h-6 w-6 items-center justify-center border-2 border-border bg-primary font-mono text-xs font-bold text-black">
        {number}
      </div>
      <p className="mb-1 font-heading text-base font-bold">{title}</p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function ComparisonTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-2 border-border text-sm">
        <thead>
          <tr className="bg-muted">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-2 border-border px-4 py-2 text-left font-heading font-bold uppercase tracking-wide"
              >
                {h}
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
                <td key={ci} className="border-2 border-border px-4 py-2">
                  {cell}
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

  // Headings
  h1: ({ children, id, ...props }) => (
    <h1
      id={id}
      className="mb-6 mt-12 font-heading text-3xl font-bold tracking-tight sm:text-4xl"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, id, ...props }) => (
    <h2
      id={id}
      className="mb-4 mt-10 scroll-mt-24 font-heading text-2xl font-bold tracking-tight"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, id, ...props }) => (
    <h3
      id={id}
      className="mb-3 mt-8 scroll-mt-24 font-heading text-xl font-bold"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, id, ...props }) => (
    <h4
      id={id}
      className="mb-2 mt-6 scroll-mt-24 font-heading text-lg font-bold"
      {...props}
    >
      {children}
    </h4>
  ),

  // Body text
  p: ({ children, ...props }) => (
    <p className="mb-4 leading-relaxed text-foreground/90" {...props}>
      {children}
    </p>
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
          className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href ?? "#"}
        className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
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
    <li className="leading-relaxed text-foreground/90" {...props}>
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
      className="my-6 overflow-x-auto border-2 border-border bg-[#0d1117] p-4 text-sm shadow-hard-sm"
      {...props}
    >
      {children}
    </pre>
  ),

  // Blockquote
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-6 border-l-4 border-primary pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: (props) => (
    <hr className="my-8 border-t-2 border-border" {...props} />
  ),

  // Images
  img: ({ src, alt, ...props }) => (
    <figure className="my-6">
      <Image
        src={src ?? ""}
        alt={alt ?? ""}
        width={800}
        height={450}
        className="w-full border-2 border-border shadow-hard"
        {...props}
      />
      {alt && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {alt}
        </figcaption>
      )}
    </figure>
  ),

  // Table
  table: ({ children, ...props }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-2 border-border text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-2 border-border px-4 py-2 text-left font-heading font-bold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-2 border-border px-4 py-2" {...props}>
      {children}
    </td>
  ),

  // Strong / Em
  strong: ({ children, ...props }) => (
    <strong className="font-bold text-foreground" {...props}>
      {children}
    </strong>
  ),
};
