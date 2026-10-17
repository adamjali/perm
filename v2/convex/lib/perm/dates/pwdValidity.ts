/**
 * When the prevailing wage determination still limits a PERM case.
 *
 * 20 CFR 656.40(c): "To use a prevailing wage rate provided by the NPC,
 * employers must file their applications or begin the recruitment period
 * required by §§ 656.17(e) or 656.21 of this part within the validity period
 * specified by the NPC." Either act inside the validity period is enough.
 * The Board read it that way en banc in Karl Storz Endoscopy-America,
 * 2011-PER-00040 (Dec 1 2011): beginning the recruitment means conducting the
 * first recruitment step, and "If an employer begins its recruitment prior to
 * receiving its PWD, however, it must file its application within the PWD
 * validity period." In MPHASIS, 2011-PER-00207 (Aug 10 2015), an application
 * filed 9 days after the PWD expired was certified because recruitment had
 * begun inside it. DOL's own 2005 PERM FAQ says the same.
 *
 * So the expiry limits the filing (and the recruitment that has to fit before
 * it) only when recruitment began before the determination, began after the
 * expiry, or the determination date isn't known (the stricter reading, said
 * so wherever it's shown). Once the first recruitment step falls inside the
 * validity period, the 180-day rule of 656.17(e) alone closes the window.
 *
 * The Notice of Filing is not a recruitment step for this test (the case
 * attorney's ruling, Oct 16 2026). It has its own 30-to-180-day rule in
 * 20 CFR 656.10(d) and still counts toward the 180-day close elsewhere.
 *
 * @module convex/lib/perm/dates/pwdValidity
 */

import type { MethodDateFields } from "./filingWindow";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function day(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = value.slice(0, 10);
  return ISO_DAY.test(d) ? d : undefined;
}

/** The earliest day an additional recruitment method ran. */
function methodFirstDay(m: MethodDateFields): string | undefined {
  const days = [m.startDate, m.date, ...(m.subEntries ?? []).map((s) => s.date)]
    .map(day)
    .filter((d): d is string => !!d);
  return days.length ? days.reduce((a, b) => (a < b ? a : b)) : undefined;
}

/**
 * The first 20 CFR 656.17(e) recruitment step: the job order, the first
 * Sunday ad and, for a professional occupation, the additional steps. Never
 * the Notice of Filing.
 */
export function getFirstRecruitmentStepForPwd(data: {
  jobOrderStartDate?: string | null;
  sundayAdFirstDate?: string | null;
  additionalRecruitmentStartDate?: string | null;
  additionalRecruitmentMethods?: ReadonlyArray<MethodDateFields> | null;
  isProfessionalOccupation?: boolean | null;
  /** Accepted and ignored: the Notice of Filing doesn't begin recruitment for this test. */
  noticeOfFilingStartDate?: string | null;
}): string | undefined {
  const days = [day(data.jobOrderStartDate), day(data.sundayAdFirstDate)];
  if (data.isProfessionalOccupation) {
    days.push(day(data.additionalRecruitmentStartDate));
    for (const m of data.additionalRecruitmentMethods ?? []) days.push(methodFirstDay(m));
  }
  const present = days.filter((d): d is string => !!d);
  return present.length ? present.reduce((a, b) => (a < b ? a : b)) : undefined;
}

/**
 * - `none`: no expiry known.
 * - `not-begun`: no recruitment step yet; the expiry is the day it must begin by.
 * - `began-inside`: first step on or after the determination and on or before
 *   the expiry; the expiry no longer limits the filing.
 * - `began-before`: first step before the determination; file by the expiry.
 * - `began-after`: first step after the expiry; this determination can't be used.
 * - `determination-unknown`: recruitment began but the determination date
 *   isn't recorded; the stricter reading (file by the expiry) applies.
 */
export type PwdBearing =
  | "none"
  | "not-begun"
  | "began-inside"
  | "began-before"
  | "began-after"
  | "determination-unknown";

export interface PwdBearingInput {
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;
  /** From getFirstRecruitmentStepForPwd. */
  firstPwdStep?: string | null;
}

export function pwdBearing(input: PwdBearingInput): PwdBearing {
  const expires = day(input.pwdExpirationDate);
  if (!expires) return "none";
  const first = day(input.firstPwdStep);
  if (!first) return "not-begun";
  if (first > expires) return "began-after";
  const determined = day(input.pwdDeterminationDate);
  if (!determined) return "determination-unknown";
  if (first < determined) return "began-before";
  return "began-inside";
}

/**
 * The PWD expiration while it still limits the filing and the recruitment
 * that has to fit before it; undefined when it doesn't. Pass this, never the
 * raw expiry, wherever a window, a step deadline or a validation is capped.
 */
export function pwdFilingLimit(input: PwdBearingInput): string | undefined {
  const bearing = pwdBearing(input);
  return bearing === "began-before" || bearing === "began-after" || bearing === "determination-unknown"
    ? day(input.pwdExpirationDate)
    : undefined;
}

/** The limit, straight from a case's own dates. */
export function pwdFilingLimitFromCase(c: {
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;
  jobOrderStartDate?: string | null;
  sundayAdFirstDate?: string | null;
  additionalRecruitmentStartDate?: string | null;
  additionalRecruitmentMethods?: ReadonlyArray<MethodDateFields> | null;
  isProfessionalOccupation?: boolean | null;
}): string | undefined {
  return pwdFilingLimit({
    pwdDeterminationDate: c.pwdDeterminationDate,
    pwdExpirationDate: c.pwdExpirationDate,
    firstPwdStep: getFirstRecruitmentStepForPwd(c),
  });
}

/** The bearing, straight from a case's own dates. */
export function pwdBearingFromCase(c: Parameters<typeof pwdFilingLimitFromCase>[0]): PwdBearing {
  return pwdBearing({
    pwdDeterminationDate: c.pwdDeterminationDate,
    pwdExpirationDate: c.pwdExpirationDate,
    firstPwdStep: getFirstRecruitmentStepForPwd(c),
  });
}

/**
 * What the PWD holds a recruitment step's deadline to.
 *
 * - `none`: nothing (no expiry known, or recruitment began inside validity).
 * - `begin-by`: recruitment hasn't begun, so whichever step begins it must
 *   start on or before `date`, the expiry.
 * - `file-by`: the filing must be in by `date` (the expiry), so each step keeps
 *   its buffer before it: the old min(first + X, expiry - Y) rule.
 */
export type PwdStepLimit =
  | { kind: "none" }
  | { kind: "begin-by"; date: string }
  | { kind: "file-by"; date: string };

export function pwdStepLimit(input: PwdBearingInput): PwdStepLimit {
  const bearing = pwdBearing(input);
  const expires = day(input.pwdExpirationDate);
  if (!expires || bearing === "none" || bearing === "began-inside") return { kind: "none" };
  if (bearing === "not-begun") return { kind: "begin-by", date: expires };
  return { kind: "file-by", date: expires };
}

/** The step limit, straight from a case's own dates. */
export function pwdStepLimitFromCase(c: Parameters<typeof pwdFilingLimitFromCase>[0]): PwdStepLimit {
  return pwdStepLimit({
    pwdDeterminationDate: c.pwdDeterminationDate,
    pwdExpirationDate: c.pwdExpirationDate,
    firstPwdStep: getFirstRecruitmentStepForPwd(c),
  });
}
