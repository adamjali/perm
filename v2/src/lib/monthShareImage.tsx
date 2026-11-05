/**
 * The picture of one filing month (lib/monthShare.ts), 1200 by 630.
 *
 * Paper and ink, the status chips' own soft fills, and one object with the
 * house edge: the bar, an ink outline with a hard offset shadow. Everything it
 * says is in the model; this only lays it out, so the alt text and the picture
 * can't drift. It's a PNG of flat colour, a few tens of kilobytes.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { formatInt } from "@/lib/format";
import type { MonthPartKey, MonthShare } from "@/lib/monthShare";

export const MONTH_SHARE_SIZE = { width: 1200, height: 630 };

const INK = "#141414";
const PAPER = "#FAFAFA";
const SOFT_INK = "#5E5E5E";

/** The month page's fills (PART_FILL there), as the light theme paints them. */
const FILL: Record<MonthPartKey, string> = {
  certified: "#2ECC40",
  denied: "#EE9A90",
  withdrawn: "#C3AEEB",
  inLine: "#F5D76E",
  outside: "#9EC3F0",
};

type ShareFont = { name: string; data: ArrayBuffer; weight: 500 | 700; style: "normal" };

/**
 * The site's own faces, as ASCII-only TTF files in public/fonts (Satori reads
 * TTF, not the woff2 next/font serves; OFL licences beside them). Read once a
 * process. A missing file draws in the renderer's plain face rather than
 * failing the picture, and says so in the log.
 */
let fonts: Promise<ShareFont[]> | null = null;
export function loadShareFonts(): Promise<ShareFont[]> {
  fonts ??= Promise.all(
    (
      [
        ["Space Grotesk", "space-grotesk-700.ttf", 700],
        ["Inter", "inter-500.ttf", 500],
        ["Inter", "inter-700.ttf", 700],
      ] as const
    ).map(async ([name, file, weight]): Promise<ShareFont> => {
      const buf = await readFile(join(process.cwd(), "public", "fonts", file));
      return { name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" };
    }),
  ).catch((e: unknown) => {
    console.warn("[month-share] the fonts are unreadable; drawing in the plain face", e);
    return [];
  });
  return fonts;
}

const HEADING = "'Space Grotesk', Inter, sans-serif";

/** "41%" stands tall; "under 0.1%" has to fit beside its tally. */
function shareSize(share: string): number {
  return share.length <= 4 ? 168 : share.length <= 6 ? 132 : 92;
}

export function renderMonthShare(m: MonthShare, faces: ShareFont[]) {
  const total = m.parts.reduce((n, p) => n + p.count, 0);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px 44px",
          backgroundColor: PAPER,
          color: INK,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Satori takes one text child per box, or display:flex. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: HEADING, fontSize: 40, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{m.title}</div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 14 }}>
            <div style={{ fontFamily: HEADING, fontSize: shareSize(m.share), fontWeight: 700, lineHeight: 0.9, letterSpacing: "-0.04em" }}>{m.share}</div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 28, marginBottom: 10 }}>
              <div style={{ fontFamily: HEADING, fontSize: 44, fontWeight: 700, lineHeight: 1 }}>decided</div>
              <div style={{ fontSize: 26, fontWeight: 500, marginTop: 10, color: SOFT_INK }}>{m.tally}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              height: 60,
              width: "100%",
              border: `3px solid ${INK}`,
              boxShadow: `6px 6px 0 ${INK}`,
              backgroundColor: PAPER,
            }}
          >
            {m.parts.map((p, i) => (
              <div
                key={p.key}
                style={{
                  display: "flex",
                  flexGrow: p.count / total,
                  flexBasis: 0,
                  // A part of a few cases still shows as a sliver; the legend gives its count.
                  minWidth: 4,
                  height: "100%",
                  backgroundColor: FILL[p.key],
                  borderRight: i < m.parts.length - 1 ? `2px solid ${INK}` : "none",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 22 }}>
            {m.parts.map((p) => (
              <div key={p.key} style={{ display: "flex", alignItems: "center", marginRight: 30, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, backgroundColor: FILL[p.key], border: `2px solid ${INK}`, marginRight: 10 }} />
                <div style={{ fontSize: 23, fontWeight: 500 }}>{`${formatInt(p.count)} ${p.text}`}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {m.note ? <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}>{m.note}</div> : null}
          {m.line ? <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3, marginTop: m.note ? 4 : 0 }}>{m.line}</div> : null}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18 }}>
            <div style={{ fontSize: 21, fontWeight: 500, color: SOFT_INK }}>{m.stamp}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{m.address}</div>
          </div>
        </div>
      </div>
    ),
    { ...MONTH_SHARE_SIZE, fonts: faces },
  );
}
