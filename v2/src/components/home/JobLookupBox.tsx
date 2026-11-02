"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SocPicker } from "@/components/soc/SocPicker";

/**
 * The homepage's job box: type a title, pick a code, and the job code finder opens on it. Without script the
 * form still works, as a plain GET to /soc-codes?q=.
 */
export function JobLookupBox() {
  const router = useRouter();
  const [text, setText] = useState("");
  return (
    <form action="/soc-codes" method="get" className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <label htmlFor="home-job" className="sr-only">
          A job title or SOC code
        </label>
        <SocPicker
          id="home-job"
          name="q"
          value={text}
          onChange={setText}
          onPick={(o) => router.push(`/soc-codes?q=${encodeURIComponent(o.soc)}`)}
          placeholder="Accountant, or 15-1252"
          className="flex h-12 w-full min-w-0 border-2 border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>{" "}
      <button type="submit" className="inline-flex h-12 shrink-0 items-center justify-center border-2 border-border bg-card px-5 font-semibold hover:bg-muted">
        Find the code
      </button>
    </form>
  );
}
