import { likelyCapExempt, type IndustryRow } from "@/lib/capExempt";

/**
 * A one-line inference, said as one: most of this employer's filings name a
 * college or university, which files H-1B petitions outside the lottery.
 */
export function CapExemptNote({ industry }: { industry: IndustryRow[] | null | undefined }) {
  const hit = likelyCapExempt(industry);
  if (!hit) return null;
  return (
    <p className="mt-10 border-2 border-border bg-tint-primary p-4 text-base leading-relaxed">
      <b className="font-bold">Likely cap-exempt, by inference.</b> {Math.round(hit.share * 100)}% of its coded PERM
      filings name NAICS 611310 ({hit.label}), and colleges hire H-1B workers outside the lottery (8 U.S.C.
      1184(g)(5)(A)). Whether this employer qualifies is USCIS&apos;s call.
    </p>
  );
}
