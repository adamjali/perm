import { averagePhrase, dolNow, queueSentence } from "@/lib/dolNow";
import { getProcessingTimes } from "@/lib/turso/processingTimes";

/**
 * DOL's current figures inside an article's sentence, read when the page is
 * rendered (articles refresh daily). `show="average"` renders "336 days as of
 * October 5, 2026"; `show="queue"` renders the whole sentence naming the month
 * DOL is working and its average. See lib/dolNow.ts for why nothing typed.
 */
export async function DolNow({ show = "queue" }: { show?: "average" | "queue" }) {
  const n = dolNow(await getProcessingTimes().catch(() => null));
  return <span>{show === "average" ? averagePhrase(n) : queueSentence(n)}</span>;
}
