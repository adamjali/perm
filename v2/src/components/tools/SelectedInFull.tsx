/**
 * The chosen option of a native select, printed in full beneath it.
 *
 * A native <select> cannot wrap its chosen label and clips it at the
 * chevron, and nothing on a phone expands it: "Riverside-San Bernardino-
 * Ontario, CA" reads as "Riverside-San Bernardi" with no way to see the
 * rest. Static labels are shortened to fit and gated by
 * scripts/audit_placeholders.py; labels that come from DOL's own data (an
 * OEWS area, an occupation title up to 79 characters) cannot be, so the
 * selects that carry them render this under the control. It prints only
 * when the label is long enough to be at risk, so a short choice is not
 * repeated twice on the screen.
 */

const SHOW_FROM = 26;

export function SelectedInFull({ label }: { label: string | null | undefined }) {
  if (!label || label.length < SHOW_FROM) return null;
  return (
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground" data-selected-in-full>
      Selected: <span className="font-bold text-foreground/80">{label}</span>
    </p>
  );
}
