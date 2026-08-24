/**
 * Shared OG Image Generator
 *
 * Creates dynamic 1200x630 PNG OpenGraph images for content articles.
 * Neobrutalist design matching the PERM Tracker brand.
 */

import { ImageResponse } from "next/og";
import type { PostMeta } from "./types";
import type { ContentType } from "./types";
import { CONTENT_TYPE_CONFIG } from "./types";

export const OG_SIZE = { width: 1200, height: 630 };

const TYPE_COLORS: Record<ContentType, string> = {
  blog: "#0066FF",
  guides: "#059669",
  changelog: "#6B7280",
};

export function generateArticleOG(meta: PostMeta, type: ContentType) {
  const typeLabel = CONTENT_TYPE_CONFIG[type].label.toUpperCase();
  const typeColor = TYPE_COLORS[type];
  const title =
    meta.title.length > 70 ? meta.title.slice(0, 67) + "..." : meta.title;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fafaf9",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(to right, #e7e5e4 1px, transparent 1px),
              linear-gradient(to bottom, #e7e5e4 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            opacity: 0.5,
          }}
        />

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 80px",
            flex: 1,
            position: "relative",
          }}
        >
          {/* Type badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "8px 20px",
                backgroundColor: typeColor,
                border: "3px solid #1c1917",
                fontSize: "16px",
                fontWeight: 700,
                color: "white",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              {typeLabel}
            </div>
            {meta.readingTime && (
              <div
                style={{
                  display: "flex",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#78716c",
                }}
              >
                {meta.readingTime}
              </div>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              display: "flex",
              fontSize: "52px",
              fontWeight: 700,
              color: "#1c1917",
              lineHeight: 1.15,
              letterSpacing: "-1.5px",
              maxWidth: "900px",
            }}
          >
            {title}
          </div>

          {/* Green accent line */}
          <div
            style={{
              display: "flex",
              width: "120px",
              height: "6px",
              backgroundColor: "#84cc16",
              marginTop: "28px",
            }}
          />
        </div>

        {/* Bottom bar with branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 80px",
            height: "80px",
            borderTop: "3px solid #1c1917",
            backgroundColor: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            {/* PT logo square */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                backgroundColor: "#84cc16",
                border: "2px solid #1c1917",
              }}
            >
              <svg
                width="24"
                height="24"
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
            <div
              style={{
                display: "flex",
                fontSize: "24px",
                fontWeight: 700,
                color: "#1c1917",
                letterSpacing: "-0.5px",
              }}
            >
              PERM Tracker
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              fontWeight: 500,
              color: "#78716c",
            }}
          >
            permtracker.app
          </div>
        </div>

        {/* Lime accent bar at very bottom */}
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
    { ...OG_SIZE }
  );
}
