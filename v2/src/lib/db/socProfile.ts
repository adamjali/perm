import "server-only";

import { shownApprovalRate, shownMedian } from "@/lib/entityPayload";
import { codeHref } from "@/lib/socFinder";
import { socGroup } from "@/lib/socCode";
import { PROFILE_TITLES, type SocProfile } from "@/lib/socProfile";
import { titleSlug } from "@/lib/socTitleKey";
import { getEntityBySlug } from "./publicData";
import { codeSummaries, onetReference } from "./reference";
import { getSocCodes, titlesForCode } from "./socTitles";

/** Every task O*NET's loader keeps for a job (scripts/ingest_onet.py, TOP_TASKS). */
const ALL_TASKS = 50;

/**
 * One SOC code's profile, for the signed-in app's case form and case page and the public pages that set one
 * code out: O*NET's description and tasks, how employers titled it in DOL's files, and its PERM figures under
 * the site's floors. Null for a code neither DOL's files nor O*NET hold. Throws when a read fails ("no such
 * table" aside, which the readers below answer as empty), so a caller says the code couldn't be read rather
 * than that it doesn't exist.
 */
export async function socProfile(raw: string): Promise<SocProfile | null> {
  const soc = socGroup(raw);
  if (!soc) return null;
  const codes = await getSocCodes();
  const code = codes?.codes.get(soc) ?? null;
  const [summaries, titles, row, reference] = await Promise.all([
    codeSummaries([soc], ALL_TASKS),
    titlesForCode(soc, PROFILE_TITLES),
    code?.slug ? getEntityBySlug("occupation", code.slug) : Promise.resolve(null),
    onetReference(),
  ]);
  const summary = summaries.get(soc);
  if (!code && !summary) return null;
  const codeFilings = code ? code.perm + code.pwd + code.lca : 0;
  const pageMin = codes?.pageMin ?? Infinity;
  return {
    soc,
    title: code?.title || summary?.title || soc,
    description: summary?.description || null,
    tasks: summary?.tasks ?? [],
    jobZone: summary?.jobZone ?? code?.zone ?? null,
    zoneLabel: summary?.zoneLabel ?? null,
    zoneName: summary?.zoneName ?? null,
    onetVersion: summary ? reference.version : null,
    href: codeHref(soc, code?.slug ?? null),
    figures: row
      ? {
          filings: row.total,
          decided: row.certified + row.denied,
          certified: row.certified,
          approvalRate: shownApprovalRate(row),
          medianWage: shownMedian(row.medianAnnualWage, row),
        }
      : null,
    codeFilings,
    titles: titles.filed.map((t) => ({
      title: t.title,
      filings: t.filings,
      share: codeFilings > 0 ? t.filings / codeFilings : 0,
      href: t.keyFilings >= pageMin ? `/soc-codes/${titleSlug(t.key)}` : null,
    })),
  };
}
