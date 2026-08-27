import { calculatePWDExpiration } from "@/lib/perm";
import { formatAsOf } from "@/lib/dolFormat";

/**
 * How long a determination lasts, and the cliff in the middle of the rule.
 *
 * Everyone waiting on a prevailing wage request is watching the queue. Almost
 * nobody is watching what happens on the day theirs comes out, and it matters
 * more: under 20 CFR 656.40(c) the validity period is not a fixed number of
 * days from issue, it is anchored to the OEWS wage year. A determination
 * issued on 30 June is good for 90 days. One issued on 1 July is good until
 * the following 30 June. Same office, one day apart, four times the runway.
 *
 * That is the one fact on this page a reader can act on. Recruitment, the
 * quiet period and the filing window all have to fit inside the validity
 * period, and 90 days is tight for a sequence whose 30-day job order and
 * 30-day quiet period alone consume two thirds of it.
 *
 * EVERY NUMBER HERE IS COMPUTED BY `calculatePWDExpiration`, NEVER WRITTEN
 * DOWN. The wage-year rule is exactly the kind of "obvious" arithmetic that
 * gets asserted from memory and is wrong: a test in this repo already records
 * an author assuming determination-plus-90-days and being corrected by the
 * calculator. Deriving the table from the same function the tracker runs means
 * a page and a case cannot disagree, and if DOL changes the rule the drawing
 * follows it.
 */

interface Regime {
  /** First issue date the regime covers, ISO. */
  from: string;
  /** Last issue date the regime covers, ISO. */
  to: string;
  rule: string;
}

/** Days between two ISO dates, inclusive of neither endpoint's time of day. */
function daysBetweenIso(from: string, to: string): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS,
  );
}

function regimes(year: number): Regime[] {
  return [
    {
      from: `${year}-01-01`,
      to: `${year}-04-01`,
      rule: "Runs to 30 June of the same year, so the later in this stretch it issues the less is left.",
    },
    {
      from: `${year}-04-02`,
      to: `${year}-06-30`,
      rule: "Ninety days from the determination date, flat. The shortest window the rule produces.",
    },
    {
      from: `${year}-07-01`,
      to: `${year}-12-31`,
      rule: "Runs to 30 June of the following year. A determination on 1 July gets almost the whole wage year.",
    },
  ];
}

function Row({ regime }: { regime: Regime }) {
  const fromExpiry = calculatePWDExpiration(regime.from);
  const toExpiry = calculatePWDExpiration(regime.to);
  const longest = daysBetweenIso(regime.from, fromExpiry);
  const shortest = daysBetweenIso(regime.to, toExpiry);
  const flat = longest === shortest;

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Issued {formatAsOf(regime.from)} to {formatAsOf(regime.to)}
        </p>{" "}
        <p className="font-heading text-2xl font-black tabular-nums">
          {flat ? `${longest} days` : `${shortest} to ${longest} days`}
        </p>
      </div>{" "}
      <p className="mt-2 text-base leading-relaxed text-foreground/70">{regime.rule}</p>
    </div>
  );
}

export function PwdValidityWindow({ className }: { className?: string }) {
  // Anchored on the current wage year so the dates are the ones a reader is
  // actually planning against. The page revalidates daily, so it rolls over
  // with the calendar rather than freezing on the year it was built.
  const year = new Date().getUTCFullYear();
  const rows = regimes(year);

  // The cliff, measured rather than asserted: the last day of the short regime
  // against the first day of the long one.
  const cliffBefore = `${year}-06-30`;
  const cliffAfter = `${year}-07-01`;
  const shortDays = daysBetweenIso(cliffBefore, calculatePWDExpiration(cliffBefore));
  const longDays = daysBetweenIso(cliffAfter, calculatePWDExpiration(cliffAfter));
  const multiple = (longDays / shortDays).toFixed(1);

  return (
    <div className={className}>
      <div className="border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
          One day, {multiple} times the runway
        </p>{" "}
        <p className="mt-3 font-heading text-2xl font-black leading-tight sm:text-3xl">
          A determination issued {formatAsOf(cliffBefore)} is valid {shortDays}{" "}
          days. One issued {formatAsOf(cliffAfter)} is valid {longDays}.
        </p>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-background/80">
          The validity period is anchored to the wage year, not counted from
          your determination date. Recruitment, the 30-day job order and the
          30-day quiet period all have to finish inside it, so which side of 30
          June yours lands on decides whether that is comfortable or tight.
        </p>
      </div>

      <div className="mt-6 divide-y-2 divide-border border-2 border-border bg-card shadow-hard">
        {rows.map((r) => (
          <Row key={r.from} regime={r} />
        ))}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground/60">
        20 CFR 656.40(c), computed for {year} by the same function that runs on
        a tracked case. You can&apos;t choose your determination date, but the
        queue position above says roughly when yours is coming, and that&apos;s
        enough to know which of these you are planning inside.
      </p>
    </div>
  );
}
