import { averagePhrase, dolNow, dolPwdNow, pwdSentence, pwdWaitPhrase, queueSentence } from "@/lib/dolNow";
import { getProcessingTimes } from "@/lib/db/processingTimes";

/**
 * DOL's current figures inside an article's sentence, read when the page is
 * rendered (articles refresh daily). See lib/dolNow.ts for why nothing typed.
 *
 *   average    "336 days as of October 5, 2026"
 *   queue      the sentence naming the month analyst review is working and its average
 *   pwd        the sentence naming the wage requests DOL is deciding and their wait
 *   pwdWait    "3 to 4 months as of September 30, 2026"
 *   pwdMonth   "Jun 2026", for a stat box
 *   month      "December 2025": the month analyst review is working, for a table cell
 *   auditMonth "December 2025": the month audited cases are reviewed from
 *   pwdFullMonth   "June 2026": the PERM wage-request month, for a table cell
 *   pwdOtherMonth  "May 2026": wage requests that name another wage source than OEWS
 * Without DOL's figure a month reads "on the processing times page", never a guess.
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
  if (show === "pwd") return <span>{pwdSentence(pwd)}</span>;
  if (show === "pwdWait") return <span>{pwdWaitPhrase(pwd)}</span>;
  if (show === "pwdFullMonth") return <span>{pwd.frontier ?? NOT_READ}</span>;
  if (show === "pwdOtherMonth") return <span>{pwd.otherFrontier ?? NOT_READ}</span>;
  return <span>{pwd.frontierShort ?? "Months"}</span>;
}
