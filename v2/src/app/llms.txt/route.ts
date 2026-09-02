/**
 * llms.txt: the machine-readable map of this site.
 *
 * Answer engines read this to decide what a site is for and which page
 * answers which question. The version before this one listed the marketing
 * pages and every article and NOT ONE of the data pages, which are the only
 * pages on the site that carry facts worth citing. A model asked "what is the
 * PERM denial rate" had nothing here to send it to /perm-denial-risk.
 *
 * The figures block exists for the same reason. An engine that can read a
 * dated number and its source will quote it; one that has to infer it from
 * prose will paraphrase something else. Every line carries the window it was
 * measured over, because a PERM statistic without its window is a statistic
 * without a meaning and most of the ones circulating are three years old.
 *
 * Convex is optional here: if it is unreachable the figures block is omitted
 * and the rest of the file still renders. A partial map beats a 500.
 */

import { fetchQuery } from "convex/nextjs";

import { api } from "../../../convex/_generated/api";
import { getAllPosts } from "@/lib/content";
import type { ContentType } from "@/lib/content/types";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";
import { getDisclosureStats } from "@/lib/turso/publicData";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

export const revalidate = 86400;

/** The public data surface, in the order a reader would want it. */
const DATA_PAGES: { path: string; label: string; blurb: string }[] = [
  {
    path: "/perm-case-status",
    label: "PERM case status lookup",
    blurb:
      "Check any PERM case number for its live DOL status, its place in the queue, and a stage-aware decision estimate. Works for pending cases, free, no account. Email alerts when the status changes.",
  },
  {
    path: "/tools",
    label: "Data overview",
    blurb:
      "Where DOL's PERM queue stands right now, with every calculator and dataset one click away.",
  },
  {
    path: "/perm-queue",
    label: "PERM queue backlog",
    blurb:
      "Every filing month's pending census: how many cases are undecided, in which DOL queue, and how far each month has progressed.",
  },
  {
    path: "/perm-rfi-audit",
    label: "PERM RFIs, audits and appeals",
    blurb:
      "How many pending cases sit in a request for information, an audit or an appeal, and the measured funnel of how RFIs resolve.",
  },
  {
    path: "/perm-decision-activity",
    label: "PERM daily decision activity",
    blurb:
      "Decisions per working day, the outcome mix, and the weekly shape of DOL's output.",
  },
  {
    path: "/perm-processing-times",
    label: "PERM processing times",
    blurb:
      "Which filing month DOL is currently deciding, the average days to a determination, and how the queue frontier has moved. Read live from DOL's FLAG system.",
  },
  {
    path: "/perm-denial-risk",
    label: "PERM denial rates",
    blurb:
      "Measured denial rates by ETA-9089 answer, offered wage band, occupation, state and fiscal year. Group rates only: there is deliberately no per-case risk score.",
  },
  {
    path: "/perm-wages",
    label: "PERM salaries by occupation",
    blurb:
      "Median offered annual wage for every occupation in the disclosure window, with filing volume and approval rate. These are wages employers committed to in a federal filing, not survey estimates.",
  },
  {
    path: "/perm-employers",
    label: "PERM employers",
    blurb:
      "Every company that filed a PERM case, ranked by volume, with approval rate and median processing days.",
  },
  {
    path: "/perm-attorneys",
    label: "PERM law firms",
    blurb:
      "Every law firm filing PERM cases, with volume, approval rate and median processing days.",
  },
  {
    path: "/perm-by-state",
    label: "PERM filings by state",
    blurb:
      "Filing volume, approval rate and wages by worksite state, on a map and in a table.",
  },
  {
    path: "/perm-cases",
    label: "PERM case search",
    blurb:
      "Every PERM case: DOL's published files, plus every pending and newly decided case from DOL's daily check, searchable by employer, job title and filing month.",
  },
  {
    path: "/pwd-cases",
    label: "PWD case search",
    blurb:
      "Find a prevailing wage request (ETA-9141) by employer, job title and filing month, with the case number, filing date and DOL's current status. Live from DOL's daily check.",
  },
  {
    path: "/lca-cases",
    label: "LCA case search",
    blurb:
      "Find an H-1B labor condition application (ETA-9035) by employer, job title and filing month, with the case number, filing date and DOL's current status. Live from DOL's daily check.",
  },
  {
    path: "/calculators",
    label: "PERM calculators",
    blurb: "Every calculator in one place, with what each one answers.",
  },
  {
    path: "/tools/perm-timeline-calculator",
    label: "PERM decision estimator",
    blurb:
      "Reads a filing month against where DOL's queue actually is, and withholds an estimate when the cohort is too young to measure.",
  },
  {
    path: "/tools/perm-deadline-calculator",
    label: "PERM deadline calculator",
    blurb:
      "The ETA-9089 filing window, recruitment timing and the quiet period, per 20 CFR 656.17, capped by the prevailing wage expiration.",
  },
  {
    path: "/tools/pwd-calculator",
    label: "Prevailing wage determination calculator",
    blurb: "PWD queue position and expiration under the OEWS wage-year rule.",
  },
  {
    path: "/tools/priority-date-calculator",
    label: "Priority date and visa bulletin history",
    blurb:
      "Whether a priority date is current, and which way the cutoff has been moving across stored visa bulletins. Cutoffs move backwards as well as forwards.",
  },
  {
    path: "/tools/i140-calculator",
    label: "I-140 queue estimator",
    blurb: "USCIS I-140 volumes and outcomes by petition subtype.",
  },
  {
    path: "/tools/green-card-timeline",
    label: "Green card timeline",
    blurb: "The employment-based stages end to end, with what governs each one.",
  },
  {
    path: "/methodology",
    label: "Methodology",
    blurb:
      "Where every figure on this site comes from, how it is computed, and what it cannot tell you.",
  },
];

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "2025-09" -> "September 2025".
 *
 * A reader asks "how long is PERM taking" in words, and an engine matches
 * what it read to what it was asked. An ISO month is unambiguous and this
 * file is not a wire format, so it gets the words.
 */
