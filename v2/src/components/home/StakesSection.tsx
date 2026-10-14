import { DEFAULT_REMINDER_DAYS } from "@convex/lib/userDefaults";
import {
  CERTIFICATION_RULE_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  FILING_WINDOW_WAIT_DAYS,
  RFI_DUE_DAYS,
} from "@convex/lib/perm/constants";

/**
 * The attorney page's case for computing deadlines: each deadline that can
 * lose a case, what missing it costs, and what the app does about it. A plain
 * list, the figures read from the same constants the deadline rules use.
 */

const reminders = [...DEFAULT_REMINDER_DAYS].sort((a, b) => b - a);
const reminderWords = `${reminders.slice(0, -1).join(", ")} and ${reminders[reminders.length - 1]} days before`;

const STAKES = [
  {
    title: "RFI response",
    cost: `DOL's request for information gives ${RFI_DUE_DAYS} days. A late answer and the case is denied.`,
    handled: `Due date set from the RFI date, with reminders ${reminderWords}.`,
  },
  {
    title: "Wage determination expiry",
    cost: "A prevailing wage determination expires under 20 CFR 656.40. File after it and the case starts over.",
    handled: "Expiry worked out from the determination date under DOL's rules.",
  },
  {
    title: "ETA 9089 filing window",
    cost: `It opens ${FILING_WINDOW_WAIT_DAYS} days after the last recruitment step and closes ${FILING_WINDOW_CLOSE_DAYS} days after the first, or when the wage determination expires if sooner. Miss it and recruitment is redone.`,
    handled: "Open and close dates from the recruitment dates and the wage expiry.",
  },
  {
    title: "I-140 filing",
    cost: `A certification is valid for ${CERTIFICATION_RULE_DAYS} days (20 CFR 656.30). Miss it and the labor certification lapses.`,
    handled: "The last filing day, as DOL prints it, set from the certification date.",
  },
  {
    title: "Recruitment timing",
    cost: "Sunday ads, the job order and the notice of filing each have their own timing rules. A gap invites an audit.",
    handled: "Every step dated, business days counted where the rule says so.",
  },
] as const;

export function StakesSection() {
  return (
    <section id="stakes" aria-labelledby="stakes-title" className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8 sm:py-20">
        <h2 id="stakes-title" className="font-heading text-2xl font-bold sm:text-3xl">
          What a missed deadline costs
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-soft">
          PERM deadlines are counted in days. These are the {STAKES.length} that lose a case, and what the app does about
          each.
        </p>{" "}
        <dl className="mt-10 divide-y divide-border border-y border-border">
          {STAKES.map((s) => (
            <div key={s.title} className="grid grid-cols-1 gap-x-8 gap-y-2 py-5 md:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1fr)]">
              <dt className="font-heading text-lg font-bold">{s.title}</dt>{" "}
              <dd className="text-base leading-relaxed text-soft">{s.cost}</dd>{" "}
              <dd className="text-base leading-relaxed">{s.handled}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
