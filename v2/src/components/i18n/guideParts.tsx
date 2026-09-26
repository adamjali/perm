import Link from "next/link";

/**
 * The three inline pieces every localized guide's copy is written with.
 *
 * `En` is a link to an English page, marked `hrefLang="en"` so a reader (and
 * a screen reader) knows the page on the other side is English. `D` is a data
 * value or DOL/USCIS word kept exactly as the agency prints it, marked
 * `translate="no"` so a browser's translator leaves it alone. `F` is a form
 * name (I-140, I-485), kept whole on one line.
 */

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function En({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} hrefLang="en" className={link}>
      {children}
    </Link>
  );
}

export function D({ children }: { children: React.ReactNode }) {
  return <span translate="no">{children}</span>;
}

export function F({ children }: { children: React.ReactNode }) {
  return (
    <span translate="no" className="whitespace-nowrap">
      {children}
    </span>
  );
}
