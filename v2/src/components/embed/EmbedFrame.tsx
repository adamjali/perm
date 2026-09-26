import type { Metadata } from "next";

import { embedBySlug, type EmbedDef } from "@/lib/embeds";
import { EmbedRuntime } from "./EmbedRuntime";

/**
 * The shell every `/embed/<slug>` page renders inside: a title bar, the tool,
 * and a small attribution footer linking the full tool.
 *
 * THE TOOL IS THE REAL PAGE COMPONENT. Each embed route renders the tool's own
 * page and this frame hides everything except the section marked
 * `data-embed="<slug>"`: every element on the path down to that section stays,
 * and every sibling along the way (the page header, the explainer prose, the
 * related links, the JSON-LD) is hidden. So an embed shows the same figures as
 * its page on the same day, and a change to the tool reaches the embed with no
 * second copy to keep in step. Hidden sections still render on the server; the
 * pages are ISR, so that is paid once per regeneration, not per view.
 *
 * The rules are CSS only (`:has()`, in every current engine), so the tool's
 * client components hydrate exactly as they do on the page.
 */

const SLUG = /^[a-z0-9-]+$/;

/** The hide-everything-but-the-marked-section rule for one slug. */
export function embedCss(slug: string): string {
  if (!SLUG.test(slug)) throw new Error(`embed slug must be kebab-case: ${slug}`);
  const m = `[data-embed~="${slug}"]`;
  const onPath = `.embed-root:has(${m}), .embed-root :has(${m})`;
  return [
    // A sibling of anything on the path to the marked section: gone.
    `.embed-root:has(${m}) > :not(:has(${m})):not(${m}), .embed-root :has(${m}) > :not(:has(${m})):not(${m}) { display: none !important; }`,
    // The wrappers on that path keep their width and horizontal padding but
    // lose the page's vertical rhythm, which was spacing for content now hidden.
    `:is(${onPath}):not(.embed-root) { margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; min-height: 0 !important; }`,
    `.embed-root ${m} { margin-top: 0 !important; }`,
    // The site's film grain is page decoration, not part of a tool.
    `.grain-overlay { display: none !important; }`,
  ].join("\n");
}

/** Metadata every embed page shares: its own title, never indexed, canonical on the full tool. */
export function embedMetadata(slug: string): Metadata {
  const def = mustEmbed(slug);
  return {
    title: def.title,
    description: def.blurb,
    robots: { index: false, follow: true },
    alternates: { canonical: def.href },
  };
}

function mustEmbed(slug: string): EmbedDef {
  const def = embedBySlug(slug);
  if (!def) throw new Error(`unknown embed: ${slug}`);
  return def;
}

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function EmbedFrame({ slug, children }: { slug: string; children: React.ReactNode }) {
  const def = mustEmbed(slug);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <style dangerouslySetInnerHTML={{ __html: embedCss(slug) }} />
      <EmbedRuntime slug={slug} />
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b-2 border-border bg-card px-4 py-2">
        <h1 className="font-heading text-lg font-black leading-tight">{def.title}</h1>{" "}
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold hover:text-primary">
          PERM Tracker
        </a>
      </header>
      <div className="embed-root flex-1 py-4">{children}</div>
      <footer className="border-t-2 border-border px-4 py-2 text-sm text-foreground/80">
        <a href={def.href} target="_blank" rel="noopener noreferrer" className={link}>
          Open the full tool on PERM Tracker
        </a>
      </footer>
    </div>
  );
}
