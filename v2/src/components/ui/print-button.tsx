"use client";

import { PrinterIcon } from "@phosphor-icons/react";

/**
 * Print the page, or save it as a PDF from the browser's print dialog (GreenCardClock charges for a PDF of its
 * analysis; ours is the page itself). globals.css's print rules drop the header, footer and floating parts and
 * open every folded section, so what prints is the plan with its sources.
 */
export function PrintButton({ label = "Print or save as PDF", className = "" }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`link inline-flex min-h-11 items-center gap-1.5 print:hidden ${className}`}
    >
      <PrinterIcon aria-hidden="true" className="size-4" weight="bold" /> {label}
    </button>
  );
}
