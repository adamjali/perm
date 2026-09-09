"use client";

import { useId, useMemo, useState } from "react";

import { Label } from "@/components/ui";
import { calculateGreenCardFees, FEE_SCHEDULE, type FeeInput } from "@/lib/perm";

/**
 * USCIS fees for one employment-based case, from Form G-1055.
 *
 * Every number comes from one edition of the fee schedule and the edition
 * is printed under the total. The form asks only what changes a fee: who the
 * petitioner is (the asylum program fee tier), the filing channel, premium
 * processing, and how many people adjust. What the table leaves out is named
 * under it, because a total that reads as the whole cost is worse than none.
 */

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const NUMBER = "mt-1.5 min-h-11 w-full min-w-0 border-2 border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Count({ id, label, value, onChange, note }: { id: string; label: string; value: number; onChange: (n: number) => void; note?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>{" "}
      <input id={id} type="number" inputMode="numeric" min={0} max={20} value={value} onChange={(e) => onChange(Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0))))} className={NUMBER} />{" "}
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
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
  const [petitioner, setPetitioner] = useState<FeeInput["petitioner"]>("regular");
  const [online, setOnline] = useState(false);
  const [premium, setPremium] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [permits, setPermits] = useState(1);
  const [travel, setTravel] = useState(1);

  const result = useMemo(
    () => calculateGreenCardFees({ petitioner, onlineI140: online, premium, adults, children, workPermits: permits, travelDocuments: travel }),
    [petitioner, online, premium, adults, children, permits, travel],
  );

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={petitionerId}>Petitioner</Label>{" "}
          <select id={petitionerId} value={petitioner} onChange={(e) => setPetitioner(e.target.value as FeeInput["petitioner"])} className={NUMBER}>
            <option value="regular">Employer, 26 or more full-time employees</option>
            <option value="small">Small employer (25 or fewer) or self-petitioner</option>
            <option value="nonprofit">Nonprofit</option>
          </select>{" "}
          <p className="mt-1 text-xs text-muted-foreground">Sets the asylum program fee that USCIS charges with every I-140.</p>
        </div>{" "}
        <div className="flex flex-col justify-end gap-3">
          <label htmlFor={onlineId} className="flex min-h-11 items-center gap-3 text-base">
            <input id={onlineId} type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="size-5 accent-primary" /> I-140 filed online ({usd(FEE_SCHEDULE.i140Online)} instead of {usd(FEE_SCHEDULE.i140Paper)})
          </label>{" "}
          <label htmlFor={premiumId} className="flex min-h-11 items-center gap-3 text-base">
            <input id={premiumId} type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} className="size-5 accent-primary" /> Premium processing on the I-140 ({usd(FEE_SCHEDULE.i907I140)})
          </label>
        </div>{" "}
        <Count id={adultsId} label="Applicants 14 and over" value={adults} onChange={setAdults} note="The principal and any spouse or older child adjusting status." />{" "}
        <Count id={childrenId} label="Children under 14 filing with a parent" value={children} onChange={setChildren} />{" "}
        <Count id={permitsId} label="Work permits (I-765)" value={permits} onChange={setPermits} note="One per adult who wants one; capped at the adult count." />{" "}
        <Count id={travelId} label="Advance parole (I-131)" value={travel} onChange={setTravel} note="One per adult who wants one; capped at the adult count." />
      </div>{" "}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-border">
              <th scope="col" className="py-2 pr-3 font-bold">Form{" "}</th>
              <th scope="col" className="py-2 pr-3 font-bold">What it is{" "}</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Each{" "}</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Count{" "}</th>
              <th scope="col" className="py-2 text-right font-bold">Total{" "}</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l) => (
              <tr key={`${l.form}-${l.label}`} className="border-b border-border/40">
                <td className="py-2 pr-3 font-mono text-xs font-bold">{l.form}{" "}</td>
                <td className="py-2 pr-3">{l.label}{" "}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{usd(l.each)}{" "}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{l.count}{" "}</td>
                <td className="py-2 text-right font-bold tabular-nums">{usd(l.total)}{" "}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={4} className="py-2 pr-3">Petition stage (I-140){" "}</td>
              <td className="py-2 text-right tabular-nums">{usd(result.petitionTotal)}{" "}</td>
            </tr>
            <tr>
              <td colSpan={4} className="py-2 pr-3">Adjustment stage (I-485 and what rides it){" "}</td>
              <td className="py-2 text-right tabular-nums">{usd(result.adjustmentTotal)}{" "}</td>
            </tr>
            <tr className="border-t-2 border-border">
              <td colSpan={4} className="py-3 pr-3 font-heading text-lg font-black">USCIS fees, total{" "}</td>
              <td className="py-3 text-right font-heading text-xl font-black tabular-nums">{usd(result.total)}{" "}</td>
            </tr>
          </tfoot>
        </table>
      </div>{" "}
      <p className="mt-3 text-xs text-muted-foreground">
        Every figure is from USCIS Form G-1055, edition {result.edition}, read at{" "}
        <a href={result.source} className="underline underline-offset-2 hover:text-primary" rel="noopener">
          uscis.gov/g-1055
        </a>
        . Check the current edition before paying; a fee paid short is a rejected filing.
      </p>{" "}
      <div className="mt-5 border-t-2 border-border pt-4">
        <h3 className="font-heading text-base font-black">Not in the total</h3>{" "}
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/70">
          <li>The PERM and the prevailing wage request: DOL charges no filing fee for either.</li>{" "}
          <li>Recruitment costs and attorney fees, which 20 CFR 656.12 puts on the employer for the PERM stage.</li>{" "}
          <li>The I-693 medical exam: USCIS charges nothing, the civil surgeon does.</li>{" "}
          <li>Consular processing (DS-260 and the immigrant visa fee) for anyone adjusting abroad instead of filing an I-485.</li>{" "}
          <li>Premium processing on an I-485, which USCIS does not offer.</li>
        </ul>
      </div>
    </div>
  );
}
