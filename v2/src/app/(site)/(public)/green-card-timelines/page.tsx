import type { Metadata } from "next";
import Link from "next/link";
import { queryStatic } from "@/lib/convexStatic";

import { api } from "../../../../../convex/_generated/api";
import { BoardKey, BoardTable, RfeBars, StageMedians } from "@/components/community/TimelineBoard";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * Green card timelines, as the people waiting report them.
 *
 * The PERM half of every timeline is read from DOL's own record by case
 * number; everything after PERM is self-reported, because USCIS publishes
 * nothing case by case, and the page says which is which at every figure.
 * No case number, no employer and no exact PERM date appears here: a row is a
 * filing month and days since filing. The board lists rows only once enough
 * people have chosen to share, so no one row stands alone.
 *
 * Reads one public Convex query (`communityTimelines.board`), which returns
 * only what this page prints. A deploy-skew window where the function does
 * not exist yet renders the empty state rather than failing the route.
 */

const TITLE = "Green Card Timelines, as Reported";
const DESCRIPTION =
  "How long the I-140 and I-485 took, from the people waiting: PERM dates checked against DOL, everything after self-reported, case numbers hidden.";
const PATH = "/green-card-timelines";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "green-card-timelines");

export const revalidate = 21600;

type Board = Awaited<ReturnType<typeof fetchBoard>>;

async function fetchBoard() {
  return queryStatic(api.communityTimelines.board, {}, revalidate);
}

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export default async function GreenCardTimelinesPage() {
  const board: Board | null = await fetchBoard().catch(() => null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/perm-case-status" className="underline underline-offset-2 hover:text-primary">
            Case status
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Green card timelines</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          How long each step after PERM took, from the people who went through it. The PERM dates are checked against
          DOL&apos;s record; the rest is self-reported, because USCIS doesn&apos;t publish it case by case.
        </p>
      </header>

      {board ? (
        <>
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0" aria-label="The record so far">
            <div className="border-2 border-border bg-card p-5 shadow-hard">
              <p className="text-sm text-foreground/70">Timelines added</p>{" "}
              <p className="mt-1 font-heading text-3xl font-black tabular-nums">{board.total.toLocaleString("en-US")}</p>
            </div>{" "}
            <div className="border-2 border-border bg-card p-5 shadow-hard">
              <p className="text-sm text-foreground/70">Shared on the public board</p>{" "}
              <p className="mt-1 font-heading text-3xl font-black tabular-nums">{board.shared.toLocaleString("en-US")}</p>
            </div>{" "}
            <div className="border-2 border-border bg-card p-5 shadow-hard">
              <p className="text-sm text-foreground/70">RFEs reported</p>{" "}
              <p className="mt-1 font-heading text-3xl font-black tabular-nums">{board.rfe.total.toLocaleString("en-US")}</p>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="stages-h">
            <h2 id="stages-h" className="font-heading text-2xl font-black sm:text-3xl">
              How long each step took
            </h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              The bar is the middle half of the reports and the dark tick is the median. Every timeline counts here,
              shared on the board or not.
            </p>
            <div className="mt-5">
              <StageMedians metrics={board.metrics} />
            </div>
          </section>

          <section className="mt-12" aria-labelledby="board-h">
            <h2 id="board-h" className="font-heading text-2xl font-black sm:text-3xl">
              The board
            </h2>{" "}
            {board.open ? (
              <>
                <p className="mt-2 max-w-2xl text-base text-foreground/70">
                  One row per shared timeline, newest first. Each mark sits at the day it happened, counted from the
                  PERM filing. No case number or employer is shown.
                </p>
                <div className="mt-4">
                  <BoardKey />
                </div>
                <div className="mt-4">
                  <BoardTable rows={board.rows} />
                </div>
              </>
            ) : (
              <div className="mt-4 max-w-2xl border-2 border-border bg-card p-5 shadow-hard">
                <p className="font-heading text-xl font-black">
                  Opens at {board.opensAt} shared timelines. {board.shared.toLocaleString("en-US")} so far.
                </p>{" "}
                <p className="mt-2 text-base leading-relaxed text-foreground/80">
                  A board with a handful of rows lets anyone pick one person out, so it stays shut until there are
                  enough to read as a crowd. The medians above already count every timeline added.
                </p>
              </div>
            )}
          </section>

          <section className="mt-12" aria-labelledby="rfe-h">
            <h2 id="rfe-h" className="font-heading text-2xl font-black sm:text-3xl">
              Requests for evidence
            </h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              What the RFEs people reported asked about, and how they ended. Self-reported, and people who got one are
              likelier to say so than people who didn&apos;t, so this is a list of reasons, not a rate.
            </p>
            <div className="mt-5">
              <RfeBars rfe={board.rfe} />
            </div>
          </section>
        </>
      ) : (
        <p className="mt-8 max-w-2xl border-2 border-border bg-card p-5 text-base shadow-hard">
          The timelines can&apos;t be read right now. Try again in a few minutes.
        </p>
      )}

      <section className="mt-12 max-w-3xl" aria-labelledby="add-h">
        <h2 id="add-h" className="font-heading text-2xl font-black sm:text-3xl">
          Add yours
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Look up your PERM case, then use <b>Add your dates</b> under the record. PERM Tracker reads your PERM filing
          and certification dates from DOL itself, so you only type what came after. There&apos;s no account: the
          browser you use keeps a key so you can edit or remove your timeline later, and it shows on the board only if
          you tick the box.
        </p>{" "}
        <p className="mt-4">
          <Link
            href="/perm-case-status"
            className="inline-flex min-h-11 items-center border-2 border-border bg-primary px-5 font-bold text-primary-foreground shadow-hard transition-transform hover:-translate-y-[1px]"
          >
            Look up your case
          </Link>
        </p>
      </section>

      <details className="mt-10 max-w-3xl border-t-2 border-border pt-4">
        <summary className="cursor-pointer list-none font-heading text-lg font-black marker:content-none">
          <span className="inline-flex min-h-11 items-center">What these figures can&apos;t tell you</span>
        </summary>
        <div className="mt-3 space-y-3 text-base leading-relaxed text-foreground/80">
          <p>
            <b>They aren&apos;t a sample of everyone.</b> People with a fast or a stuck case are likelier to add their
            dates than people whose case went as expected, and nobody can check a date after PERM. Read a median here
            as what the people who reported saw, not as what will happen to a case.
          </p>{" "}
          <p>
            <b>USCIS publishes its own medians.</b> For the office-wide picture, see{" "}
            <Link href="/uscis-processing-times" className={link}>
              USCIS processing times
            </Link>
            , which are USCIS&apos;s figures across every case, and the{" "}
            <Link href="/visa-bulletin" className={link}>
              visa bulletin
            </Link>
            , which decides when an I-485 can be filed at all.
          </p>{" "}
          <p>
            <b>Premium and regular I-140s are kept apart</b>, because a median across both describes neither. A
            timeline that doesn&apos;t say is left out of both.
          </p>
        </div>
      </details>
    </div>
  );
}
