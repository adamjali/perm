import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BellRingingIcon,
  BuildingsIcon,
  CalendarCheckIcon,
  EnvelopeSimpleIcon,
  FileMagnifyingGlassIcon,
  HourglassIcon,
  ListChecksIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PowerIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";

import { PrefsRequestForm } from "@/components/prefs/PrefsRequestForm";
import { AlertLanesFigure } from "@/components/marketing/PageFigures";
import {
  ACCOUNT_KINDS,
  MAIL_KINDS,
  MAIL_RULES,
  NOTIFICATION_SETTINGS_PATH,
  SUBSCRIBER_KINDS,
  type MailKindId,
} from "@/lib/mailKinds";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * Everything PERM Tracker emails, and the one link that turns it off.
 *
 * The alerts each carry their own unsubscribe link, and nothing else let a
 * person see what an address gets across all of them. This page requests the
 * preferences link (served by Convex at /prefs) and lists every kind of email
 * from the shared list in convex/lib/mailKinds.ts, the same names the emailed
 * page and Settings use. Turning something on always happens on the page that
 * owns it, never from a link.
 */

export const metadata: Metadata = withSocialCard({
  title: "Email Preferences",
  description:
    "See everything PERM Tracker emails you, from case and queue alerts to the weekly digest, and turn any of it off with one link.",
  alternates: {
    canonical: "/email-preferences",
  },
  openGraph: {
    ...openGraphBase,
    title: "Email Preferences",
    description: "One link to see and stop everything PERM Tracker emails you.",
    url: "/email-preferences",
  },
}, "email-preferences");

const KIND_ICONS: Record<MailKindId, Icon> = {
  case: FileMagnifyingGlassIcon,
  queue: HourglassIcon,
  bulletin: CalendarCheckIcon,
  employer: BuildingsIcon,
  newsletter: NewspaperIcon,
  news: MegaphoneIcon,
  reminders: BellRingingIcon,
  updates: ArrowsClockwiseIcon,
  digest: ListChecksIcon,
};

const RULE_ICONS: readonly Icon[] = [SealCheckIcon, EnvelopeSimpleIcon, PowerIcon];

function KindTile({ id }: { id: MailKindId }) {
  const kind = MAIL_KINDS[id];
  const Glyph = KIND_ICONS[id];
  return (
    <li className="flex flex-col border-2 border-border bg-card p-5 shadow-hard-sm">
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center border-2 border-border bg-primary text-black"
        >
          <Glyph className="size-6" weight="bold" />
        </span>{" "}
        <span className="border-2 border-border px-2 py-0.5 text-sm font-semibold">{kind.when}</span>
      </div>{" "}
      <h4 className="mt-4 font-heading text-lg font-black">{kind.name}</h4>{" "}
      <p className="mt-1 flex-1 text-base leading-relaxed text-foreground/75">{kind.what}</p>{" "}
      <Link
        href={kind.start.href}
        className="group mt-4 inline-flex min-h-[44px] items-center gap-2 self-start text-sm font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
      >
        {kind.start.label}{" "}
        <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function KindGroup({ title, ids }: { title: string; ids: readonly MailKindId[] }) {
  return (
    <>
      <h3 className="mt-10 font-heading text-xl font-black">{title}</h3>{" "}
      <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {ids.map((id) => (
          /* Keyed Fragment with a real space: mapped siblings otherwise read
             as one glued run to anything that extracts the text. */
          <Fragment key={id}>
            {" "}
            <KindTile id={id} />
          </Fragment>
        ))}
      </ul>
    </>
  );
}

export default function EmailPreferencesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-5xl">
        Your email, in one place
      </h1>{" "}
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/75">
        See everything PERM Tracker sends you, and turn any of it off.
      </p>

      <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="lg:col-span-7">
          <PrefsRequestForm />
        </div>{" "}
        {/* Beside the form: a reader deciding whether to give an address
            wants to see what arrives. */}
        <figure className="m-0 border-2 border-border bg-card p-5 shadow-hard-sm lg:col-span-5">
          <AlertLanesFigure className="text-foreground" />{" "}
          <figcaption className="mt-3 border-t-2 border-border pt-3 text-sm font-semibold text-muted-foreground">
            One email per change. Nothing while nothing changes.
          </figcaption>
        </figure>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3 [&>*]:min-w-0">
        {MAIL_RULES.map((rule, i) => {
          const Glyph = RULE_ICONS[i] ?? SealCheckIcon;
          return (
            <Fragment key={rule.title}>
              {" "}
              <li className="flex gap-3 border-t-3 border-border pt-4">
                <Glyph aria-hidden="true" className="size-7 shrink-0 text-primary" weight="bold" />{" "}
                <div>
                  <p className="font-heading font-black">{rule.title}</p>{" "}
                  <p className="mt-1 text-base text-foreground/75">{rule.body}</p>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>

      <section aria-labelledby="kinds-heading" className="mt-16">
        <h2 id="kinds-heading" className="font-heading text-2xl font-black sm:text-3xl">
          What you can get
        </h2>{" "}
        <KindGroup title="No account needed" ids={SUBSCRIBER_KINDS} />{" "}
        <KindGroup title="With an account" ids={ACCOUNT_KINDS} />
        <p className="mt-6 text-base text-foreground/75">
          Signed in? Everything sent to your address, alerts included, is in{" "}
          <Link
            href={NOTIFICATION_SETTINGS_PATH}
            className="font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            notification settings
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
