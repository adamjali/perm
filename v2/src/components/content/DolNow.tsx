import { averagePhrase, dolNow, dolPwdNow, pwdSentence, pwdWaitPhrase, queueSentence } from "@/lib/dolNow";
import { getProcessingTimes } from "@/lib/db/processingTimes";
import { getPwdLine } from "@/lib/db/pwdDayQueue";
import { lineSentence, lineWait } from "@/lib/pwdLine";
import { longDate, monthDay } from "@convex/lib/months";

/**
 * DOL's current figures inside an article's sentence, read when the page is
 * rendered (articles refresh daily). See lib/dolNow.ts for why nothing typed.
 *
 *   average    "336 days as of October 5, 2026"
 *   queue      the sentence naming the month analyst review is working and its average
 *   pwd        the sentence naming the wage requests DOL is deciding and their wait
 *   pwdWait    "3 to 4 months as of September 30, 2026"
 *   pwdMonth   "Jul 27" (else DOL's "Jun 2026"), for a stat box
 *   month      "December 2025": the month analyst review is working, for a table cell
 *   auditMonth "December 2025": the month audited cases are reviewed from
 *   pwdFullMonth   "July 27, 2026": the PERM wage-request day (else DOL's month), for a table cell
 *   pwdOtherMonth  "May 2026": wage requests that name another wage source than OEWS
 * Without DOL's figure a month reads "on the processing times page", never a guess.
 *
 * The wage-request figures lead with our own daily check of DOL's case status
 * (src/lib/pwdLine.ts) whenever it can say where the line is: DOL's published
 * month trails it by weeks (Sep 30's table said June 2026 while DOL was deciding
 * July 27's requests on Oct 30). pwdOtherMonth stays DOL's: our check doesn't
 * split requests by wage source.
 */
/** A month DOL's table couldn't give today: where it is instead. */
const NOT_READ = "on the processing times page";

export async function DolNow({
  show = "queue",
}: {
  show?: "average" | "queue" | "pwd" | "pwdWait" | "pwdMonth" | "month" | "auditMonth" | "pwdFullMonth" | "pwdOtherMonth";
}) {
  const t = await getProcessingTimes().catch(() => null);
  if (show === "average") return <span>{averagePhrase(dolNow(t))}</span>;
  if (show === "queue") return <span>{queueSentence(dolNow(t))}</span>;
  if (show === "month") return <span>{dolNow(t).frontier ?? NOT_READ}</span>;
  if (show === "auditMonth") return <span>{dolNow(t).auditFrontier ?? NOT_READ}</span>;
  const pwd = dolPwdNow(t);
  if (show === "pwdOtherMonth") return <span>{pwd.otherFrontier ?? NOT_READ}</span>;
  const line = await getPwdLine();
  if (show === "pwd") return <span>{line ? lineSentence(line, pwd) : pwdSentence(pwd)}</span>;
  if (show === "pwdWait") return <span>{line ? lineWait(line) : pwdWaitPhrase(pwd)}</span>;
  if (show === "pwdFullMonth") return <span>{(line ? longDate(line.day) : pwd.frontier) ?? NOT_READ}</span>;
  return <span>{(line ? monthDay(line.day) : pwd.frontierShort) ?? "Months"}</span>;
}
