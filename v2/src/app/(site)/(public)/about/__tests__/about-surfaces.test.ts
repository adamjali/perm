/**
 * The About page and everything that points at it stay in step.
 *
 * Three surfaces read `src/lib/constants/about.ts` (the page, the homepage
 * block, the Organization schema) and four more must name the route (the Learn
 * menu, the sitemap, llms.txt, the homepage FAQ that no longer duplicates
 * /faq). A page nothing links to is the class of defect this site keeps
 * meeting, so the links are asserted here rather than assumed.
 */
import fs, { readFileSync } from "node:fs";
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

  it("names one person with a role, and the schema founder matches", () => {
    expect(PEOPLE).toHaveLength(1);
    expect(PEOPLE[0]?.name).toBe("Sabrina Soltau");
    const org = getOrganizationSchema("https://permtracker.app") as {
      founder: { name: string; jobTitle: string }[];
    };
    expect(org.founder.map((f) => f.name)).toEqual(PEOPLE.map((p) => p.name));
    expect(org.founder.map((f) => f.jobTitle)).toEqual(PEOPLE.map((p) => p.jobTitle));
  });

  it("ships the portrait it declares, at the size it declares", () => {
    for (const p of PEOPLE) {
      const file = path.join(ROOT, "public", p.image);
      expect(fs.existsSync(file), `${p.image} missing under public/`).toBe(true);
      // JPEG SOF0/SOF2 header carries height then width; assert the declared
      // size is the file's, because a wrong width/height on an <img> is a
      // confidently wrong space reservation (CLS), worse than none.
      const buf = fs.readFileSync(file);
      let i = 2;
      let size: [number, number] | null = null;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          size = [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
          break;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      expect(size).toEqual([...p.imageSize]);
    }
  });

  it("makes no beneficiary claim for the person named", () => {
    // Approved wording: she FILES these cases. A first-person waiting claim
    // would be false, and no other person is named anywhere on the surfaces.
    const page = read("src/app/(site)/(public)/about/page.tsx");
    expect(page).not.toMatch(/waited on (her|his|my) own/i);
    expect(page).toMatch(/files these cases/);
    for (const rel of [
      "src/app/(site)/(public)/about/page.tsx",
      "src/components/home/AboutSection.tsx",
      "src/lib/constants/about.ts",
      "src/lib/constants/externalLinks.ts",
      "src/app/llms.txt/route.ts",
      "src/lib/pageCards.ts",
    ]) {
      // The X handle is allowed (kept linked on the owner's decision); the
      // GitHub handle, the second name and the old title are not.
      expect(read(rel)).not.toMatch(/adamjali|Adam J Ali|professor/i);
    }
  });

  it("is reachable: Learn menu, homepage block, sitemap and llms.txt all name /about", () => {
    expect(LEARN_NAV_LINKS.some((l) => l.href === "/about")).toBe(true);
    expect(read("src/components/home/AboutSection.tsx")).toContain('href="/about"');
    expect(read("src/lib/sitemap/build.ts")).toContain("${base}/about");
    expect(read("src/app/llms.txt/route.ts")).toContain("/about)");
    expect(read("src/app/(site)/(public)/page.tsx")).toMatch(/<AboutSection\b/);
  });

  it("the four brand-defining questions live on the homepage and NOT on /faq", () => {
    // Reversed on 2026-09-15. The Sep 7 trim moved every definitional
    // question to /faq, after which /faq kept the brand query, because it
    // was the only page whose first answer defined the product. The page
    // that should own the name answers what the name is; /faq keeps the
    // PERM-process questions. One page per question, asserted both ways.
    const faqPage = read("src/app/(site)/(public)/faq/page.tsx");
    const home = read("src/components/home/faqData.tsx");
    for (const q of [
      "What exactly does PERM Tracker do?",
      "Is PERM Tracker really free?",
      "Is my client data secure?",
      "Can I import my existing cases?",
    ]) {
      expect(home, `homepage FAQ lacks "${q}"`).toContain(`"${q}"`);
      expect(faqPage, `/faq still carries "${q}"`).not.toContain(`"${q}"`);
    }
    // Three per audience, so neither side reads as the whole product.
    expect(home).toContain("Can I check my PERM status without an account?");
    expect(home).toContain("What does the case-management app do for attorneys and HR teams?");
    expect(ABOUT_ONE_LINER).toMatch(/^PERM Tracker is a free, independent website/);
  });

  it("the homepage states BOTH halves in prose above the fold, from the shared constant", () => {
    const hero = read("src/components/home/HeroSection.tsx");
    expect(hero).toContain("ABOUT_ONE_LINER");
    expect(hero).toMatch(/case-management app for attorneys, paralegals and\s+HR teams/);
    const blocks = read("src/components/home/AudienceBlocks.tsx");
    expect(blocks).toContain("ABOUT_TWO_HALVES.waiting");
    expect(blocks).toContain("ABOUT_TWO_HALVES.practice");
    expect(read("src/app/(site)/(public)/page.tsx")).toMatch(/<AudienceBlocks\b/);
  });
});
