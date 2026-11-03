"use client";

import Link from "next/link";
import { useId } from "react";

import type { PlanReading } from "@/lib/db/planFigures";
import { behindLabel } from "@/lib/consular/scheduling";
import { shortDate } from "@convex/lib/months";

import { Field, FIELD } from "./CaseInputs";

/**
 * Through a consulate: the reader's post. NVC schedules the interview in the country of residence
 * (State, from Nov 1 2025), so the post is the reader's own pick, and its scheduling month from
 * State's table is shown beside it. It's context, never a wait: the plan's dates don't use it.
 */
export function ConsulateChoice({
  consulates,
  post,
  onPick,
}: {
  consulates: NonNullable<PlanReading["consulates"]>;
  post: string | null;
  onPick: (slug: string | null) => void;
}) {
  const id = useId();
  const picked = consulates.posts.find((p) => p.slug === post) ?? null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] sm:items-end [&>*]:min-w-0">
      <Field id={id} label="Your consulate" hint="Usually in the country where you live">
        <select id={id} value={picked?.slug ?? ""} onChange={(e) => onPick(e.target.value || null)} className={FIELD}>
          <option value="">Choose a consulate</option>
          {consulates.posts.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>{" "}
      <p role="status" className="text-base leading-relaxed">
        {picked ? (
          <>
            NVC is scheduling employment cases completed in{" "}
            <span className="font-bold">{picked.employment?.printed || "no month shown"}</span> at {picked.name} (
            {behindLabel(picked.employment, consulates.asOf).toLowerCase()}, State&apos;s update of {shortDate(consulates.asOf)}).
            That&apos;s NVC&apos;s paperwork queue. It doesn&apos;t date an interview.{" "}
            <Link href={`/consular-posts/${picked.slug}`} className="link">
              {picked.name}&apos;s page
            </Link>
          </>
        ) : (
          <span className="text-muted-foreground">Pick a consulate to see where State&apos;s table puts it.</span>
        )}
      </p>
    </div>
  );
}
