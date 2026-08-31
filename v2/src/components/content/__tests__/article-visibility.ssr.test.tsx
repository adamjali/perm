/**
 * @vitest-environment node
 *
 * Blog, guide and changelog pages must serve their article VISIBLE.
 *
 * Runs in the `ssr` project: real node, real Motion, no setup file. Under the
 * happy-dom projects Motion takes its client path and `vitest.setup.ts` mocks
 * the library outright, so both would report a clean pass against a component
 * that hides everything. See vitest.config.ts for the full reasoning.
 *
 * WHAT THIS CAUGHT (2026-08-31). `ArticleHeader` and `ArticleBody` used
 * `initial="hidden"` / `initial={{ opacity: 0 }}` with an UNCONDITIONAL
 * `animate`, so Motion serialized the hidden state into the prerendered HTML.
 * Measured in `.next/server/app`: the `<h1>`, the breadcrumb, the article
 * description and the whole `article-content` div shipped with
 * `style="opacity:0"` on 26 content pages. An entrance animation had become a
 * hard dependency on JavaScript for reading the article.
 *
 * The `whileInView` reveals in the same directory are deliberately NOT covered
 * here. Hiding below-the-fold content until it is scrolled to is what that
 * animation is for, and it is not on the critical render path.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ArticleHeader from "../ArticleHeader";
import ArticleBody from "../ArticleBody";
import type { PostMeta } from "@/lib/content/types";

const meta: PostMeta = {
  title: "How long a PERM case takes",
  description: "What DOL's published data says about the queue.",
  date: "2026-08-01",
  author: "PERM Tracker",
  tags: ["perm", "processing times"],
  readingTime: "6 min read",
  published: true,
};

const HIDDEN = /opacity:\s*0(?![.\d])/;

describe("article chrome is visible in the server markup", () => {
  it("renders the headline without hiding it", () => {
    const html = renderToStaticMarkup(
      <ArticleHeader meta={meta} type="blog" />,
    );
    // Control: prove the render produced the thing under test before judging it.
    expect(html).toContain("How long a PERM case takes");
    expect(html).toMatch(/<h1[^>]*>/);
    expect(html).not.toMatch(HIDDEN);
  });

  it("renders the description and breadcrumb without hiding them", () => {
    const html = renderToStaticMarkup(
      <ArticleHeader meta={meta} type="guides" />,
    );
    expect(html).toContain("What DOL&#x27;s published data says about the queue.");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).not.toMatch(HIDDEN);
  });

  it("renders the article body without hiding it", () => {
    const html = renderToStaticMarkup(
      <ArticleBody title="t" url="https://permtracker.app/blog/x">
        <p>The body of the article.</p>
      </ArticleBody>,
    );
    expect(html).toContain("The body of the article.");
    expect(html).toContain("article-content");
    // ArticleBody's SECOND motion div is a whileInView reveal and is allowed
    // to be hidden, so scope this to the content wrapper rather than the
    // whole tree.
    const contentAt = html.indexOf("article-content");
    const openTag = html.lastIndexOf("<", contentAt);
    const tag = html.slice(openTag, html.indexOf(">", contentAt) + 1);
    expect(tag).not.toMatch(HIDDEN);
  });
});
