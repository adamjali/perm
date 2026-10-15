import { Fragment } from "react";

/**
 * What a DOL case number is, drawn: one real-shaped number with its three
 * parts named, and the prefixes the lookup takes as chips. On the homepage
 * under the lookup box, and in the embedded lookup before anything is typed.
 */

/** The prefixes the lookup takes, as chips under the field. */
const PREFIX_CHIPS = [
  { prefix: "G", what: "PERM" },
  { prefix: "P", what: "Wage request" },
  { prefix: "I", what: "LCA" },
  { prefix: "H", what: "H-2A, H-2B" },
  { prefix: null, what: "Employer name" },
] as const;

/** What a case number is, drawn: one real-shaped number with its three parts named. */
export function CaseNumberAnatomy({ id, employerName = true }: { id: string; employerName?: boolean }) {
  const parts = [
    { seg: "G-100", what: "PERM" },
    { seg: "26240", what: "Day filed" },
    { seg: "200246", what: "Serial" },
  ];
  return (
    <div id={id} className="mt-4">
      <p className="sr-only">
        A case number has three parts: the program and office (G-100 is PERM),
        the day it was filed (26240 is the 240th day of 2026), and DOL&apos;s
        serial. PERM (G-), wage request (P-), LCA (I-), H-2A and H-2B (H-, JO-A-)
        and CW-1 (C-) numbers all work{employerName ? ", and so does an employer's name" : ""}.
      </p>{" "}
      {/* A grid, so each label sits under its own part. */}
      <div aria-hidden="true" className="grid w-max grid-cols-[auto_auto_auto_auto_auto] items-center gap-x-1.5 font-mono [&>*]:min-w-0">
        {parts.map((p, i) => (
          <Fragment key={p.seg}>
            {i > 0 ? <span className="text-lg font-bold text-muted-foreground">-</span> : null}{" "}
            {/* Dashed, so the example reads as an example: drawn as solid boxes,
                visitors clicked the parts as if they were buttons. */}
            <span className="border-2 border-dashed border-foreground/40 px-2 py-1 text-base font-bold">{p.seg}</span>{" "}
          </Fragment>
        ))}
        {parts.map((p, i) => (
          <Fragment key={`${p.seg}-label`}>
            {i > 0 ? <span /> : null}{" "}
            <span className="mt-1 whitespace-nowrap text-sm text-muted-foreground">{p.what}</span>{" "}
          </Fragment>
        ))}
      </div>{" "}
      <div aria-hidden="true" className="mt-3 flex flex-wrap gap-2">
        {PREFIX_CHIPS.filter((c) => employerName || c.prefix !== null).map((c) => (
          <Fragment key={c.what}>
            <span className="inline-flex items-center gap-1.5 border-2 border-border/60 px-2 py-0.5 text-sm">
              {c.prefix ? <b className="font-mono font-bold">{c.prefix}</b> : null}{" "}
              {c.what}
            </span>{" "}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
