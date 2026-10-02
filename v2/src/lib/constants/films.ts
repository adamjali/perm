/**
 * The two explainer films, as the site serves them (public/videos/).
 *
 * Web copies of ~/money/video/hyperframes/permtracker-campaign renders:
 * 1280x720 H.264, CRF 27, AAC 96k, faststart (about 4 MB each). The
 * captions are burned into the picture; `transcript` is the voice script
 * verbatim (src/script.json), so the words are on the page for anyone who
 * cannot or would rather not play the film, and for search. Music: Sascha
 * Ende, ende.app (CC BY 4.0, attribution optional); credits in SOURCES.md
 * beside the renders. Regenerate this file whenever a film is re-cut.
 */

export interface Film {
  src: string;
  poster: string;
  title: string;
  /** One sentence, for search engines' video results. */
  description: string;
  /** Seconds, rounded. */
  duration: number;
  /** The day it was first published on the site, YYYY-MM-DD. */
  published: string;
  transcript: readonly string[];
}

export const FILM_WAITING: Film = {
  src: "/videos/explainer-waiting.mp4",
  poster: "/videos/explainer-waiting-thumb.webp",
  title: "PERM Tracker for the person waiting on a case",
  description: "How to check a PERM case, see where DOL's queue stands and get an email when your case moves, all free and from the Labor Department's own data.",
  duration: 97,
  published: "2026-10-01",
  transcript: [
    "If you're waiting on a PERM case, you're mostly waiting without answers.",
    "PERM Tracker is a free site that turns the Labor Department's own data into answers about your case. No account needed.",
    "Start with the processing time calculator. Enter the date DOL received your case, or paste your case number.",
    "You'll see the most likely decision date, and the window it's likely to fall in.",
    "Below that: how far DOL has got through each month, and how many cases are still ahead of yours.",
    "Look up your case number to see its status in plain English, then choose Email me changes.",
    "You'll get an email when DOL's status for your case changes. You can also get one when DOL reaches your filing month.",
    "After PERM, the calculators keep going: the I-140 queue, your place in the I-485 line, and whether your priority date is current.",
    "The visa bulletin page shows what every earlier bulletin did for your category and country, and it can email you when your cutoff moves.",
    "You can also search every PERM filing by employer, state and wage.",
    "And if an attorney files your case, PERM Tracker has a side for them too. It works out every deadline across their cases.",
    "PERM Tracker. Free for applicants and attorneys, at permtracker.app.",
  ],
};

export const FILM_ATTORNEYS: Film = {
  src: "/videos/explainer-attorneys.mp4",
  poster: "/videos/explainer-attorneys-thumb.webp",
  title: "PERM Tracker for attorneys and HR teams",
  description: "How PERM Tracker works out every PERM deadline from the dates you enter, recalculates when one changes and reminds you before each one, free.",
  duration: 93,
  published: "2026-10-01",
  transcript: [
    "A PERM case runs on dates. Miss the filing window, and recruitment starts over.",
    "PERM Tracker is a free case manager built for exactly that, and it's run by an immigration attorney who files these cases.",
    "Add a case, or import your whole caseload. Client data is encrypted at rest and kept separate for every account.",
    "Enter the dates you have, and it works out the rest: the job order's thirty days, the recruitment window, the filing window, the wage determination's expiry, and the I-140 deadline.",
    "Change one date, and everything after it recalculates.",
    "If something's out of order, like filing after the wage determination expires, it tells you before you file.",
    "The Deadline Hub sorts every case into overdue, this week, this month, and later. The calendar and timeline show your whole caseload at once.",
    "Reminders come in the app, by email and push, and on your Google Calendar. Every Monday, you get a digest of the whole caseload.",
    "Quiet hours pause the routine alerts. Urgent ones still get through.",
    "Your clients get free tools too. They can see where their case sits in DOL's line, without an account.",
    "PERM Tracker. Free, at permtracker.app.",
  ],
};
