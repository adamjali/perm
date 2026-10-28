"use client";

import { useId, useMemo, useState } from "react";

import { ROUTE_LABEL } from "@/components/tools/greenCardRoute";
import { Label } from "@/components/ui/label";
import { calculateGreenCardFees, FEE_SCHEDULE, GREEN_CARD_ROUTES, STATE_FEES, type FeeInput, type GreenCardRoute } from "@/lib/perm";

/**
 * USCIS fees for one employment-based case, from Form G-1055.
 *
 * Every number comes from one edition of the fee schedule and the edition
 * is printed under the total. The form asks only what changes a fee: who the
 * petitioner is (the asylum program fee tier), where the green card is got
 * (inside the US or at a consulate), the filing channel, premium processing,
 * and how many people immigrate. What the table leaves out is named
 * under it, because a total that reads as the whole cost is worse than none.
 */

/** One fill per fee line, in the order the schedule lists them. */
const FEE_FILLS = ["bg-primary", "bg-foreground", "bg-stage-pwd", "bg-data-warn-ink", "bg-stage-recruitment", "bg-data-info"] as const;

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const NUMBER = "mt-1.5 min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Count({ id, label, value, onChange, note }: { id: string; label: string; value: number; onChange: (n: number) => void; note?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>{" "}
      <input id={id} type="number" inputMode="numeric" min={0} max={20} value={value} onChange={(e) => onChange(Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0))))} className={NUMBER} />{" "}
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function GreenCardFeesCalculator() {
  const petitionerId = useId();
  const onlineId = useId();
  const premiumId = useId();
  const adultsId = useId();
  const childrenId = useId();
  const permitsId = useId();
  const travelId = useId();
  const routeName = useId();
  const [route, setRoute] = useState<GreenCardRoute>("aos");
  const [petitioner, setPetitioner] = useState<FeeInput["petitioner"]>("regular");
  const [online, setOnline] = useState(false);
  const [premium, setPremium] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [permits, setPermits] = useState(1);
  const [travel, setTravel] = useState(1);

  const result = useMemo(
    () => calculateGreenCardFees({ petitioner, online, route, premium, adults, children, workPermits: permits, travelDocuments: travel }),
    [petitioner, online, route, premium, adults, children, permits, travel],
  );

  return (
    <div className="object p-5 sm:p-8">
      <fieldset>
        <legend className="text-sm font-medium">Where you&apos;ll get the green card</legend>{" "}
        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
          {GREEN_CARD_ROUTES.map((r) => (
            <label
              key={r}
              htmlFor={`${routeName}-${r}`}
              className="flex min-h-11 cursor-pointer items-start gap-3 border-2 border-input px-3 py-2 has-[:checked]:border-foreground has-[:checked]:bg-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
            >
              <input
                id={`${routeName}-${r}`}
                type="radio"
                name={routeName}
                value={r}
                checked={route === r}
                onChange={() => setRoute(r)}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />{" "}
              <span className="min-w-0">
                <span className="block font-semibold">{ROUTE_LABEL[r].name}</span>{" "}
                <span className="block text-sm text-soft">{ROUTE_LABEL[r].note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>{" "}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={petitionerId}>Petitioner</Label>{" "}
          <select id={petitionerId} value={petitioner} onChange={(e) => setPetitioner(e.target.value as FeeInput["petitioner"])} className={NUMBER}>
            <option value="regular">Employer, 26+ employees</option>
            <option value="small">Employer, 25 or fewer</option>
            <option value="nonprofit">Nonprofit</option>
          </select>{" "}
          <p className="mt-1 text-sm text-muted-foreground">Sets the asylum program fee USCIS charges with every I-140, counted in full-time employees. A self-petitioner pays the 25-or-fewer amount.</p>
        </div>{" "}
        <div className="flex flex-col justify-end gap-3">
          <label htmlFor={onlineId} className="flex min-h-11 items-center gap-3 text-base">
            <input id={onlineId} type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="size-5 accent-primary" />{" "}
            {route === "aos" ? "Filed online where USCIS allows (I-140, I-485, I-131)" : `I-140 filed online (${usd(FEE_SCHEDULE.i140Online)} instead of ${usd(FEE_SCHEDULE.i140Paper)})`}
          </label>{" "}
          <label htmlFor={premiumId} className="flex min-h-11 items-center gap-3 text-base">
            <input id={premiumId} type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} className="size-5 accent-primary" /> Premium processing on the I-140 ({usd(FEE_SCHEDULE.i907I140)})
          </label>
        </div>{" "}
        <Count id={adultsId} label="Applicants 14 and over" value={adults} onChange={setAdults} note="The principal and any spouse or older child immigrating." />{" "}
        <Count id={childrenId} label="Children under 14" value={children} onChange={setChildren} />{" "}
        {route === "aos" ? (
          <>
            <Count id={permitsId} label="Work permits (I-765)" value={permits} onChange={setPermits} note="One per adult who wants one; capped at the adult count." />{" "}
            <Count id={travelId} label="Advance parole (I-131)" value={travel} onChange={setTravel} note="One per adult who wants one; capped at the adult count." />
          </>
        ) : null}
      </div>{" "}

      <div className="mt-6 bg-tint p-4 border-2 border-border" aria-live="polite">
        <p className="text-sm font-bold">{route === "aos" ? "USCIS fees, total" : "USCIS and State fees, total"}{" "}</p>{" "}
        <p className="mt-1 font-heading text-4xl font-bold tabular-nums">{usd(result.total)}</p>{" "}
        {/* THE TOTAL, SPLIT BY FORM, at the share each fee takes. The table
            below lists the same lines; this shows at a glance that the
            adjustment stage is the larger half and which form drives it. */}
        {result.total > 0 ? (
          <>
            <div aria-hidden="true" className="mt-4 flex h-6 border-input border">
              {result.lines.map((l, i) => (
                <span
                  key={`${l.form}-${l.label}`}
                  title={`${l.form}: ${usd(l.total)}`}
                  className={`h-full ${FEE_FILLS[i % FEE_FILLS.length]} ${i > 0 ? "border-l-2 border-border" : ""}`}
                  style={{ width: `${(l.total / result.total) * 100}%` }}
                />
              ))}
            </div>{" "}
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {result.lines.map((l, i) => (
                <li key={`${l.form}-${l.label}`} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`size-3 border border-input ${FEE_FILLS[i % FEE_FILLS.length]}`} />{" "}
                  <span className="font-mono font-bold">{l.form}</span>{" "}
                  <span className="tabular-nums text-soft">{`${usd(l.total)} `}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}{" "}
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 [&>*]:min-w-0">
          <div className="flex items-baseline justify-between gap-3 border-t border-border/40 pt-2">
            <dt>Petition stage (I-140){" "}</dt>{" "}
            <dd className="font-bold tabular-nums">{usd(result.petitionTotal)}</dd>
          </div>{" "}
          <div className="flex items-baseline justify-between gap-3 border-t border-border/40 pt-2">
            <dt>{route === "aos" ? "Adjustment stage (I-485 and what rides it)" : "Visa stage (State's visa fee and USCIS's immigrant fee)"}{" "}</dt>{" "}
            <dd className="font-bold tabular-nums">{usd(result.applicationTotal)}</dd>
          </div>
        </dl>
      </div>{" "}

      <table className="mt-4 w-full border-collapse text-left text-sm">
        <caption className="sr-only">Each fee in the total{" "}</caption>
        <thead>
          <tr className="border-b-2 border-border">
            <th scope="col" className="py-2 pr-3 font-bold">Form{" "}</th>
            <th scope="col" className="py-2 pr-3 font-bold">What it is{" "}</th>
            <th scope="col" className="py-2 text-right font-bold">Total{" "}</th>
          </tr>
        </thead>
        <tbody>
          {result.lines.map((l) => (
            <tr key={`${l.form}-${l.label}`} className="border-b border-border/40 align-top">
              <td className="py-2 pr-3 font-mono text-sm font-bold">{l.form}{" "}</td>
              <td className="py-2 pr-3">
                {l.label}{" "}
                <span className="block text-muted-foreground tabular-nums">
                  {usd(l.each)} × {l.count}
                </span>{" "}
              </td>
              <td className="py-2 text-right font-bold tabular-nums">{usd(l.total)}{" "}</td>
            </tr>
          ))}
        </tbody>
      </table>{" "}
      <p className="mt-3 text-sm text-muted-foreground">
        USCIS&apos;s figures are from its Form G-1055, edition {result.edition}, read at{" "}
        <a href={result.source} className="link" rel="noopener">
          uscis.gov/g-1055
        </a>
        {route === "cp" ? (
          <>
            ; State&apos;s visa fee from{" "}
            <a href={STATE_FEES.source} className="link" rel="noopener">
              {STATE_FEES.citation}
            </a>
          </>
        ) : null}
        . Check the current edition before paying; a fee paid short is a rejected filing.
      </p>{" "}
      <div className="mt-5 border-t-2 border-border pt-4">
        <h2 className="font-heading text-base font-bold">Not in the total</h2>{" "}
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>The PERM and the prevailing wage request: DOL charges no filing fee for either.</li>{" "}
          <li>Recruitment costs and attorney fees, which 20 CFR 656.12 puts on the employer for the PERM stage.</li>{" "}
          {route === "aos" ? (
            <>
              <li>
                The I-693 medical exam: USCIS charges nothing, the civil surgeon does.{" "}
                <a
                  href="https://www.uscis.gov/tools/find-a-civil-surgeon"
                  rel="noopener"
                  className="link"
                >
                  USCIS lists civil surgeons by ZIP code
                </a>
                .
              </li>{" "}
              <li>Premium processing on an I-485, which USCIS does not offer.</li>
            </>
          ) : (
            <>
              <li>The medical exam: a panel physician the consulate names charges for it.</li>{" "}
              <li>
                The affidavit of support review ($120 at NVC), which an employment case needs only when a relative who is a citizen
                or permanent resident filed the I-140 or owns 5% or more of the employer (8 CFR 213a.2(a)(2)(i)(C)).
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
