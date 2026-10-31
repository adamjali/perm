"use client";

import { useState } from "react";
import { CircleNotchIcon } from "@phosphor-icons/react";

import { ReviewCard, type ReviewCardData } from "@/components/reviews/ReviewCard";
import { buttonVariants } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { cardDay } from "@/lib/reviews/cardDay";

/**
 * "Show older reviews": the way past the newest reviews the page was built with, a hundred at a time from
 * `/api/reviews/older`, however many there are. Shown only when the page holds fewer reviews than the count. A
 * failed load says so and keeps the button; it never reads as "no older reviews".
 */
export function OlderReviews({ before: firstBefore }: { before: number }) {
  const [shown, setShown] = useState<ReviewCardData[]>([]);
  const [before, setBefore] = useState(firstBefore);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/reviews/older?before=${before}`);
      const body = (await res.json().catch(() => null)) as {
        reviews?: { id: string; rating: number; text: string; name: string; createdAt: number; viaAlert?: boolean }[];
        more?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.reviews) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const page = body.reviews;
      setShown((s) => [
        ...s,
        ...page.map((r) => ({ id: r.id, rating: r.rating, text: r.text, name: r.name, day: cardDay(new Date(r.createdAt).toISOString(), r.viaAlert), viaAlert: r.viaAlert })),
      ]);
      if (page.length) setBefore(page[page.length - 1]!.createdAt);
      setMore(body.more === true && page.length > 0);
    } catch (error) {
      console.warn("[reviews] older reviews failed:", String(error));
      analytics.capture("reviews_older_failed", {});
      setProblem("Older reviews couldn't be loaded just now. Please try again in a minute.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8">
      {shown.length ? (
        <ul aria-label="Older reviews" className="grid grid-cols-1 gap-5 sm:grid-cols-2 [&>*]:min-w-0">
          {shown.map((r) => (
            <li key={r.id} className="flex">
              <ReviewCard review={r} compact lines={6} className="w-full" />
            </li>
          ))}
        </ul>
      ) : null}{" "}
      <p role="status" className="mt-4 text-center text-base font-bold">
        {problem ?? (!more ? "That's every review." : "")}
      </p>{" "}
      {more ? (
        <div className="mt-2 flex justify-center">
          <button type="button" onClick={load} disabled={loading} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "text-base")}>
            {loading ? <CircleNotchIcon className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : null}
            {loading ? "Loading" : "Show older reviews"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
