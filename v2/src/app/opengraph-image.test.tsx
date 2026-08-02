/**
 * Regression gate for the site-wide social card.
 *
 * Why this exists: the card shipped for months as a 762 KB PNG. Nothing was
 * broken in any way a person or a checker would notice. The image rendered
 * perfectly, every tag was present, the page scored fine. It was only broken on
 * WhatsApp, which drops an oversized og:image silently: no error, no fallback,
 * just a preview with no picture. A defect with no symptom needs a mechanical
 * check or it comes straight back the next time someone touches this route.
 *
 * The size assertion is the point. The rest guards the ways a "passing" size
 * could be meaningless: an empty buffer is very small, and a PNG mislabelled as
 * JPEG would still be under the limit.
 */
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import Image, { contentType, size, alt } from "./opengraph-image";
import { SOCIAL_CARD_MAX_BYTES } from "@/lib/socialCard";
import { socialCardImage } from "@/lib/openGraphBase";

// Satori + resvg + a JPEG re-encode of a 1200x630 photographic card. Slower than
// a component render, and it reads a ~1 MB file off disk to do it.
const RENDER_TIMEOUT_MS = 60_000;

describe("opengraph-image", () => {
  it(
    "renders a card small enough for WhatsApp to actually show",
    async () => {
      const response = await Image();
      const bytes = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(contentType);

      // The assertion this file exists for.
      expect(bytes.byteLength).toBeLessThan(SOCIAL_CARD_MAX_BYTES);

      // ...and proof the bytes are a real image, so the line above cannot pass
      // by producing nothing. Decoded from the buffer, not trusted from a header.
      const meta = await sharp(bytes).metadata();
      expect(meta.format).toBe("jpeg");
      expect(meta.width).toBe(size.width);
      expect(meta.height).toBe(size.height);

      // JPEG carries no alpha. If the ImageResponse's transparent pixels were
      // ever left unflattened they would decode to black across the card.
      expect(meta.hasAlpha).toBe(false);
    },
    RENDER_TIMEOUT_MS
  );

  it("describes itself to scrapers exactly as it is served", () => {
    // og:image:type promising one format while the route serves another is not
    // visible anywhere at runtime: the image still loads. Only a check catches it.
    expect(socialCardImage.type).toBe(contentType);
    expect(socialCardImage.width).toBe(size.width);
    expect(socialCardImage.height).toBe(size.height);

    // Both alts are announced to screen readers for a shared link, so neither
    // may be empty, but they are written for different surfaces and may differ.
    expect(alt.length).toBeGreaterThan(0);
    expect(socialCardImage.alt.length).toBeGreaterThan(0);
  });
});
