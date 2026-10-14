"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import type { EntityRow } from "@/lib/entityPayload";
import { DidYouMean, useNameSuggestions } from "@/components/search/DidYouMean";
import { searchEntities } from "@/lib/fetchEntities";

/**
 * Two employer pickers and a Compare button. Each box searches the entity
 * index by name (the same route the employer list uses) and a chosen row
 * becomes a slug in the URL, so a comparison is a link that can be sent.
 */

interface Chosen {
  slug: string;
  name: string;
}

function Picker({
  label,
  initial,
  onChoose,
}: {
  label: string;
  initial: Chosen | null;
  onChoose: (c: Chosen | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(initial?.name ?? "");
  const [hits, setHits] = useState<EntityRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<Chosen | null>(initial);
  const [searchedFor, setSearchedFor] = useState("");

  useEffect(() => {
    if (chosen && text === chosen.name) return;
    const q = text.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const { rows } = await searchEntities("employer", q, { onlyLive: false });
        setHits(rows.slice(0, 8));
        setSearchedFor(q);
      } catch {
        setHits([]);
        setSearchedFor("");
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [text, chosen]);

  // Nothing published under that spelling: the closest published sponsors,
  // the only ones the comparison can draw.
  const { suggestions } = useNameSuggestions(
    "employer",
    text,
    !chosen && !busy && hits.length === 0 && searchedFor !== "" && searchedFor === text.trim() && text.trim().length >= 3,
  );
  const pick = (c: Chosen) => {
    setChosen(c);
    setText(c.name);
    setHits([]);
    onChoose(c);
  };

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-bold text-soft">
        {label}
      </label>{" "}
      <input
        id={id}
        value={text}
        autoComplete="off"
        placeholder="Start typing an employer"
        onChange={(e) => {
          setText(e.target.value);
          setChosen(null);
          onChoose(null);
        }}
        className="mt-1.5 min-h-11 w-full min-w-0 border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />{" "}
      {busy ? <p className="mt-2 text-sm text-muted-foreground">Searching…</p> : null}{" "}
      {!chosen && hits.length > 0 ? (
        <ul className="mt-2 border border-border bg-card">
          {hits.map((h) => (
            <li key={h.slug}>
              <button
                type="button"
                onClick={() => pick({ slug: h.slug, name: h.name })}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-tint-primary"
              >
                <span className="font-semibold">{h.name}</span>{" "}
                <span className="shrink-0 font-mono text-sm text-muted-foreground">
                  {h.total.toLocaleString("en-US")} filings{h.state ? ` · ${h.state}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}{" "}
      <DidYouMean
        className="mt-3 text-sm"
        suggestions={suggestions
          .filter((s) => s.published)
          .map((s) => ({
            label: s.name,
            note: `${s.cases.toLocaleString("en-US")} filings`,
            onPick: () => pick({ slug: s.href.slice(s.href.lastIndexOf("/") + 1), name: s.name }),
          }))}
      />
    </div>
  );
}

export function EmployerComparePicker({ a, b }: { a: Chosen | null; b: Chosen | null }) {
  const router = useRouter();
  const [left, setLeft] = useState<Chosen | null>(a);
  const [right, setRight] = useState<Chosen | null>(b);
  const ready = Boolean(left && right && left.slug !== right.slug);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || !left || !right) return;
        router.push(`/perm-employers/compare?a=${encodeURIComponent(left.slug)}&b=${encodeURIComponent(right.slug)}`);
      }}
      className="grid grid-cols-1 gap-5 border border-border bg-card p-5 [&>*]:min-w-0 sm:grid-cols-2 sm:p-6"
    >
      <Picker label="First employer" initial={a} onChoose={setLeft} />{" "}
      <Picker label="Second employer" initial={b} onChoose={setRight} />{" "}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={!ready}
          className="flex min-h-11 items-center border border-border bg-primary px-5 font-heading text-sm font-bold text-black transition-transform disabled:opacity-60 motion-reduce:transition-none"
        >
          Compare
        </button>
      </div>
    </form>
  );
}
