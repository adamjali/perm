/**
 * The About page and everything that points at it stay in step.
 *
 * Three surfaces read `src/lib/constants/about.ts` (the page, the homepage
 * block, the Organization schema) and four more must name the route (the Learn
 * menu, the sitemap, llms.txt, the homepage FAQ that no longer duplicates
 * /faq). A page nothing links to is the class of defect this site keeps
 * meeting, so the links are asserted here rather than assumed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ABOUT_ONE_LINER, PEOPLE } from "@/lib/constants/about";
import { LEARN_NAV_LINKS } from "@/lib/constants/navigation";
import { HOME_FAQS } from "@/components/home/faqData";
import { getOrganizationSchema } from "@/lib/structuredData";

const ROOT = path.resolve(__dirname, "../../../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("the About surfaces", () => {
  it("the page, the homepage block and the schema read the same facts module", () => {
    for (const rel of [
      "src/app/(site)/(public)/about/page.tsx",
      "src/components/home/AboutSection.tsx",
      "src/lib/structuredData.ts",
    ]) {
      expect(read(rel)).toMatch(/from ["'][^"']*constants\/about["']/);
    }
    expect(read("src/app/(site)/(public)/about/page.tsx")).toContain("ABOUT_ONE_LINER");
    expect(read("src/components/home/AboutSection.tsx")).toContain("ABOUT_ONE_LINER");
  });

  it("names two people with roles, and the schema founders match them", () => {
    expect(PEOPLE).toHaveLength(2);
    const org = getOrganizationSchema("https://permtracker.app") as {
      founder: { name: string; jobTitle: string }[];
    };
    expect(org.founder.map((f) => f.name)).toEqual(PEOPLE.map((p) => p.name));
    expect(org.founder.map((f) => f.jobTitle)).toEqual(PEOPLE.map((p) => p.jobTitle));
  });

  it("makes no beneficiary claim for the builder", () => {
    // Approved wording is "watched ... wait" and "worked through the process
    // with them"; a first-person waiting claim would be false.
    const page = read("src/app/(site)/(public)/about/page.tsx");
    expect(page).not.toMatch(/waited on (his|my) own/i);
    expect(page).toMatch(/watching family, friends and colleagues/);
  });

  it("is reachable: Learn menu, homepage block, sitemap and llms.txt all name /about", () => {
    expect(LEARN_NAV_LINKS.some((l) => l.href === "/about")).toBe(true);
    expect(read("src/components/home/AboutSection.tsx")).toContain('href="/about"');
    expect(read("src/lib/sitemap/build.ts")).toContain("${base}/about");
    expect(read("src/app/llms.txt/route.ts")).toContain("/about)");
    expect(read("src/app/(site)/(public)/page.tsx")).toContain("<AboutSection />");
  });

  it("the homepage FAQ no longer duplicates the definitional /faq answers", () => {
    const faqPage = read("src/app/(site)/(public)/faq/page.tsx");
    for (const q of HOME_FAQS.map((f) => f.question)) {
      expect(faqPage).not.toContain(`"${q}"`);
    }
    expect(HOME_FAQS.some((f) => /What exactly does PERM Tracker do/.test(f.question))).toBe(false);
    expect(ABOUT_ONE_LINER).toMatch(/^PERM Tracker is a free, independent website/);
  });
});
