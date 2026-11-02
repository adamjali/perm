"use client";

import { useEffect, useId, useRef, useState } from "react";

import { formatShareOf } from "@/lib/format";
import { SOC_CODE_RE, socGroup } from "@/lib/socCode";
import type { CodeAnswer, TitleAnswer } from "@/lib/socFinder";
import { cn } from "@/lib/utils";

/**
 * A box that takes a SOC code or a job title and hands back a code: type "data scientist" and pick
 * 15-2051 from the codes employers filed it under (from /api/soc, the job code finder's reads), or
 * type the code itself. Every tool that asks for a job's code uses it, so they all find codes the
 * same way. An ARIA 1.2 combobox: arrows move, Enter picks, Escape closes.
 *
 * Given `suggestFrom` (the case form passes the position title), an empty box offers the codes employers
 * filed that title under as soon as it's focused, before anything is typed.
 */

export interface SocOption {
  soc: string;
  /** What the option says: the code's own name. */
  title: string;
  /** Why it's offered: the title it came from and its share, or "a 2010 code became this". */
  why: string;
}

interface Found {
  code: CodeAnswer | null;
  titles: TitleAnswer[];
  codes: CodeAnswer[];
}

const MIN = 2;
const WAIT_MS = 250;
const MAX_OPTIONS = 8;

/** The options a finder answer offers, best first, each code once. */
export function optionsFrom(found: Found): SocOption[] {
  const out: SocOption[] = [];
  const seen = new Set<string>();
  const add = (o: SocOption) => {
    if (seen.has(o.soc) || out.length >= MAX_OPTIONS) return;
    seen.add(o.soc);
    out.push(o);
  };
  if (found.code) {
    const became = found.code.became ?? [];
    if (found.code.known && !became.length) add({ soc: found.code.soc, title: found.code.title, why: "the code you typed" });
    for (const b of became) add({ soc: b.soc, title: b.title, why: `${found.code.soc} became this in 2018` });
  }
  for (const t of found.titles ?? []) {
    for (const c of t.codes.filter((x) => x.filings > 0 && !x.becameCodes.length).slice(0, 2)) {
      add({ soc: c.soc, title: c.codeTitle, why: `${t.title}: ${formatShareOf(c.filings, t.total)} of its filings` });
    }
    const onet = t.codes.find((x) => x.filings === 0);
    if (onet && !t.codes.some((x) => x.filings > 0)) add({ soc: onet.soc, title: onet.codeTitle, why: `${t.title}, by O*NET` });
  }
  for (const c of found.codes ?? []) add({ soc: c.soc, title: c.title, why: "BLS's name for the job" });
  return out;
}

export function SocPicker({
  id,
  name = "soc",
  value,
  onChange,
  onPick,
  suggestFrom,
  showPicked = true,
  className,
  placeholder = "Data scientist, or 15-2051",
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  id: string;
  name?: string;
  /** The box's text: a code once one is picked. */
  value: string;
  onChange: (value: string) => void;
  /** Called with the option picked, its code already in the seven-character form. */
  onPick?: (option: SocOption) => void;
  /** A job title whose codes an empty box offers on focus. */
  suggestFrom?: string;
  /** The picked code's name under the box; off where the page shows the code its own way. */
  showPicked?: boolean;
  className?: string;
  placeholder?: string;
  /** Set by FormField, which hands its hint and error to the box it wraps. */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const listId = useId();
  const [options, setOptions] = useState<SocOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<SocOption | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Leaving the box closes the list a moment later (so a click on an option lands first); coming back cancels it,
  // or a list a quick answer has just opened would be shut by the old timer.
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef("");

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (closing.current) clearTimeout(closing.current);
  }, []);

  function search(text: string) {
    const q = text.trim();
    if (q.length < MIN || q === asked.current) return;
    asked.current = q;
    fetch(`/api/soc?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Found>) : Promise.reject(new Error(String(r.status)))))
      .then((found) => {
        if (asked.current !== q) return;
        const next = optionsFrom(found);
        setFailed(false);
        setOptions(next);
        setActive(next.length ? 0 : -1);
        setOpen(true);
      })
      .catch(() => {
        if (asked.current !== q) return;
        setFailed(true);
        setOptions([]);
        setOpen(true);
        asked.current = "";
      });
  }

  function type(text: string) {
    onChange(text);
    setPicked(null);
    if (timer.current) clearTimeout(timer.current);
    if (SOC_CODE_RE.test(text.trim())) {
      // A whole code needs no list; still check it's one the finder knows.
      timer.current = setTimeout(() => search(text), WAIT_MS);
      return;
    }
    if (text.trim().length < MIN) {
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => search(text), WAIT_MS);
  }

  function pick(o: SocOption) {
    const chosen = { ...o, soc: socGroup(o.soc) ?? o.soc };
    onChange(chosen.soc);
    setPicked(chosen);
    setOpen(false);
    asked.current = chosen.soc;
    onPick?.(chosen);
  }

  /** On focus: reopen the last list, or, with the box empty, offer the codes for the title given. */
  function focus() {
    if (closing.current) clearTimeout(closing.current);
    if (!value.trim() && suggestFrom && suggestFrom.trim().length >= MIN) {
      if (asked.current === suggestFrom.trim() && options.length) setOpen(true);
      else search(suggestFrom);
      return;
    }
    if (options.length && !picked) setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
      // Enter picks the highlighted code instead of sending the form with a title in it.
      e.preventDefault();
      pick(options[active]!);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showList = open && (options.length > 0 || failed);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => type(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          closing.current = setTimeout(() => setOpen(false), 150);
        }}
        onFocus={focus}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className={className}
      />{" "}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="SOC codes"
          className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-y-auto border-2 border-border bg-card shadow-hard-sm"
        >
          {failed ? (
            <li role="option" aria-selected={false} aria-disabled="true" className="px-3 py-2 text-sm text-soft">
              The job codes couldn&apos;t be read just now. Type the code itself, or try again.
            </li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.soc}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5", i === active && "bg-sage")}
              >
                <span className="text-base font-semibold">
                  <span className="whitespace-nowrap font-mono">{o.soc}</span> {o.title}
                </span>{" "}
                <span className="text-sm text-soft">{o.why}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}{" "}
      {picked && showPicked ? (
        <p className="mt-1 text-sm text-soft" aria-live="polite">
          <span className="whitespace-nowrap font-mono">{picked.soc}</span> {picked.title}
        </p>
      ) : null}
    </div>
  );
}
