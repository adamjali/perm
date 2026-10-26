import { CaretRightIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";

import { MAIL_KINDS } from "@/lib/mailKinds";
import { cn } from "@/lib/utils";

/**
 * The parts every alert form shares (case, queue month, bulletin, employer):
 * the email box, the note under the form, the opt-in boxes and the line that
 * replaces the form once it's sent. One wording and one look for all four,
 * named from the shared email list, so the forms can't drift apart.
 */

/** The email box. 16px text at every width, so a phone never zooms in. */
export function EmailField({
  id,
  value,
  onChange,
  describedBy,
  invalid,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="email"
      name="email"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="you@example.com"
      autoComplete="email"
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
      className={cn(
        "h-12 w-full min-w-0 border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    />
  );
}

/**
 * The note under an alert form. Fixed text on every render, never a message
 * that depends on the address: a reply that varied would tell a stranger
 * whether an address is signed up. The rest of the rules (one email a day for
 * bundled alerts, one confirmation every 10 minutes) are said once the form
 * has been sent, which is when they apply.
 */
export function AlertNote({ limit, id, className }: { limit?: string; id?: string; className?: string }) {
  return (
    <p id={id} className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
      You confirm by email first. One click turns it off.{limit ? ` ${limit}` : ""}
    </p>
  );
}

/**
 * What replaces a form once it's sent: the server's own words, verbatim (they
 * are the same for every address on purpose), then the fixed rules.
 */
export function AlertDone({ message, queued, className }: { message: string; queued?: boolean; className?: string }) {
  return (
    <p role="status" aria-live="polite" className={cn("flex items-start gap-2 text-base leading-relaxed text-soft", className)}>
      <CheckCircleIcon className="mt-1 size-5 shrink-0 text-data-good-ink" weight="fill" aria-hidden="true" />{" "}
      <span>
        <b className="font-semibold text-foreground">{message}</b>{" "}
        {queued ? "Confirm it when it arrives; nothing is sent until you do." : "Nothing is sent until you confirm."} No
        email within 10 minutes? Try again then. A change to a case is emailed at once; other alerts from one day come
        together in one email.
      </span>
    </p>
  );
}

const OPT_IN_TEXT = {
  newsletter: `The ${MAIL_KINDS.newsletter.name.toLowerCase()}, ${MAIL_KINDS.newsletter.when}: DOL's queue, visa bulletin moves, USCIS times and new rules.`,
  news: `${MAIL_KINDS.news.name}, now and then.`,
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
  // The whole row is the label and at least 44px tall: a one-line row on a
  // 390px phone had been a 23px target. No negative margin: two boxes sit 12px
  // apart, and stretched hit areas would overlap.
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-2.5 py-2.5", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "mt-0.5 size-5 shrink-0 cursor-pointer appearance-none border border-input bg-card checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          TICK,
        )}
      />{" "}
      <span className="text-sm leading-relaxed text-soft">{OPT_IN_TEXT[kind]}</span>
    </label>
  );
}

/**
 * The two opt-in boxes, folded under one line. Both are off unless ticked and
 * ride the same confirmation as the alert, so folding them hides no consent:
 * it only keeps the form to one box and one button.
 */
export function OptInFold({
  id,
  news,
  newsletter,
  onNews,
  onNewsletter,
  className,
}: {
  id: string;
  news: boolean;
  newsletter: boolean;
  onNews: (checked: boolean) => void;
  onNewsletter: (checked: boolean) => void;
  className?: string;
}) {
  const ticked = (news ? 1 : 0) + (newsletter ? 1 : 0);
  return (
    <details className={cn("group", className)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <CaretRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" weight="bold" aria-hidden="true" />{" "}
        Other emails{ticked > 0 ? ` (${ticked} added)` : ""}
      </summary>{" "}
      <div className="space-y-3 pb-1 pl-5">
        <OptInBox id={`${id}-newsletter`} kind="newsletter" checked={newsletter} onChange={onNewsletter} />{" "}
        <OptInBox id={`${id}-news`} kind="news" checked={news} onChange={onNews} />{" "}
        <p className="text-sm text-muted-foreground">Off unless you tick them; the same confirmation covers them.</p>
      </div>
    </details>
  );
}
