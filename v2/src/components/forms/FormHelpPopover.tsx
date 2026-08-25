"use client";

import { useState } from "react";
import { HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fixed-position help panel for the case form.
 * Opens as a side panel that stays visible while scrolling/editing the form.
 * Has its own scroll so users can reference it while filling in fields.
 *
 * Toggle tab sits at the right edge. When closed: green hover. When open: red (like delete).
 * Arrow icon points right (toward panel) when closed, left (back) when open.
 */
export function FormHelpPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle tab — fixed to right edge, hidden on mobile (panel is 320px on 375px screen) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "hidden md:flex",
          "fixed z-40 items-center gap-1.5",
          "rounded-l-lg border-2 border-r-0 px-2.5 py-3",
          "text-sm font-mono font-bold",
          "transition-all duration-200",
          // Position: right edge when closed, left edge of panel when open
          "top-20",
          isOpen
            ? "right-80 sm:right-96 border-red-300 bg-red-50 text-red-700 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive dark:border-red-800 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-destructive dark:hover:text-destructive-foreground"
            : "right-0 border-border bg-background text-foreground hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] hover:border-[var(--primary)] shadow-hard",
        )}
        aria-label={isOpen ? "Close help panel" : "Open help panel"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Close</span>
          </>
        ) : (
          <>
            <HelpCircle className="h-4 w-4 shrink-0" />
            <ChevronLeft className="h-4 w-4 shrink-0" />
          </>
        )}
      </button>

      {/* Side panel — below header, hidden on mobile */}
      <div
        className={cn(
          "hidden md:block",
          "fixed right-0 top-16 z-30 h-[calc(100vh-4rem)] w-80 sm:w-96",
          "border-l-2 border-border bg-background shadow-hard-lg",
          "transition-transform duration-200 ease-out",
          "overflow-y-auto overscroll-contain",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        role="complementary"
        aria-label="Form help reference"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b-2 border-border bg-background px-5 py-4">
          <h2 className="font-heading font-bold text-base uppercase tracking-wider">Form Reference</h2>
        </div>

        {/* Content */}
        <div className="p-5 pb-24 space-y-6 text-sm">
          {/* Overview */}
          <section>
            <SectionHeading>How This Form Works</SectionHeading>
            <p className="text-muted-foreground">
              This form tracks dates through the four stages of the PERM labor certification process. Fill in dates as you get them, you don&rsquo;t need to complete everything at once.
            </p>
            <ul className="mt-2 space-y-1 text-muted-foreground list-disc pl-4">
              <li>Sections unlock progressively as you enter prerequisite dates</li>{" "}
              <li>Some dates auto-calculate (marked with an &ldquo;auto&rdquo; badge)</li>{" "}
              <li>Save anytime and come back later</li>{" "}
              <li>A green checkmark appears when a section is complete</li>
            </ul>
          </section>

          {/* PWD Section */}
          <section>
            <SectionHeading>1. PWD (Prevailing Wage)</SectionHeading>
            <p className="text-muted-foreground mb-2">
              The prevailing wage determination sets the minimum salary and is the foundation for everything else.
            </p>
            <FieldList items={[
              { field: "Filing Date", desc: "When you submitted the PWD request to DOL" },
              { field: "Determination Date", desc: "When DOL issued the determination. Entering this unlocks the Recruitment section." },
              { field: "Expiration Date", desc: "Auto-calculated: determination + 1 year. All recruitment must complete before this date." },
              { field: "Wage Amount & Level", desc: "The prevailing wage amount and level (I-IV) from the determination" },
            ]} />
            <Example>Enter the determination date first, it triggers the expiration auto-calculation and unlocks Recruitment.</Example>
          </section>

          {/* Recruitment Section */}
          <section>
            <SectionHeading>2. Recruitment</SectionHeading>
            <p className="text-muted-foreground mb-2">
              All PERM cases require three basic recruitment steps. Professional occupations (Bachelor&rsquo;s+) require three additional methods.
            </p>{" "}
            <h5 className="font-bold text-xs uppercase tracking-wider mt-3 mb-1">Basic Requirements</h5>
            <FieldList items={[
              { field: "Job Order", desc: "Start date triggers auto-calculated end (30 calendar days inclusive per 20 CFR § 656.17(d))" },
              { field: "Sunday Ads", desc: "Two newspaper ads on different Sundays, at least 7 days apart" },
              { field: "Notice of Filing", desc: "Start date triggers auto-calculated end (10 business days, skipping federal holidays)" },
            ]} />
            <h5 className="font-bold text-xs uppercase tracking-wider mt-3 mb-1">Professional Occupations</h5>{" "}
            <p className="text-muted-foreground">
              Check &ldquo;Professional Occupation&rdquo; if the position requires a Bachelor&rsquo;s degree or higher. You must then add 3+ additional recruitment methods (from 11 options: campus placement, job fairs, trade publications, employer website, etc.).
            </p>
            <Example>Each method needs dates to count. Two methods isn’t enough, the section stays incomplete until you have three with valid dates.</Example>
          </section>

          {/* ETA 9089 Section */}
          <section>
            <SectionHeading>3. ETA 9089 (PERM Application)</SectionHeading>
            <p className="text-muted-foreground mb-2">
              The PERM application itself. This section unlocks when all recruitment is complete AND the 30-day quiet period has passed.
            </p>
            <FieldList items={[
              { field: "Filing Date", desc: "When the ETA 9089 was filed with DOL" },
              { field: "Case Number", desc: "The DOL case number (e.g., A-12345-67890)" },
              { field: "Certification Date", desc: "When DOL certified the application. Triggers auto-calculated expiration (180 days) and unlocks I-140." },
              { field: "Audit", desc: "If DOL audits the case, enter the audit received and submitted dates" },
            ]} />
            <h5 className="font-bold text-xs uppercase tracking-wider mt-3 mb-1">RFI (Request for Information)</h5>{" "}
            <p className="text-muted-foreground">
              If DOL requests additional info, enter the received date, the system auto-calculates a strict 30-day due date. Missing an RFI deadline means case denial.
            </p>
          </section>

          {/* I-140 Section */}
          <section>
            <SectionHeading>4. I-140 (Immigrant Petition)</SectionHeading>
            <p className="text-muted-foreground mb-2">
              The immigrant petition filed with USCIS. Must be filed within 180 days of ETA 9089 certification.
            </p>
            <FieldList items={[
              { field: "Filing Date", desc: "When the I-140 was filed with USCIS" },
              { field: "Receipt Number", desc: "The USCIS receipt number (e.g., EAC-12-345-67890)" },
              { field: "Approval/Denial Date", desc: "The outcome date. Completing this marks the section done." },
            ]} />
            <h5 className="font-bold text-xs uppercase tracking-wider mt-3 mb-1">RFE (Request for Evidence)</h5>{" "}
            <p className="text-muted-foreground">
              If USCIS requests evidence, enter the received date and due date (typically ~87 days). Unlike RFI, the RFE due date is manually entered since USCIS sets it per case.
            </p>
          </section>

          {/* Validation */}
          <section>
            <SectionHeading>Validation & Errors</SectionHeading>
            <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
              <li><strong className="text-foreground">Red asterisks (*)</strong>: Required fields. Must be filled before saving.</li>{" "}
              <li><strong className="text-orange-500">Orange warnings</strong>: Advisory. They flag potential issues but don&rsquo;t prevent saving.</li>{" "}
              <li><strong className="text-foreground">Date constraints</strong>: The date picker greys out invalid dates (e.g., can&rsquo;t set certification before filing).</li>{" "}
              <li><strong className="text-foreground">Auto-status</strong>: Case status and progress auto-update based on your dates. Toggle off in Basic Info to set manually.</li>
            </ul>
          </section>

          {/* Auto-Calculated Fields */}
          <section>
            <SectionHeading>Auto-Calculated Fields</SectionHeading>
            <p className="text-muted-foreground mb-2">
              Fields with an &ldquo;auto&rdquo; badge calculate automatically when you enter their trigger date:
            </p>
            <ul className="space-y-1 text-muted-foreground list-disc pl-4">
              <li><strong className="text-foreground">PWD Expiration</strong>: Determination date + 1 year</li>{" "}
              <li><strong className="text-foreground">Job Order End</strong>: Start date + 30 calendar days</li>{" "}
              <li><strong className="text-foreground">NOF End</strong>: Start date + 10 business days (skips weekends & federal holidays)</li>{" "}
              <li><strong className="text-foreground">ETA 9089 Expiration</strong>: Certification date + 180 days</li>{" "}
              <li><strong className="text-foreground">RFI Due Date</strong>: Received date + 30 days (strict)</li>
            </ul>
            <Example>Auto-calculated fields update instantly. You can manually override them if the auto value isn&rsquo;t right for your case.</Example>
          </section>

          {/* Tips */}
          <section>
            <SectionHeading>Tips</SectionHeading>
            <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
              <li>Enter the PWD determination date first, everything else depends on it</li>{" "}
              <li>The 30-day quiet period between recruitment and ETA 9089 filing is calculated automatically</li>{" "}
              <li>Filing window = 180 days from first recruitment activity (or PWD expiration, whichever is earlier)</li>{" "}
              <li>Use the progress bar at the top to see how far along the case is</li>{" "}
              <li>Click any section header to open/close it, even if prerequisites aren&rsquo;t met</li>
            </ul>
          </section>

          {/* Regulations */}
          <section>
            <SectionHeading>Key Regulations</SectionHeading>
            <ul className="space-y-1 text-muted-foreground list-disc pl-4">
              <li><strong className="text-foreground">20 CFR § 656.17(d)</strong>: Job order: 30 calendar days minimum</li>{" "}
              <li><strong className="text-foreground">20 CFR § 656.10(d)</strong>: Notice of filing: 10 business days</li>{" "}
              <li><strong className="text-foreground">20 CFR § 656.17(e)</strong>: 30-day quiet period, 180-day filing window</li>{" "}
              <li><strong className="text-foreground">20 CFR § 656.40</strong>: PWD validity: 1 year from determination</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-bold font-mono text-xs uppercase tracking-wider mb-1.5 text-foreground border-b border-border pb-1">
      {children}
    </h4>
  );
}

function FieldList({ items }: { items: { field: string; desc: string }[] }) {
  return (
    <dl className="space-y-1.5">
      {items.map((item) => (
        <div key={item.field} className="flex gap-2">
          <dt className="font-semibold text-foreground shrink-0 min-w-[100px]">{item.field}</dt>{" "}
          <dd className="text-muted-foreground">{item.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 bg-muted/50 border border-border rounded px-3 py-2 text-xs text-muted-foreground">
      <span className="font-bold font-mono uppercase tracking-wider text-foreground">Tip: </span>
      {children}
    </div>
  );
}
