import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SITES, cleanName, employerFromJsonLd, extractEmployer, siteFor } from "../src/extract";

// One fixture per job site, written from each site's public markup. The
// selectors WILL break when a site redesigns; when one does, its fixture
// here is the thing to update first, then the selector.

function page(file: string): Document {
  const html = readFileSync(join(__dirname, "fixtures", file), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

describe("employer on each job site", () => {
  it.each([
    ["linkedin-guest.html", "https://www.linkedin.com/jobs/view/4012345678", "Google", "linkedin"],
    ["linkedin-signed-in.html", "https://www.linkedin.com/jobs/search/?currentJobId=4012345678", "Stripe", "linkedin"],
    ["indeed.html", "https://www.indeed.com/viewjob?jk=abc123", "Mayo Clinic", "indeed"],
    ["glassdoor.html", "https://www.glassdoor.com/job-listing/senior-consultant-deloitte-JV_IC1128808.htm", "Deloitte", "glassdoor"],
    ["handshake.html", "https://app.joinhandshake.com/stu/jobs/98765", "Bank of America", "handshake"],
    ["wellfound.html", "https://wellfound.com/jobs/3012345-backend-engineer", "Notion Labs & Co", "json-ld"],
  ])("%s", (file, url, name, source) => {
    expect(extractEmployer(page(file), new URL(url))).toEqual({ name, source });
  });

  it("reads JSON-LD first, even on a listed site", () => {
    // Wellfound has a selector too; the structured data wins because it's the
    // site's own statement of who's hiring.
    expect(extractEmployer(page("wellfound.html"), new URL("https://wellfound.com/jobs/1"))?.source).toBe("json-ld");
  });
});

describe("any page with a JobPosting, on a click", () => {
  it("reads hiringOrganization from @graph, given as a plain string, past a broken block", () => {
    expect(employerFromJsonLd(page("greenhouse-jsonld.html"))).toBe("Datadog, Inc.");
  });

  it("finds nothing on a page with no JobPosting", () => {
    expect(employerFromJsonLd(page("no-posting.html"))).toBeNull();
    expect(extractEmployer(page("no-posting.html"), new URL("https://example.com/post"))).toBeNull();
  });

  it("on an unlisted site uses the structured data and nothing else", () => {
    expect(extractEmployer(page("greenhouse-jsonld.html"), new URL("https://boards.greenhouse.io/datadog/jobs/1"))).toEqual({
      name: "Datadog, Inc.",
      source: "json-ld",
    });
    // Glassdoor's markup on a site we don't list is just markup.
    expect(extractEmployer(page("glassdoor.html"), new URL("https://example.com/copy"))).toBeNull();
  });
});

describe("site rules", () => {
  it("knows each listed site by host", () => {
    expect(siteFor(new URL("https://uk.indeed.com/viewjob?jk=1"))?.id).toBe("indeed");
    expect(siteFor(new URL("https://www.linkedin.com/feed/"))?.id).toBe("linkedin");
    expect(siteFor(new URL("https://notlinkedin.com/jobs/view/1"))).toBeNull();
    expect(siteFor(new URL("https://www.linkedin.com.evil.example/jobs/view/1"))).toBeNull();
  });

  it("reads a listed site's selectors only on its job pages", () => {
    // LinkedIn's company name also appears on its feed; that's not a posting.
    expect(extractEmployer(page("linkedin-guest.html"), new URL("https://www.linkedin.com/feed/"))).toBeNull();
  });

  it("has a fixture for every site", () => {
    const files = ["linkedin", "indeed", "glassdoor", "handshake", "wellfound"];
    expect(SITES.map((s) => s.id).sort()).toEqual([...files].sort());
  });
});

describe("cleanName", () => {
  it.each([
    ["  Google \n ", "Google"],
    ["Deloitte Logo", "Deloitte"],
    ["JPMorgan Chase &amp; Co.", "JPMorgan Chase & Co."],
    ["Acme Corp · 3 days ago", "Acme Corp"],
  ])("%j -> %j", (raw, want) => {
    expect(cleanName(raw)).toBe(want);
  });

  it.each([[""], ["A"], ["x".repeat(200)]])("refuses %j", (raw) => {
    expect(cleanName(raw)).toBeNull();
  });
});
