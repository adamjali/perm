/**
 * Where the pending counts come from, and how far behind they can be.
 *
 * TWO THINGS A READER HAS TO BE TOLD ONCE, PLAINLY, AND THIS PAGE HAS NOT
 * BEEN TELLING THEM.
 *
 * FIRST, THE COUNTS ARE SECOND HAND. DOL publishes no API for per-case status
 * and its own status endpoint is gated, which is the entire reason a mirror
 * exists. Every one of the 412,865 rows carries
 * `permtrack.app/api/watchlist (mirror; underlying: flag.dol.gov case status)`
 * in its own source column. That does not weaken the figures, which are still
 * the only ones of their kind anywhere, but "we read DOL" and "we read
 * somebody who reads DOL" are different claims and the page was making the
 * first one.
 *
 * The decided history is the opposite: `perm_cases` is DOL's own quarterly
 * disclosure release, first-party, with its own as-of date. A reader who
 * assumes one date covers both will be wrong about which, so both dataset
 * keys go to `DataProvenance` on any page carrying both.
 *
 * SECOND, IT IS A SNAPSHOT AND NOT A LIVE READING. The scan re-checks cases
 * on a rolling basis, and 79.8% of currently-pending cases were last verified
 * before 2026-08-01. A case decided since then still reads as pending here,
 * so the backlog figure is a slight OVERCOUNT, and that direction is stated
 * rather than left for a reader to guess. It is the safe direction for a wait
 * figure, which is not a reason to leave it unsaid.
 */

/** DOL's own case-status search: the authority the mirror is reading. */
export const DOL_CASE_STATUS_URL = "https://flag.dol.gov/casestatus";

export function MirrorNote({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-base leading-relaxed text-foreground/80"}>
      Anything undecided here comes from a per-case scan of DOL&rsquo;s FLAG
      case-status pages, mirrored from a third-party tracker rather than read
      from DOL directly, because DOL publishes no interface for it.{" "}
      <a
        href={DOL_CASE_STATUS_URL}
        className="font-bold underline underline-offset-2 hover:text-primary"
        rel="noopener"
      >
        DOL&rsquo;s own case-status search
      </a>{" "}
      is the authority for any single case. The scan re-checks cases in
      rotation, so these are the statuses it last saw and not a live reading:
      most pending cases were last verified in the weeks before the date below,
      and a case decided since then still counts as waiting here. The backlog
      figures are therefore a little high rather than a little low.
    </p>
  );
}
