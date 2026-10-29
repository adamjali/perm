/**
 * Each tracker's homepage as it opened on the day /compare read it: the first
 * screen at 1440 by 810, scaled to 960 by 540 (owner, Oct 27 2026: "need a pic
 * of all competitors"). One page load each, the homepage only, every site's
 * robots.txt allowing it; H1BPerm's is the capture taken in a person's own
 * browser that day, since its site asks scripts not to read it. H1BGrader's
 * was taken in a person's own browser on Oct 28, after Cloudflare's check
 * passed by itself, from two screens of that 1440-wide, 756-tall window joined
 * at the same page row (the top 656 rows, then rows 656 to 810). Nothing was
 * clicked or dismissed, so a site's own ad bar or cookie notice shows as it did.
 *
 * Re-take with `node node_modules/.cache/qa/rival-shots.mjs <dir>` when the
 * marks are re-read, and change the date in the caption with them.
 */
export interface HomeShot {
  src: string;
  width: number;
  height: number;
  /** What the picture shows, for anyone who can't see it. */
  alt: string;
}

export const HOME_SHOTS: Record<string, HomeShot> = {
  permupdate: {
    src: "/images/compare/permupdate.webp",
    width: 960,
    height: 540,
    alt: "PERM Update's homepage: an ad across the top, a purple banner reading PERM Timeline Tracker, and a dashboard of yesterday's 791 processed and 742 certified cases.",
  },
  "perm-timeline": {
    src: "/images/compare/perm-timeline.webp",
    width: 960,
    height: 540,
    alt: "PERM Timeline's homepage: a dark blue title banner, a list of PERM tools, and DOL's four queue figures: January 2026, December 2025, 336 days and June 2026.",
  },
  permtrack: {
    src: "/images/compare/permtrack.webp",
    width: 960,
    height: 540,
    alt: "PermTrack's homepage: a side menu and a chart of PERM cases by filing month, under the line that DOL is deciding cases filed in January 2026.",
  },
  immilane: {
    src: "/images/compare/immilane.webp",
    width: 960,
    height: 540,
    alt: "ImmiLane's homepage: a dark page titled PERM Tracker, an employer search box, and a chart of DOL's processing timeline by filing month.",
  },
  permqueue: {
    src: "/images/compare/permqueue.webp",
    width: 960,
    height: 540,
    alt: "PermQueue's homepage: a dark page headed PERM Tracker, your real place in the PERM queue, beside a panel of 602 cases decided that day.",
  },
  h1bgrader: {
    src: "/images/compare/h1bgrader.webp",
    width: 960,
    height: 540,
    alt: "H1BGrader's homepage: a teal menu bar, a search for H-1B sponsors by company, job title or city, a strip announcing its new PERM tracker, and its top H-1B sponsors, job titles and cities for FY 2026 Q3.",
  },
  greencardclock: {
    src: "/images/compare/greencardclock.webp",
    width: 960,
    height: 540,
    alt: "GreenCardClock's homepage: a pale green page headed Your Green Card Clock Is Already Ticking, a banner that the November 2026 visa bulletin is live, buttons to check a priority date and explore salary data, and a cookie notice along the bottom.",
  },
  lawfully: {
    src: "/images/compare/lawfully.webp",
    width: 960,
    height: 540,
    alt: "Lawfully's homepage: a white page headed Lawfully, your immigration journey starts here, with two cards, one for its case tracker and one for its business plan.",
  },
  immigrationroad: {
    src: "/images/compare/immigrationroad.webp",
    width: 960,
    height: 540,
    alt: "Immigration Road's homepage: a green road-sign logo, buttons for the October and November 2026 visa bulletins, a chart of EB-2 cutoff dates, and its green card calculator.",
  },
  h1bperm: {
    src: "/images/compare/h1bperm.webp",
    width: 960,
    height: 540,
    alt: "H1BPerm's homepage: a dark page headed PWD, PERM and I-485 timelines, DOL's FLAG maintenance notice, and the filing days DOL is working on.",
  },
};
