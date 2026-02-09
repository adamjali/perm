import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export const alt = "PERM Tracker - Case Management for Immigration Attorneys";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const imageData = await readFile(
    join(process.cwd(), "public", "og-image-base.png")
  );
  const base64 = imageData.toString("base64");
  const dataUrl = `data:image/png;base64,${base64}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#f5f5f0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Illustration - left/center */}
        <img
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

        {/* Right overlay with branding */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "460px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "40px 20px 40px 118px",
            background:
              "linear-gradient(to right, rgba(245,245,240,0) 0%, rgba(245,245,240,0.8) 10%, rgba(245,245,240,0.95) 30%, rgba(245,245,240,1) 50%)",
          }}
        >
          {/* Logo icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
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
              fontSize: "44px",
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
              width: "80px",
              height: "6px",
              backgroundColor: "#84cc16",
              marginBottom: "16px",
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: "18px",
              fontWeight: 500,
              color: "#57534e",
              lineHeight: 1.4,
              marginBottom: "24px",
            }}
          >
            Free Case Tracking for Immigration Attorneys
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {["Deadlines", "Validation", "Alerts"].map((feature) => (
              <div
                key={feature}
                style={{
                  display: "flex",
                  padding: "6px 14px",
                  backgroundColor: "#ecfccb",
                  border: "2px solid #1c1917",
                  fontSize: "13px",
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
}
