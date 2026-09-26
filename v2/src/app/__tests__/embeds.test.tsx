import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmbedGallery } from "@/components/badges/EmbedGallery";
import { EmbedFrame, embedCss, embedMetadata } from "@/components/embed/EmbedFrame";
import { EMBEDS, embedSiteFor, embedSnippet, siteKeyOf } from "@/lib/embeds";
import RfiDeadlinePage from "../(site)/(public)/tools/rfi-deadline/page";

/**
 * The embed registry, its routes, and the page sections they frame, held
 * together. An embed shows its tool's own marked section, so three things
 * must agree for every slug: the registry entry, a route under /embed, and a
 * `data-embed` marker on the page the route imports. A marker renamed on the
 * page would otherwise leave an embed that renders an empty frame.
 */

const APP = join(__dirname, "..");
const EMBED_DIR = join(APP, "embed");
const PUBLIC = join(APP, "(site)", "(public)");

function routeSource(slug: string): string {
  return readFileSync(join(EMBED_DIR, slug, "page.tsx"), "utf8");
}

describe("the embed registry", () => {
  it("has a route for every entry and an entry for every route", () => {
    const dirs = readdirSync(EMBED_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs.length).toBeGreaterThanOrEqual(19);
    expect(dirs).toEqual(EMBEDS.map((e) => e.slug).sort());
  });

  it.each(EMBEDS.filter((e) => e.slug !== "case-status").map((e) => [e.slug, e] as const))(
    "%s frames the page its registry entry links, and that page carries its marker",
    (slug, def) => {
      const src = routeSource(slug);
      const m = /import ToolPage from "@\/app\/\(site\)\/\(public\)(\/[^"]+)\/page";/.exec(src);
      expect(m, `${slug} imports a public page`).not.toBeNull();
      expect(m![1]).toBe(def.href === "/visa-bulletin" ? "/tools/priority-date-calculator" : def.href);
      const page = readFileSync(join(PUBLIC, ...m![1]!.split("/").filter(Boolean), "page.tsx"), "utf8");
      const markers = [...page.matchAll(/data-embed="([^"]+)"/g)].flatMap((x) => x[1]!.split(" "));
      expect(markers).toContain(slug);
      expect(src).toContain(`embedMetadata("${slug}")`);
      expect(src).toContain(`<EmbedFrame slug="${slug}">`);
    },
  );

  it("links every entry to a page that exists", () => {
    for (const e of EMBEDS) {
      expect(existsSync(join(PUBLIC, ...e.href.split("/").filter(Boolean), "page.tsx")), e.href).toBe(true);
    }
  });

  it("builds a lazy, titled, borderless iframe snippet", () => {
    const s = embedSnippet(EMBEDS[0]!);
    expect(s).toBe(
      `<iframe src="https://permtracker.app/embed/case-status" title="Check a DOL case" width="100%" height="560" style="border:0;max-width:100%" loading="lazy"></iframe>`,
    );
  });
});

describe("the site key", () => {
  it.each([
    ["https://www.Example.com/some/page?x=1", "example.com"],
    ["https://blog.example.co.uk/", "blog.example.co.uk"],
    ["example.org", "example.org"],
    ["localhost", "unknown"],
    ['x"; DROP', "unknown"],
    ["", "unknown"],
    [null, "unknown"],
    [`https://${"a".repeat(120)}.com/`, "unknown"],
    ["a..b.com", "unknown"],
    ["example.com.", "unknown"],
  ])("siteKeyOf(%j) is %s", (raw, key) => {
    expect(siteKeyOf(raw)).toBe(key);
  });

  it("takes the embedding page from the Referer, and the carried field only from our own pages", () => {
    expect(embedSiteFor("https://lawfirm.example/perm/", "spoof.example")).toBe("lawfirm.example");
    expect(embedSiteFor("https://permtracker.app/embed/case-status?case=x", "lawfirm.example")).toBe("lawfirm.example");
    expect(embedSiteFor(null, "lawfirm.example")).toBe("lawfirm.example");
    expect(embedSiteFor(null, null)).toBe("unknown");
  });
});

describe("EmbedFrame", () => {
  it("refuses a slug that could break out of its style rule", () => {
    expect(() => embedCss('x"] { } body { display:none } [x="')).toThrow();
  });

  it("never lets an embed be indexed, and points it at the full tool", () => {
    const m = embedMetadata("rfi-deadline");
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates?.canonical).toBe("/tools/rfi-deadline");
  });

  it("renders the real tool with its marker, the hiding rule and the attribution link", () => {
    const html = renderToStaticMarkup(
      <EmbedFrame slug="rfi-deadline">
        <RfiDeadlinePage />
      </EmbedFrame>,
    );
    expect(html).toContain('data-embed="rfi-deadline"');
    expect(html).toContain(':has([data-embed~="rfi-deadline"])');
    expect(html).toMatch(/href="\/tools\/rfi-deadline"[^>]*>Open the full tool on PERM Tracker/);
  });
});

describe("the gallery on /badges", () => {
  it("offers every embed with its exact snippet and a preview, and one live frame", () => {
    const html = renderToStaticMarkup(<EmbedGallery origin="https://permtracker.app" />);
    for (const e of EMBEDS) {
      // React escapes the snippet's quotes and angle brackets inside <code>.
      const shown = embedSnippet(e).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      expect(html, e.slug).toContain(shown);
    }
    expect(html.match(/<iframe /g)).toHaveLength(1);
    expect(html).toContain('src="/embed/case-status"');
    expect(html.match(/Preview the frame/g)).toHaveLength(EMBEDS.length - 1);
  });
});
