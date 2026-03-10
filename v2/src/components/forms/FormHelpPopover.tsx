"use client";

import { HelpCircle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * Inline help popover for the case form.
 * Stays open while user edits the form (non-modal).
 */
export function FormHelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center ml-1.5 text-muted-foreground hover:text-foreground transition-colors align-middle"
          aria-label="Form help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-80 max-h-[70vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-bold font-mono text-xs uppercase tracking-wider mb-1">How This Form Works</h4>
            <p className="text-muted-foreground">Fill in dates as you get them. Sections unlock as you progress through the PERM process.</p>
          </div>
          <div>
            <h4 className="font-bold font-mono text-xs uppercase tracking-wider mb-1">Sections</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li><strong>PWD</strong> — Prevailing wage filing & determination</li>
              <li><strong>Recruitment</strong> — Job ads, posting, and notice of filing</li>
              <li><strong>ETA 9089</strong> — PERM application filing & certification</li>
              <li><strong>I-140</strong> — Immigrant petition filing & outcome</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold font-mono text-xs uppercase tracking-wider mb-1">Auto-Calculation</h4>
            <p className="text-muted-foreground">Some dates calculate automatically (PWD expiration, filing windows). These show an &ldquo;auto&rdquo; badge.</p>
          </div>
          <div>
            <h4 className="font-bold font-mono text-xs uppercase tracking-wider mb-1">Saving</h4>
            <p className="text-muted-foreground">Save anytime — you don&rsquo;t need to fill everything at once. Come back later and keep editing.</p>
          </div>
          <div>
            <h4 className="font-bold font-mono text-xs uppercase tracking-wider mb-1">Validation</h4>
            <p className="text-muted-foreground">Red asterisks (*) mark required fields. Orange warnings are advisory — you can still save.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
