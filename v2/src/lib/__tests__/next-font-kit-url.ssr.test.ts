/**
 * Google Fonts sometimes answers the build with an extensionless font address
 * (`fonts.gstatic.com/l/font?kit=...`). Next 16.4's loader read the file type
 * off the address and threw "Cannot read properties of null (reading '1')",
 * which failed four deploys between Oct 5 and Oct 24 2026. A local patch fell
 * back to woff2 until Next 16.4.3 shipped the same fix (Oct 23 2026), and the
 * patch went with that upgrade. This drives the real loader with Next's own
 * mock hook in both address forms, so any later Next is checked against it.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

const KIT_URL = "https://fonts.gstatic.com/l/font?kit=abc123&skey=x&v=v20";
const FILE_URL = "https://fonts.gstatic.com/s/inter/v20/UcCO3Fwr.woff2";

type Loader = (args: {
  functionName: string;
  data: unknown[];
  emitFontFile: (buf: Buffer, ext: string) => string;
  isDev: boolean;
  isServer: boolean;
}) => Promise<{ css: string }>;

let previous: string | undefined;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "next-font-"));
  const mock = join(dir, "mock.cjs");
  // Every URL the loader asks for gets one @font-face whose source is FONT_URL.
  writeFileSync(
    mock,
    `module.exports = new Proxy({}, { get: () => "/* latin */\\n@font-face {\\n  font-family: 'Inter';\\n  font-style: normal;\\n  font-weight: 400;\\n  font-display: swap;\\n  src: url(" + process.env.FONT_URL + ") format('woff2');\\n  unicode-range: U+0000-00FF;\\n}\\n" });\n`,
  );
  previous = process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
  process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = mock;
});

afterAll(() => {
  if (previous === undefined) delete process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
  else process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = previous;
  delete process.env.FONT_URL;
});

async function build(url: string): Promise<{ exts: string[]; css: string }> {
  process.env.FONT_URL = url;
  const loader = (require("next/dist/compiled/@next/font/dist/google/loader.js") as { default: Loader }).default;
  const exts: string[] = [];
  const out = await loader({
    // A family name per address: the loader caches each CSS answer by URL.
    functionName: "Inter",
    data: [{ subsets: ["latin"], weight: [url === KIT_URL ? "400" : "500"], variable: "--font-body" }],
    emitFontFile: (_buf, ext) => {
      exts.push(ext);
      return `/_next/static/media/x.${ext}`;
    },
    isDev: false,
    isServer: true,
  });
  return { exts, css: out.css };
}

describe("next/font with Google's extensionless font address", () => {
  it("builds the /l/font?kit= form as woff2", async () => {
    const { exts, css } = await build(KIT_URL);
    expect(exts).toEqual(["woff2"]);
    expect(css).toContain("/_next/static/media/x.woff2");
  });

  it("still builds the ordinary .woff2 address", async () => {
    const { exts } = await build(FILE_URL);
    expect(exts).toEqual(["woff2"]);
  });
});
