/**
 * The social card for an entity page (an employer, a law firm, an occupation).
 *
 * Generated per entity on first request and cached for the page's own window,
 * because a shared employer link is the one place a live figure on a card is
 * right: the card regenerates with the page. It carries the name, the kind and
 * the filing count from DOL's disclosure files, and NOTHING derived: no
 * approval rate and no rank, because the page itself withholds those below its
 * population floors and a card cannot carry the footnote.
 */
import { ImageResponse } from "next/og";
import type { EntityKind, EntityRow } from "@/lib/entityPayload";

export const ENTITY_OG_SIZE = { width: 1200, height: 630 };

const KIND_EYEBROW: Record<EntityKind, string> = {
  employer: "Employer",
  attorney: "Law firm",
  occupation: "Occupation",
};

const GROUND: Record<EntityKind, { bg: string; ink: string; accent: string }> = {
  employer: { bg: "#FAFAFA", ink: "#000000", accent: "#2ECC40" },
  attorney: { bg: "#000000", ink: "#FAFAFA", accent: "#2ECC40" },
  occupation: { bg: "#2ECC40", ink: "#000000", accent: "#000000" },
};

export function generateEntityOG(kind: EntityKind, row: EntityRow) {
  const c = GROUND[kind];
  const name = row.name.length > 60 ? `${row.name.slice(0, 57)}...` : row.name;
  const size = name.length <= 22 ? 84 : name.length <= 36 ? 64 : 48;
  const filings = row.total.toLocaleString("en-US");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 72px",
          backgroundColor: c.bg,
          color: c.ink,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* One text child per box: Satori refuses a div with several children unless it is display:flex. */}
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.72 }}>
          {`${KIND_EYEBROW[kind]} · PERM filings`}
        </div>
        <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.03em", marginTop: 22, maxWidth: 1040 }}>
          {name}
        </div>
        <div style={{ height: 14, width: 300, backgroundColor: c.accent, border: `3px solid ${c.ink}`, marginTop: 26 }} />
        <div style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.25, marginTop: 26, maxWidth: 1000 }}>
          {`${filings} PERM ${row.total === 1 ? "filing" : "filings"} in the Department of Labor's disclosure files, with the outcome, wage and worksite of each.`}
        </div>
        <div style={{ position: "absolute", left: 72, bottom: 40, fontSize: 22, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.8 }}>
          permtracker.app
        </div>
      </div>
    ),
    { ...ENTITY_OG_SIZE },
  );
}
