/**
 * The browser extension: what it shows, where it works, and exactly what it
 * sends. The store listing's privacy link points at #privacy here.
 *
 * The example panel is real: the extension's own wording (extension/src/
 * model.ts) applied to today's answer for one employer, so this page can't
 * describe a panel the extension doesn't draw. The sites listed are read from
 * the extension's site table for the same reason.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseIcon, CursorClickIcon, PuzzlePieceIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr";

import { lookupEmployer } from "@/lib/api/employerLookup";
import { openGraphBase } from "@/lib/openGraphBase";
import { SITES } from "../../../../../extension/src/extract";
import { panelFor, type PanelModel } from "../../../../../extension/src/model";
import type { LookupAnswer } from "../../../../../extension/src/api";

/** The listing's address, once the Chrome Web Store publishes it. */
const CHROME_STORE_URL: string | null = null;
/** The employer the example panel shows. */
const EXAMPLE = "Google";

const TITLE = "PERM Tracker for Chrome: Visa Sponsor Check";
const DESCRIPTION =
  "A free Chrome extension that shows an employer's PERM green card and H-1B record from DOL's files on the job posting. It sends only the employer's name.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/extension" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/extension" },
};

/** The example's figures move with DOL's records; a day is plenty. */
export const revalidate = 86400;

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

async function examplePanel(): Promise<PanelModel | null> {
  try {
    const r = await lookupEmployer(EXAMPLE);
    if (!r.ok || r.data.match !== "exact") return null;
    return panelFor({ kind: "answer", answer: { data: r.data, meta: r.meta } as LookupAnswer });
  } catch {
    return null;
  }
}

function ExamplePanel({ model }: { model: PanelModel }) {
  return (
    <figure className="mx-auto w-full max-w-sm">
      <div className="border-2 border-border bg-card shadow-hard">
        <div className="flex items-center gap-3 border-b-2 border-border px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the site's own mark, a static SVG */}
          <img src="/icon.svg" alt="" width={28} height={28} className="size-7" />{" "}
          <span className="font-heading text-base font-black">PERM Tracker</span>
        </div>{" "}
        <div className="px-4 py-4">
          <p className="font-heading text-lg font-black leading-snug [overflow-wrap:anywhere]">{model.title}</p>{" "}
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
            {model.rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-sm text-foreground/70">{r.label}</dt>{" "}
                <dd className="text-right text-base font-black tabular-nums">
                  {r.value}
                  {r.note ? <span className="block text-sm font-normal text-foreground/70">{r.note}</span> : null}
                </dd>{" "}
              </div>
            ))}
          </dl>{" "}
          {model.link ? (
            <p className="mt-3">
              <a href={model.link.href} className={link}>
                {model.link.text}
              </a>
            </p>
          ) : null}{" "}
          {model.footer ? <p className="mt-3 text-sm text-foreground/70">{model.footer}</p> : null}
        </div>
      </div>{" "}
      <figcaption className="mt-3 text-center text-sm text-foreground/70">
        The panel on a {EXAMPLE} posting, with today&rsquo;s figures.
      </figcaption>
    </figure>
  );
}

const SENT: Array<[string, string]> = [
  ["What's sent", "The employer's name as the posting prints it, to permtracker.app. With it, the extension's version number."],
  ["What isn't", "The page's address, the job's title or text, anything you type, your browsing, and cookies: the request carries none, signed in or not."],
  ["What's kept", "Each answer, in your browser's session storage for six hours, so going back to a posting doesn't ask again. It's cleared when the browser closes."],
  ["On our side", "A daily count of lookups. Like any site, our web server keeps a request log for 14 days, and each line holds your connection's address and the name asked about. Nothing ties a lookup to an account, and nothing else is kept. Requests reach us through Cloudflare, like every visit to this site."],
  ["Tracking", "None. No analytics, no ads, no third parties."],
];

const PERMISSIONS: Array<[string, string]> = [
  ["Read the five job sites", "To read the employer's name on a posting. On LinkedIn the whole site is matched, since it opens a posting from the feed without a new page; anywhere that isn't a posting, nothing is read."],
  ["Active tab, and scripting", "Only when you click the toolbar button on another job page: it reads that one page's posting, once."],
  ["Storage", "The six-hour session cache above."],
  ["permtracker.app", "The one server it asks."],
];

