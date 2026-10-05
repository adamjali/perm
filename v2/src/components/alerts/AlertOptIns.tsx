import { MAIL_KINDS } from "@/lib/mailKinds";
import { cn } from "@/lib/utils";

/**
 * The parts every alert form shares: the opt-in boxes for the weekly digest
 * and product news, and the note under the form. One wording for all of them,
 * named from the shared email list, so the forms can't drift apart.
 */

const OPT_IN_TEXT = {
  newsletter: `Also send the ${MAIL_KINDS.newsletter.name.toLowerCase()}, ${MAIL_KINDS.newsletter.when}: DOL's queue, visa bulletin moves, USCIS times and new rules.`,
  news: `Also send ${MAIL_KINDS.news.name.toLowerCase()}, now and then.`,
} as const;

/** A tick drawn into the checked box, so its state never rests on colour alone. */
const TICK =
  "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8.5l3 3 7-7' fill='none' stroke='black' stroke-width='2.5'/%3E%3C/svg%3E\")] checked:bg-center checked:bg-no-repeat";

export function OptInBox({
  id,
  kind,
  checked,
  onChange,
  className,
}: {
  id: string;
  kind: "newsletter" | "news";
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "mt-0.5 size-5 shrink-0 cursor-pointer appearance-none border-2 border-border bg-background checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          TICK,
        )}
      />{" "}
      <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
        {OPT_IN_TEXT[kind]} Same confirmation, off unless you tick it.
      </label>
    </div>
  );
}

/**
 * The note under an alert form. The confirmation pace is fixed text on every
 * render, never a message that depends on the address: a reply that varied
 * would tell a stranger whether an address is signed up.
 */
export function AlertNote({ limit, id, className }: { limit?: string; id?: string; className?: string }) {
  return (
    <p id={id} className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
      You confirm by email first, and one click turns it off. One alert email a day at most.
      {limit ? ` ${limit}` : ""} One confirmation per address every 10 minutes: if none arrives, wait
      that long before trying again.
    </p>
  );
}
