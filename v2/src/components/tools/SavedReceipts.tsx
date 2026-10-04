"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";

import { normaliseReceipt } from "@/lib/uscis/receipt";

/**
 * A short list of receipt numbers, kept in this browser only.
 *
 * A family often has three or four I-797s in flight (the I-140, an I-485 each,
 * the EAD and travel cards). This keeps their numbers one click away without
 * an account: the list lives in localStorage, never leaves the device, and
 * this site never sees it. Storage can be blocked or empty (a private window,
 * cleared site data), so every read and write is guarded and the page works
 * the same without it.
 */

export const STORAGE_KEY = "pt.uscisReceipts.v1";
export const MAX_SAVED = 12;

export interface SavedReceipt {
  receipt: string;
  /** What the visitor called it ("Mum's EAD"); optional, at most 40 characters. */
  label: string;
}

export function readSaved(): SavedReceipt[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const out: SavedReceipt[] = [];
    for (const item of parsed) {
      const receipt = normaliseReceipt(String((item as { receipt?: unknown })?.receipt ?? ""));
      if (receipt && !out.some((s) => s.receipt === receipt)) {
        out.push({ receipt, label: String((item as { label?: unknown })?.label ?? "").slice(0, 40) });
      }
    }
    return out.slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function write(list: SavedReceipt[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

const LINK = "font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";
const BUTTON =
  "min-h-[44px] border-2 border-border bg-background px-3 font-mono text-sm font-bold uppercase tracking-[0.08em] hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

export function SavedReceipts({ current }: { current: string | null }) {
  const [list, setList] = useState<SavedReceipt[] | null>(null);
  const [label, setLabel] = useState("");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setList(readSaved());
  }, []);

  if (list === null) return null;
  const receipt = current ? normaliseReceipt(current) : null;
  const canSave = receipt !== null && !list.some((s) => s.receipt === receipt);
  if (list.length === 0 && !canSave) return null;

  const update = (next: SavedReceipt[]) => {
    setBlocked(!write(next));
    setList(next);
  };

  return (
    <section className="mt-6 border-2 border-border bg-card p-5 sm:p-6" aria-labelledby="saved-receipts">
      <h2 id="saved-receipts" className="font-heading text-lg font-black">
        Your receipt numbers
      </h2>{" "}
      <p className="mt-1 text-sm text-foreground/70">
        Kept in this browser only. This site never sees the list, and clearing the browser&apos;s site data
        removes it.
      </p>
      {list.length ? (
        <ul className="mt-3 divide-y divide-border/60">
          {list.map((s) => (
            <Fragment key={s.receipt}>
              {" "}
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <Link href={`/uscis-case-status?receipt=${encodeURIComponent(s.receipt)}`} className={LINK}>
                  {s.receipt}
                </Link>{" "}
                {s.label ? <span className="text-base text-foreground/80">{s.label}</span> : null}{" "}
                <button
                  type="button"
                  onClick={() => update(list.filter((x) => x.receipt !== s.receipt))}
                  className={`ml-auto ${BUTTON}`}
                  aria-label={`Remove ${s.receipt}`}
                >
                  Remove
                </button>
              </li>
            </Fragment>
          ))}
        </ul>
      ) : null}{" "}
      {canSave && receipt ? (
        <form
          className="mt-3 flex flex-wrap items-stretch gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update([{ receipt, label: label.trim().slice(0, 40) }, ...list].slice(0, MAX_SAVED));
            setLabel("");
          }}
        >
          <label className="sr-only" htmlFor="saved-receipt-label">
            A name for {receipt}, optional
          </label>
          <input
            id="saved-receipt-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder="A name, optional"
            className="min-h-[44px] min-w-0 flex-1 basis-48 border-2 border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary"
          />{" "}
          <button type="submit" className={BUTTON}>
            Save {receipt}
          </button>
        </form>
      ) : null}{" "}
      {list.length >= MAX_SAVED ? (
        <p className="mt-2 text-sm text-foreground/70">
          The list keeps {MAX_SAVED}; saving another drops the oldest.
        </p>
      ) : null}{" "}
      {blocked ? (
        <p role="status" className="mt-2 text-sm font-bold text-data-warn-ink">
          This browser isn&apos;t letting the page save, so the list will be gone when you leave.
        </p>
      ) : null}
    </section>
  );
}
