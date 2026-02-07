"use client";

import { useRef, useCallback } from "react";
import { Printer } from "lucide-react";

/**
 * Wraps checklist content in MDX articles with a print button.
 * Prints ONLY the checklist in a new window with subtle PERM Tracker branding.
 */
export default function PrintableChecklist({
  title = "PERM Checklist",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!contentRef.current) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const doc = printWindow.document;

    doc.title = `${title} — PERM Tracker`;

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
    const clonedNodes = contentRef.current.cloneNode(true) as HTMLElement;
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

  return (
    <section className="relative my-8">
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 border-2 border-border bg-card px-3 py-1.5 font-mono text-xs font-medium shadow-hard-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <Printer className="h-3.5 w-3.5" />
          Print Checklist
        </button>
      </div>
      <div ref={contentRef}>{children}</div>
    </section>
  );
}
