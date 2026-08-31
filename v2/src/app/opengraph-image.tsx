import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { SOCIAL_CARD_SIZE, SOCIAL_CARD_CONTENT_TYPE } from "@/lib/socialCard";

export const runtime = "nodejs";
export const revalidate = false;

export const alt = "PERM Tracker - Live PERM Data and Deadline Tracking";

// Re-exported from src/lib/socialCard.ts so the <meta> tags in openGraphBase.ts
// describe this route rather than a stale copy of it.
export const size = SOCIAL_CARD_SIZE;

// JPEG, not PNG. next/og renders via Satori -> resvg, which can ONLY emit PNG
// (vercel/next.js#60366). PNG is lossless, so this card's photographic
// background encoded to 762 KB, over WhatsApp's ~600 KB ceiling, and WhatsApp
// drops an oversized image silently with no fallback and no error. Re-encoding
// the same pixels to JPEG q95 lands at ~204 KB, a 73% cut the eye cannot see
// (mean per-channel difference from the old PNG: 1.14/255).
// The JSX below stays the single source of truth; only the container changes.
export const contentType = SOCIAL_CARD_CONTENT_TYPE;

// Card background. JPEG has no alpha channel, so the ImageResponse's
// transparent pixels must be flattened against this or they render black.
const BACKGROUND = "#f5f5f0";

// 4:4:4 keeps full chroma resolution. The default 4:2:0 halves it, which fringes
// the hard black borders and lime accents this card is built from.
const JPEG_OPTIONS = {
  quality: 95,
  mozjpeg: true,
  chromaSubsampling: "4:4:4",
} as const;

export default async function Image() {
  const imageData = await readFile(
    join(process.cwd(), "public", "og-image-base.png")
  );
  const base64 = imageData.toString("base64");
  const dataUrl = `data:image/png;base64,${base64}`;

  const png = new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: BACKGROUND,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Illustration - left/center */}
        <img
          alt=""
          src={dataUrl}
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* THE MESSAGE HALF, and it is 58% on purpose.
            A social card is a BILLBOARD, not a page header - it is read at
            300-500px wide in a timeline or a text preview, where decoration
            reads as texture and only large type survives. At 460px (38%) with
            a 44px title, the tagline was already marginal at 500px and gone at
            300px, while two thirds of the canvas carried an illustration whose
            own labels are illegible at any share size. Rendered at 500, 300 and
            200px and looked at, which is the only check that means anything
            here. */}
        {/* Right overlay with branding */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "780px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "44px 48px 44px 150px",
            // OPAQUE BY 14%, NOT 50%. Adam: "needs fully white behind text
            // and the gradient move to the left". The ramp used to reach solid
            // only halfway across the panel, so with the panel widened the text
            // now started at 96px inside a zone that was still translucent -
            // dark illustration lines showing through the letterforms, which is
            // exactly the contrast failure a scrim exists to prevent. The
            // feather is now a short lead-in and everything past it is flat, so
            // no glyph ever lands on artwork.
            background:
              "linear-gradient(to right, rgba(245,245,240,0) 0%, rgba(245,245,240,0.75) 6%, rgba(245,245,240,1) 14%, rgba(245,245,240,1) 100%)",
          }}
        >
          {/* Logo icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "68px",
              height: "68px",
              backgroundColor: "#84cc16",
              border: "3px solid #1c1917",
              marginBottom: "20px",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1c1917"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              display: "flex",
              fontSize: "64px",
              fontWeight: 800,
              color: "#1c1917",
              letterSpacing: "-1.5px",
              lineHeight: 1,
              marginBottom: "16px",
              whiteSpace: "nowrap",
            }}
          >
            PERM Tracker
          </div>

          {/* Accent line */}
          <div
            style={{
              display: "flex",
              width: "120px",
              height: "6px",
              backgroundColor: "#84cc16",
              marginBottom: "16px",
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: "27px",
              fontWeight: 500,
              color: "#57534e",
              lineHeight: 1.4,
              marginBottom: "24px",
            }}
          >
            Live PERM Data and Deadline Tracking
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {/* Applicant first. "Validation" was software-speak for the
                attorney build and says nothing to somebody waiting on a
                case; "Case status" is the free thing this site is best
                known for and the phrase people search. */}
              {["Case status", "Deadlines", "Alerts"].map((feature) => (
              <div
                key={feature}
                style={{
                  display: "flex",
                  padding: "6px 14px",
                  backgroundColor: "#ecfccb",
                  border: "2px solid #1c1917",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#1c1917",
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "8px",
            backgroundColor: "#84cc16",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
    .flatten({ background: BACKGROUND })
    .jpeg(JPEG_OPTIONS)
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": contentType,
      // Deliberately the same header next/og set before this route returned its
      // own Response, so the switch to JPEG changes the format and nothing else.
      //
      // NOT `immutable`. This URL carries no content hash. It is plain
      // /opengraph-image on every deploy, so an immutable year-long entry would
      // pin whatever bytes a cache happened to fetch first and keep serving them
      // long after a redesign. That is the exact failure this commit is undoing:
      // a stale social card nobody can see is stale.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
