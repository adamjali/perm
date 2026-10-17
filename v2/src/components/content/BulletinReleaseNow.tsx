import { BulletinRelease } from "@/components/bulletin/BulletinRelease";
import { BULLETIN_CAPTURES_MEASURED, BULLETIN_FIRST_CAPTURES } from "@/lib/bulletinCaptures";
import { nextBulletinMonth } from "@/lib/bulletinNext";
import { releaseByDay, releaseSummary } from "@/lib/bulletinRelease";
import { getVisaBulletins } from "@/lib/db/publicData";

/**
 * When the next visa bulletin usually comes out, for an article: the same
 * chart the bulletin page draws, from each past bulletin's first Internet
 * Archive capture (a floor on the day it was out), aimed at the bulletin after
 * the newest one this site holds. Nothing when the archive can't be read: the
 * article's own text already says the State Department announces no date.
 */
export async function BulletinReleaseNow() {
  const summary = releaseSummary(BULLETIN_FIRST_CAPTURES);
  if (!summary) return null;
  const held = await getVisaBulletins().catch(() => []);
  const newest = held.map((b) => b.bulletinMonth).sort().pop();
  if (!newest) return null;
  return (
    <BulletinRelease
      rows={releaseByDay(BULLETIN_FIRST_CAPTURES)}
      summary={summary}
      next={nextBulletinMonth(newest)}
      measured={BULLETIN_CAPTURES_MEASURED}
    />
  );
}
