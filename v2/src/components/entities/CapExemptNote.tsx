import Link from "next/link";

import { KIND_WORDS, likelyCapExempt, type AcwiaAnswer, type IndustryRow } from "@/lib/capExempt";
import { formatInt } from "@/lib/format";

/**
 * A one-line inference, said as one. First choice is the employer's own answer
 * to DOL: most of its wage requests say ACWIA covers it, the same rule as
 * /h1b-cap-exempt-employers. Otherwise most of its PERM filings name a college
 * or university's industry code. Either way, USCIS decides.
 */
export function CapExemptNote({ industry, acwia }: { industry: IndustryRow[] | null | undefined; acwia?: AcwiaAnswer | null }) {
  if (acwia) {
    const kind = acwia.kind ? KIND_WORDS[acwia.kind].one.toLowerCase() : null;
    return (
      <p className="mt-10 border-2 border-border bg-sage p-4 text-base leading-relaxed">
        <b className="font-bold">Likely cap-exempt.</b> Of its {formatInt(acwia.answered)} wage requests that answered the
        question, {formatInt(acwia.requests)} tell DOL that ACWIA covers it{kind ? `, as a ${kind}` : ""}. Employers of that
        kind hire H-1B workers outside the lottery (8 CFR 214.2(h)(8)(iii)(F)); whether it qualifies is USCIS&apos;s call.{" "}
        <Link href="/h1b-cap-exempt-employers" className="link">
          Every employer that says so
        </Link>
      </p>
    );
  }
  const hit = likelyCapExempt(industry);
  if (!hit) return null;
  return (
    <p className="mt-10 bg-sage p-4 text-base leading-relaxed border-2 border-border">
      <b className="font-bold">Likely cap-exempt, by inference.</b> {Math.round(hit.share * 100)}% of its coded PERM
      filings name NAICS 611310 ({hit.label}), and colleges hire H-1B workers outside the lottery (8 U.S.C.
      1184(g)(5)(A)). Whether this employer qualifies is USCIS&apos;s call.
    </p>
  );
}
