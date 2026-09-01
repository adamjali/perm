"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { ArrowCounterClockwiseIcon as RotateCcw, ChecksIcon as CheckCheck, PrinterIcon } from "@phosphor-icons/react";

/**
 * Generate a localStorage key from the checklist title.
 * Slugifies the title for a stable, URL-safe key.
 */
function storageKey(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `perm-checklist-${slug}`;
}

/**
 * Read current checkbox state from DOM and persist to localStorage.
 */
function persistState(container: HTMLDivElement, key: string): boolean[] {
  const all = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  const state = Array.from(all).map((c) => c.checked);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage full — ignore
  }
  return state;
}

/**
 * Wraps checklist content in MDX articles with interactive checkboxes and a print button.
 * - Checkboxes are clickable on screen (MDX renders them disabled by default)
 * - Check All / Clear buttons for bulk operations
 * - Progress counter shows checked/total
 * - State persists in localStorage keyed by checklist title
 * - Print reflects current checked state
 */
export default function PrintableChecklist({
  title = "PERM Checklist",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const key = storageKey(title);
  const [checkedCount, setCheckedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  /** Recount checked checkboxes from DOM */
  const recount = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;
    const all = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    setTotalCount(all.length);
    setCheckedCount(Array.from(all).filter((c) => c.checked).length);
  }, []);

  // On mount: enable checkboxes and restore saved state
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    if (checkboxes.length === 0) return;

    // Restore saved state
    let saved: boolean[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {
      // Corrupted data — ignore
    }

    checkboxes.forEach((cb, i) => {
      // Enable the checkbox (MDX disables them by default)
      cb.disabled = false;
      cb.style.cursor = "pointer";

      // Restore checked state if saved
      if (saved[i] !== undefined) {
        cb.checked = saved[i];
      }

      // Save on change + recount
      cb.addEventListener("change", () => {
        persistState(container, key);
        recount();
      });
    });

    recount();
  }, [key, recount]);

  const handleCheckAll = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      cb.checked = true;
    });
    persistState(container, key);
    recount();
  }, [key, recount]);

  const handleClear = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });
    persistState(container, key);
    recount();
  }, [key, recount]);

  const handlePrint = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    // Sync .checked property to HTML attribute so cloneNode captures it
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      if (cb.checked) {
        cb.setAttribute("checked", "checked");
      } else {
        cb.removeAttribute("checked");
      }
    });

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const doc = printWindow.document;

    doc.title = `${title} | PERM Tracker`;

    const style = doc.createElement("style");
    style.textContent = [
      "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: #1a1a1a; padding: 40px; max-width: 750px; margin: 0 auto; }',
      "header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 24px; }",
      "header h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }",
      ".brand { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }",
      ".content h2 { font-size: 15px; font-weight: 700; margin-top: 20px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }",
      ".content h3 { font-size: 13px; font-weight: 700; margin-top: 14px; margin-bottom: 6px; }",
      ".content h4 { font-size: 13px; font-weight: 600; margin-top: 10px; margin-bottom: 4px; }",
      ".content ul { list-style: none; padding-left: 4px; margin-bottom: 8px; }",
      ".content li { position: relative; padding-left: 24px; margin-bottom: 4px; line-height: 1.4; }",
      '.content li input[type="checkbox"] { position: absolute; left: 0; top: 3px; width: 14px; height: 14px; accent-color: #1a1a1a; }',
      ".content ol { padding-left: 24px; margin-bottom: 8px; }",
      ".content ol li { padding-left: 4px; margin-bottom: 4px; }",
      ".content p { margin-bottom: 8px; color: #333; }",
      ".content strong { font-weight: 700; }",
      '.content [class*="border-l-4"], .content [class*="not-prose"] { display: none; }',
      "footer { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }",
      "@media print { body { padding: 20px; } @page { margin: 0.6in; } }",
    ].join("\n");
    doc.head.appendChild(style);

    // Header
    const header = doc.createElement("header");
    const h1 = doc.createElement("h1");
    h1.textContent = title;
    const brandEl = doc.createElement("div");
    brandEl.className = "brand";
    brandEl.textContent = "PERM Tracker";
    header.appendChild(h1);
    header.appendChild(brandEl);
    doc.body.appendChild(header);

    // Content — deep clone from our own rendered React children (trusted)
    const content = doc.createElement("div");
    content.className = "content";
    const clonedNodes = container.cloneNode(true) as HTMLElement;
    while (clonedNodes.firstChild) {
      content.appendChild(doc.adoptNode(clonedNodes.firstChild));
    }
    doc.body.appendChild(content);

    // Footer
    const footer = doc.createElement("footer");
    const site = doc.createElement("div");
    site.textContent = "permtracker.app";
    const dateEl = doc.createElement("div");
    dateEl.textContent = dateStr;
    footer.appendChild(site);
    footer.appendChild(dateEl);
    doc.body.appendChild(footer);

    printWindow.onafterprint = () => printWindow.close();
    printWindow.focus();
    printWindow.print();
  }, [title]);

  const allChecked = totalCount > 0 && checkedCount === totalCount;
  const noneChecked = checkedCount === 0;

  const btnBase = "inline-flex items-center gap-1.5 border-[3px] border-black dark:border-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:pointer-events-none";

  return (
    <section className="relative my-8">
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {/* Progress counter */}
        {totalCount > 0 && (
          <span className="font-mono text-xs font-bold tracking-wider text-muted-foreground mr-auto">
            {checkedCount}/{totalCount} done
          </span>
        )}

        <button
          type="button"
          onClick={handleCheckAll}
          disabled={allChecked}
          className={`${btnBase} bg-[var(--primary)] text-black`}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Check All
        </button>{" "}

        <button
          type="button"
          onClick={handleClear}
          disabled={noneChecked}
          className={`${btnBase} bg-card text-foreground`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>{" "}

        <button
          type="button"
          onClick={handlePrint}
          className={`${btnBase} bg-card text-foreground`}
        >
          <PrinterIcon className="h-3.5 w-3.5" />
          Print
        </button>
      </div>{" "}

      <div ref={contentRef}>{children}</div>
    </section>
  );
}
