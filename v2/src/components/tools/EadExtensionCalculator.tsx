"use client";

import { useId, useMemo, useState } from "react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { EAD_CATEGORIES, EXTENSION_DAYS, eadExtension, type EadVerdict } from "@/lib/eadExtension";

/**
 * Was my work permit automatically extended, and to when? From the card's
 * date, the renewal receipt's date and the category. The verdict is the
 * rule's, with its citation; the page above it quotes the rules.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function verdictText(v: EadVerdict, expires: string): { head: string; body: string; ok: boolean } {
  switch (v.kind) {
    case "extended":
      return {
        ok: true,
        head: `Extended through ${long(v.through)}`,
        body: v.byI94
          ? `Up to ${EXTENSION_DAYS} days after the card's date, but this category also ends with the I-94, which comes first. The card and the I-797C receipt together are the proof (8 CFR 274a.13(d)(4)). A denial of the renewal ends it at once.`
          : `${EXTENSION_DAYS} days after ${long(expires)}, unless USCIS decides the renewal sooner; a denial ends it at once (8 CFR 274a.13(d)(3)). The card and the I-797C receipt together are the proof (8 CFR 274a.13(d)(4)).`,
      };
    case "after-cutoff":
      return {
        ok: false,
        head: "Not extended",
        body: "A renewal received on or after October 30, 2025 doesn't extend the card (8 CFR 274a.13(e), added by the interim final rule at 90 FR 48799). The card is good through the date printed on it; after that, work authorization waits for the new card unless your status itself authorizes work.",
      };
    case "filed-late":
      return {
        ok: false,
        head: "Not extended",
        body: "The renewal has to be received before the card's own expiration date (8 CFR 274a.13(d)(1)(i)).",
      };
    case "not-eligible":
      return {
        ok: false,
        head: "Not extended",
        body: "That category isn't on USCIS's list of categories the automatic extension covered (8 CFR 274a.13(d)(1)(iii)).",
      };
    case "different-category":
      return {
        ok: false,
        head: "Not extended",
        body: "The renewal has to be in the same category as the card (8 CFR 274a.13(d)(1)(ii)).",
      };
    case "tps":
      return {
        ok: false,
        head: "Set by your TPS notice",
        body: "A TPS-based card follows the Federal Register notice for your country's designation, which this calculator doesn't read. USCIS's TPS page for your country lists it.",
      };
    case "no-renewal":
      return { ok: false, head: "No renewal, no extension", body: "Without a renewal on file, the card is good through the date printed on it." };
  }
}

export function EadExtensionCalculator() {
  const expiresId = useId();
  const receivedId = useId();
  const categoryId = useId();
  const i94Id = useId();
  const [expires, setExpires] = useState("");
  const [received, setReceived] = useState("");
  const [category, setCategory] = useState("C09");
  const [same, setSame] = useState(true);
  const [i94, setI94] = useState("");
  const capsAtI94 = EAD_CATEGORIES.find((c) => c.code === category)?.capsAtI94 ?? false;

  const result = useMemo(() => {
    if (!DATE_RE.test(expires)) return null;
    try {
      const v = eadExtension({
        cardExpires: expires,
        renewalReceived: DATE_RE.test(received) ? received : null,
        category,
        sameCategory: same,
        i94Until: DATE_RE.test(i94) ? i94 : null,
      });
      return verdictText(v, expires);
    } catch {
      return null;
    }
  }, [expires, received, category, same, i94]);

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <Label htmlFor={expiresId}>&quot;Card Expires&quot; date on the EAD</Label>{" "}
          <DateInput id={expiresId} value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-1.5" />
        </div>{" "}
        <div>
          <Label htmlFor={receivedId}>&quot;Received Date&quot; on the renewal&apos;s I-797C</Label>{" "}
          <DateInput id={receivedId} value={received} onChange={(e) => setReceived(e.target.value)} className="mt-1.5" />
        </div>{" "}
        <div>
          <Label htmlFor={categoryId}>Category on the receipt</Label>{" "}
          <select
            id={categoryId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1.5 min-h-[44px] w-full border-2 border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {EAD_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {`(${c.code.slice(0, 1).toLowerCase()})(${Number(c.code.slice(1))}) ${c.label}`}
              </option>
            ))}
            <option value="OTHER">Another category</option>
          </select>
        </div>{" "}
        {capsAtI94 ? (
          <div>
            <Label htmlFor={i94Id}>Your I-94&apos;s end date</Label>{" "}
            <DateInput id={i94Id} value={i94} onChange={(e) => setI94(e.target.value)} className="mt-1.5" />
          </div>
        ) : null}
      </div>{" "}
      <label className="mt-4 flex min-h-[44px] items-center gap-2 text-base">
        <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} className="size-5" />
        The renewal is in the same category as the card
      </label>{" "}
      <div className="mt-5 border-t-2 border-border pt-4" aria-live="polite">
        {result ? (
          <>
            <p className={`font-heading text-2xl font-black ${result.ok ? "" : "text-data-warn-ink"}`}>{result.head}</p>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">{result.body}</p>
          </>
        ) : (
          <p className="text-base text-foreground/70">Enter the date on the card to see the answer.</p>
        )}
      </div>
    </div>
  );
}
