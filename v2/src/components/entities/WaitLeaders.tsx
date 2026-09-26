import { BarRows } from "@/components/data/BarRows";
import type { FieldWait, RankedEmployerWait } from "@/lib/turso/employerWait";
import { cn } from "@/lib/utils";

/**
 * Which sponsors' cases DOL has been deciding fastest and slowest lately.
 *
 * DOL works one national line in filing order, so most sponsors sit near the
 * all-employers median. The ends of the list are the interesting part: a
 * sponsor far below it had cases decided out of filing order, and one far
 * above it usually had audits or requests for information. We can say which,
 * not why, and the note says so.
 */

const int = (n: number) => n.toLocaleString("en-US");

function Column({
  title,
  rows,
  field,
  max,
}: {
  title: string;
  rows: RankedEmployerWait[];
  field: FieldWait;
  max: number;
}) {
  return (
    <div className="min-w-0 border-2 border-border bg-background p-5">
      <h3 className="font-heading text-lg font-black">{title}</h3>{" "}
      <BarRows
        className="mt-4"
        max={max}
        rows={[
          {
            key: "field",
            label: "Every employer",
            sub: `${int(field.n)} decisions`,
            value: field.p50,
            text: `${int(field.p50 ?? 0)} days`,
            tone: "ink",
          },
          ...rows.map((r) => ({
            key: r.slug,
            label: (
              <a
                href={`/perm-employers/${r.slug}`}
                translate="no"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                {r.name}
              </a>
            ),
            sub: `${int(r.n)} decisions`,
            value: r.p50,
            text: `${int(r.p50)} days`,
          })),
        ]}
      />
    </div>
  );
}

export function WaitLeaders({ field, className }: { field: FieldWait | null; className?: string }) {
  if (!field || field.p50 == null || !field.fastest?.length || !field.slowest?.length) return null;
  const max = Math.max(field.p50, ...field.slowest.map((r) => r.p50));
  return (
    <section aria-labelledby="wait-leaders-h" className={cn("border-2 border-border bg-card p-6 shadow-hard sm:p-8", className)}>
      <h2 id="wait-leaders-h" className="font-heading text-2xl font-black">
        Whose cases DOL is deciding fastest, and slowest
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
        Filing to decision, median, over the last {field.windowDays} days, for the {int(field.employersRanked ?? 0)}{" "}
        sponsors with at least {field.minDecisions ?? 20} decisions in that time. A sponsor well under the
        all-employers figure had cases decided out of filing order; one well over it usually had audits or requests
        for information. DOL doesn&apos;t say why.
      </p>{" "}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Column title="Decided fastest" rows={field.fastest} field={field} max={max} />
        <Column title="Taking longest" rows={field.slowest} field={field} max={max} />
      </div>
    </section>
  );
}
