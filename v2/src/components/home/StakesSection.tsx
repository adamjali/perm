import { ShieldCheckIcon, WarningIcon } from "@phosphor-icons/react/ssr";

import { DEFAULT_REMINDER_DAYS } from "@convex/lib/userDefaults";
import {
  CERTIFICATION_RULE_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  FILING_WINDOW_WAIT_DAYS,
  RFI_DUE_DAYS,
} from "@convex/lib/perm/constants";

/**
 * The attorney page's case for computing deadlines: each deadline that can
 * lose a case, what missing it costs, and what the app does about it, as
 * warning cards edged in the deadline colours (round 2, Oct 15 2026: red for a
 * deadline that ends the case, orange for one that sends it back). The figures
 * read from the same constants the deadline rules use.
 */

const reminders = [...DEFAULT_REMINDER_DAYS].sort((a, b) => b - a);
const reminderWords = `${reminders.slice(0, -1).join(", ")} and ${reminders[reminders.length - 1]} days before`;

const STAKES = [
  {
    title: "RFI response",
    severity: "critical",
    cost: `DOL's request for information gives ${RFI_DUE_DAYS} days. A late answer and the case is denied.`,
    handled: `Due date set from the RFI date, with reminders ${reminderWords}.`,
  },
  {
    title: "Wage determination expiry",
    severity: "critical",
    cost: "A prevailing wage determination expires under 20 CFR 656.40. File after it and the case starts over.",
    handled: "Expiry worked out from the determination date under DOL's rules.",
  },
  {
    title: "ETA 9089 filing window",
    severity: "high",
    cost: `It opens ${FILING_WINDOW_WAIT_DAYS} days after the last recruitment step and closes ${FILING_WINDOW_CLOSE_DAYS} days after the first, or when the wage determination expires if sooner. Miss it and recruitment is redone.`,
    handled: "Open and close dates from the recruitment dates and the wage expiry.",
  },
  {
    title: "I-140 filing",
    severity: "high",
    cost: `A certification is valid for ${CERTIFICATION_RULE_DAYS} days (20 CFR 656.30). Miss it and the labor certification lapses.`,
    handled: "The last filing day, as DOL prints it, set from the certification date.",
  },
  {
    title: "Recruitment timing",
    severity: "high",
    cost: "Sunday ads, the job order and the notice of filing each have their own timing rules. A gap invites an audit.",
    handled: "Every step dated, business days counted where the rule says so.",
  },
] as const;

const EDGE = {
  critical: "border-l-urgency-urgent",
  high: "border-l-urgency-soon",
} as const;
const MARK = {
  critical: "text-urgency-urgent",
  high: "text-urgency-soon",
} as const;

export function StakesSection() {
  return (
    <section id="stakes" aria-labelledby="stakes-title" className="border-t-2 border-black bg-muted">
      <div className="mx-auto max-w-[1300px] px-4 py-16 sm:px-8 sm:py-20">
        <h2 id="stakes-title" className="font-heading text-3xl font-bold sm:text-4xl">
          What a missed deadline costs
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-soft">
          PERM deadlines are counted in days. These are the {STAKES.length} that lose a case, and what the app does about
          each.
        </p>{" "}
        <ul className="mt-10 grid grid-cols-1 gap-5 [&>*]:min-w-0 md:grid-cols-2 xl:grid-cols-3">
          {STAKES.map((s) => (
            <li
              key={s.title}
              className={`lift flex flex-col border-2 border-l-[6px] border-black bg-card p-5 shadow-hard ${EDGE[s.severity]}`}
            >
              <WarningIcon weight="fill" aria-hidden="true" className={`size-9 ${MARK[s.severity]}`} />{" "}
              <h3 className="mt-3 font-heading text-xl font-bold">{s.title}</h3>{" "}
              <p className="mb-4 mt-2 text-base leading-relaxed text-soft">{s.cost}</p>{" "}
              <p className="mt-auto flex gap-2 border-t-2 border-border pt-4 text-base leading-relaxed">
                <ShieldCheckIcon weight="fill" aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-text" />{" "}
                <span>{s.handled}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