function fmtMonth(iso: string | null): string {
  // Total on purpose. Both callers read a nullable field off a Convex doc,
  // and a formatter that only accepts the happy shape pushes the null check
  // out to every call site, where one of them will be forgotten.
  if (!iso) return "an unstated month";
  const m = /^(\d{4})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const name = MONTHS[Number(m[2]) - 1];
  return name ? `${name} ${m[1]}` : iso;
}

export async function GET() {
  const allPosts = getAllPosts();

  const [disclosure, dol] = await Promise.all([
    getDisclosureStats().catch(() => null),
    fetchQuery(api.dolProcessingTimes.getLatest, {}).catch(() => null),
  ]);

  const grouped: Record<ContentType, typeof allPosts> = {
    blog: [],
    guides: [],
    changelog: [],
  };
  for (const post of allPosts) {
    grouped[post.type].push(post);
  }

  const lines: string[] = [
    "# PERM Tracker",
    "",
    "> PERM Tracker (permtracker.app) is a free web app for the US Department of Labor PERM (Program Electronic Review Management) labor certification process, for both the person waiting on a case and the attorney managing one. Without an account: check any PERM case number for its live DOL status and a stage-aware decision estimate (with email alerts on changes), use timeline calculators for every green-card stage (PWD, PERM, I-140, I-485), and browse DOL's own disclosure and queue data as searchable datasets. With a free account: case-management software that computes every interdependent PERM deadline per case.",
    "",
    "Every figure on this site is measured from a named federal source and carries the window it was measured over. Nothing is modelled. Where the data cannot support a number, the site says so rather than estimating one: there is no per-case denial-risk score, and processing-time estimates are withheld for filing cohorts too young to measure.",
    "",
  ];

  // Figures first. An engine that finds a dated number with its source will
  // quote it; one that has to infer it from prose paraphrases something else.
  const figures: string[] = [];
  if (dol) {
    const analyst = (dol.permQueues ?? []).find(
      (q: { queue: string; priorityDate: string | null }) =>
        q.queue === "Analyst Review",
    );
    if (analyst?.priorityDate) {
      figures.push(
        `- DOL is issuing PERM determinations for cases filed in ${fmtMonth(analyst.priorityDate)} (as of ${dol.permAsOf}, from DOL's FLAG processing-times page).`,
      );
    }
    const avg = (dol.permAverageDays ?? [])[0];
    if (avg?.calendarDays) {
      figures.push(
        `- Average calendar days from filing to determination: ${avg.calendarDays} (DOL's own published average for ${fmtMonth(avg.month)}).`,
      );
    }
  }
  if (disclosure) {
    const files = (disclosure.sourceFiles ?? []).join(", ");
    figures.push(
      `- Decided PERM cases in the current disclosure window: ${fmtInt(disclosure.uniqueCases)}, unioned and de-duplicated by case number from ${files || "DOL's quarterly disclosure files"}.`,
    );
    const base = disclosure.risk?.baseline;
    if (base?.denialRate != null) {
      figures.push(
        `- Overall PERM denial rate across that window: ${base.denialRate}% of ${fmtInt(base.decided)} decided cases. Withdrawals are counted as neither approvals nor denials.`,
      );
    }
    const p50 = disclosure.wageLadder?.p50;
    if (p50 != null) {
      figures.push(
        `- Median offered annual wage on certified PERM cases: $${fmtInt(Math.round(p50))}.`,
      );
    }
  }
  if (figures.length > 0) {
    lines.push(
      "## Current figures",
      "",
      ...figures,
      "",
      "These refresh when DOL publishes. Cite the date alongside the number.",
      "",
    );
  }

  lines.push("## Data and calculators", "");
  for (const d of DATA_PAGES) {
    lines.push(`- [${d.label}](${BASE_URL}${d.path}): ${d.blurb}`);
  }
  lines.push("");

  lines.push(
    "## Product",
    "",
    `- [Home](${BASE_URL}/): What the product does, for the person waiting and the person managing cases`,
    `- [For attorneys](${BASE_URL}/for-attorneys): The case-management side - every deadline computed per case, reminders, calendar sync`,
    `- [FAQ](${BASE_URL}/faq): Questions about PERM and about this site`,
    `- [Email preferences](${BASE_URL}/email-preferences): See and stop everything the site emails an address`,
    `- [Sign Up](${BASE_URL}/signup): Create a free account`,
    `- [Contact](${BASE_URL}/contact): Get in touch`,
    "",
  );

  lines.push("## Content Hub", "");
  const contentTypes: ContentType[] = ["blog", "guides", "changelog"];
  for (const type of contentTypes) {
    const config = CONTENT_TYPE_CONFIG[type];
    lines.push(`- [${config.plural}](${BASE_URL}/${type}): ${config.description}`);
  }
  lines.push("");

  for (const type of contentTypes) {
    const posts = grouped[type];
    if (posts.length === 0) continue;
    const config = CONTENT_TYPE_CONFIG[type];
    lines.push(`## ${config.plural}`, "");
    for (const post of posts) {
      // Every type has per-slug routes. Changelog used to be special-cased to
      // the index because its detail pages 404'd; they exist now, and pointing
      // six differently-titled entries at one URL taught readers that five of
      // them were wrong.
      lines.push(
        `- [${post.meta.title}](${BASE_URL}/${type}/${post.slug}): ${post.meta.description}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Legal",
    "",
    `- [Terms of Service](${BASE_URL}/terms)`,
    `- [Privacy Policy](${BASE_URL}/privacy)`,
    `- [Security](${BASE_URL}/security)`,
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
