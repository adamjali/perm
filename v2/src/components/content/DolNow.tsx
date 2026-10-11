import { averagePhrase, dolNow, dolPwdNow, pwdSentence, pwdWaitPhrase, queueSentence } from "@/lib/dolNow";
import { getProcessingTimes } from "@/lib/turso/processingTimes";

/**
 * DOL's current figures inside an article's sentence, read when the page is
 * rendered (articles refresh daily). See lib/dolNow.ts for why nothing typed.
 *
 *   average    "336 days as of October 5, 2026"
 *   queue      the sentence naming the month analyst review is working and its average
 *   pwd        the sentence naming the wage requests DOL is deciding and their wait
 *   pwdWait    "3 to 4 months as of September 30, 2026"
 *   pwdMonth   "Jun 2026", for a stat box
 */
export async function DolNow({
  show = "queue",
}: {
  show?: "average" | "queue" | "pwd" | "pwdWait" | "pwdMonth";
}) {
  const t = await getProcessingTimes().catch(() => null);
  if (show === "average") return <span>{averagePhrase(dolNow(t))}</span>;
  if (show === "queue") return <span>{queueSentence(dolNow(t))}</span>;
  const pwd = dolPwdNow(t);
  if (show === "pwd") return <span>{pwdSentence(pwd)}</span>;
  if (show === "pwdWait") return <span>{pwdWaitPhrase(pwd)}</span>;
  return <span>{pwd.frontierShort ?? "Months"}</span>;
}