export default async function ExtensionPage() {
  const model = await examplePanel();
  const sites = SITES.map((s) => s.label);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <header className="grid grid-cols-1 items-center gap-10 pt-10 [&>*]:min-w-0 sm:pt-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">PERM Tracker for Chrome</h1>{" "}
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-foreground/75">
            Open a job posting and see whether that employer sponsors green cards and H-1Bs, from the Labor
            Department&rsquo;s own files, without leaving the page. Free, and it sends only the employer&rsquo;s name.
          </p>{" "}
          <div className="mt-6">
            {CHROME_STORE_URL ? (
              <a
                href={CHROME_STORE_URL}
                className="inline-flex min-h-11 items-center gap-2 border-2 border-border bg-primary px-5 py-3 font-heading text-base font-black text-black shadow-hard"
              >
                <PuzzlePieceIcon weight="bold" className="size-5" aria-hidden="true" />{" "}
                Add to Chrome
              </a>
            ) : (
              <p className="inline-flex items-center gap-2 border-2 border-border bg-card px-4 py-3 text-base font-bold">
                <PuzzlePieceIcon weight="bold" className="size-5 shrink-0" aria-hidden="true" />{" "}
                On the Chrome Web Store soon, free.
              </p>
            )}
          </div>
        </div>{" "}
        {model ? <ExamplePanel model={model} /> : null}
      </header>

      <section className="mt-14" aria-labelledby="where">
        <h2 id="where" className="font-heading text-2xl font-black">
          Where it works
        </h2>{" "}
        <ul className="mt-5 grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2">
          <li className="flex gap-4 border-2 border-border bg-card p-5">
            <BriefcaseIcon weight="bold" className="size-7 shrink-0 text-primary-text" aria-hidden="true" />{" "}
            <div>
              <p className="font-heading text-lg font-black">On its own</p>{" "}
              <p className="mt-1 text-base leading-relaxed text-foreground/75">
                {sites.slice(0, -1).join(", ")} and {sites.at(-1)}. The panel opens at the bottom right of a posting.
              </p>
            </div>
          </li>{" "}
          <li className="flex gap-4 border-2 border-border bg-card p-5">
            <CursorClickIcon weight="bold" className="size-7 shrink-0 text-primary-text" aria-hidden="true" />{" "}
            <div>
              <p className="font-heading text-lg font-black">With a click</p>{" "}
              <p className="mt-1 text-base leading-relaxed text-foreground/75">
                Any other job page that names its employer for search engines, which covers Greenhouse, Lever, Ashby,
                Workday and most company career sites. Click PERM Tracker in the toolbar.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="reading">
        <h2 id="reading" className="font-heading text-2xl font-black">
          Reading the panel
        </h2>{" "}
        <dl className="mt-5 grid grid-cols-1 gap-px border-2 border-border bg-border [&>*]:min-w-0 md:grid-cols-2">
          {(
            [
              ["PERM cases published", "Green card labor certifications in DOL's quarterly files: decided cases only."],
              ["Certified", "The share of decided cases DOL certified, once the employer has 30 or more decided. Fewer, and the panel says it's too few to say."],
              ["Waiting at DOL now", "Its cases still open in DOL's live case status, which we check every day."],
              ["H-1B applications (LCAs)", "Labor condition applications in DOL's files: the first step of an H-1B, not the visa itself."],
              ["Possible match", "The posting's name and DOL's didn't match exactly, so the panel names what it matched. Check it's the same company."],
              ["No record", "Nothing under that name. Companies often file under their legal name, so it may still sponsor under another."],
            ] as const
          ).map(([term, meaning]) => (
            <div key={term} className="bg-card px-5 py-4">
              <dt className="font-heading text-base font-black">{term}</dt>{" "}
              <dd className="mt-1 text-base leading-relaxed text-foreground/75">{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="privacy" className="mt-14 scroll-mt-24" aria-labelledby="privacy-h">
        <h2 id="privacy-h" className="flex items-center gap-3 font-heading text-2xl font-black">
          <ShieldCheckIcon weight="bold" className="size-7 shrink-0 text-primary-text" aria-hidden="true" />{" "}
          Privacy
        </h2>{" "}
        <dl className="mt-5 divide-y-2 divide-border border-2 border-border bg-card">
          {SENT.map(([term, meaning]) => (
            <div key={term} className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
              <dt className="font-heading text-base font-black">{term}</dt>{" "}
              <dd className="text-base leading-relaxed text-foreground/75">{meaning}</dd>
            </div>
          ))}
        </dl>{" "}
        <h3 className="mt-8 font-heading text-lg font-black">What it asks Chrome for, and why</h3>{" "}
        <dl className="mt-3 divide-y-2 divide-border border-2 border-border bg-card">
          {PERMISSIONS.map(([term, meaning]) => (
            <div key={term} className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
              <dt className="font-heading text-base font-black">{term}</dt>{" "}
              <dd className="text-base leading-relaxed text-foreground/75">{meaning}</dd>
            </div>
          ))}
        </dl>{" "}
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/75">
          The rest of how this site handles data is in the{" "}
          <Link href="/privacy" className={link}>
            privacy policy
          </Link>
          . Questions go to{" "}
          <a href="mailto:support@permtracker.app?subject=Chrome%20extension" className={link}>
            support@permtracker.app
          </a>
          .
        </p>
      </section>

      <section className="mt-14 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-xl font-black">Building your own?</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/75">
          The extension asks one endpoint, <code className="font-mono">/v1/lookup/employer</code>, and it needs no key.
          It&rsquo;s documented with the rest of the{" "}
          <Link href="/developers" className={link}>
            API
          </Link>
          . PERM Tracker isn&rsquo;t affiliated with the U.S. government, and nothing here is legal advice.
        </p>
      </section>
    </div>
  );
}
