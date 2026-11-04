"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterOptions, nextActive, type ComboboxOption } from "@/lib/comboboxFilter";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export type { ComboboxOption };

/** Rows drawn at once. Past this a long match says so and asks for more letters. */
const DEFAULT_LIMIT = 300;

/**
 * A choice from a long list you can type into: occupations, law firms,
 * consulates, countries. A native select of 250 names is a scroll nobody
 * finishes, and the filters that used one cut the list at 250 without saying
 * so. This shows every option, finds one by any word in it, and says how many
 * of how many it's showing.
 *
 * The list opens in a layer of its own (a Radix popover in a portal), so it
 * flips above the box when there's no room below and can't be clipped by a
 * fixed-height embed or a scrolling panel. Keys: arrows, Home and End, Page Up
 * and Page Down move; Enter picks; Escape closes and puts focus back on the box.
 * Typing a letter on the closed box opens it with that letter searched.
 *
 * Forms keep working: `onChange` gets the value, and with a `name` a hidden
 * input carries it, so a plain GET form still sends the field.
 */
export function FilterCombobox({
  id,
  value,
  onChange,
  options,
  noun,
  emptyLabel,
  placeholder = "Choose one",
  name,
  form,
  className,
  disabled,
  limit = DEFAULT_LIMIT,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  /** The box's id, so a `<label htmlFor>` names it. */
  id: string;
  /** The chosen value, "" for none. */
  value: string;
  onChange: (value: string) => void;
  options: readonly ComboboxOption[];
  /** What the rows are, plural, for the search box's name and the count: "occupations". */
  noun: string;
  /** A first row that clears the choice ("Any (340)"). Without it there's no empty choice. */
  emptyLabel?: string;
  /** What the box says with nothing chosen, when there's no empty row to name. */
  placeholder?: string;
  /** Sends the value with a form, through a hidden input. */
  name?: string;
  form?: string;
  className?: string;
  disabled?: boolean;
  limit?: number;
  /** For a box with no `<label>` of its own. The chosen option is still read as its value. */
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => filterOptions(options, query), [options, query]);
  const shown = matches.length > limit ? matches.slice(0, limit) : matches;
  // The empty row stays first whatever is typed, so a choice can always be cleared.
  const rows: ComboboxOption[] = emptyLabel !== undefined ? [{ value: "", label: emptyLabel }, ...shown] : shown;

  const chosen = options.find((o) => o.value === value);
  // A value the list doesn't hold (an old link, a filter the loaded rows no longer carry) still shows as itself.
  const showing = value ? (chosen?.label ?? value) : (emptyLabel ?? placeholder);

  const optionId = (i: number) => `${listId}-o${i}`;

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId only joins listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  /**
   * The row to highlight for a search: the first match while typing, the chosen
   * row when the list opens. -1 when there's nothing to highlight.
   */
  function startRow(text: string): number {
    const offset = emptyLabel !== undefined ? 1 : 0;
    const list = filterOptions(options, text);
    if (text.trim()) return list.length ? offset : -1;
    if (!value) return offset || list.length ? 0 : -1;
    const at = list.findIndex((o) => o.value === value);
    return at >= 0 ? at + offset : offset || list.length ? 0 : -1;
  }

  function openWith(text: string) {
    setQuery(text);
    setActive(startRow(text));
    setOpen(true);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const to = nextActive(e.key, active, rows.length);
    if (to !== null) {
      e.preventDefault();
      setActive(to);
      return;
    }
    if (e.key === "Enter") {
      // Enter picks the highlighted row; it never sends a form with a search in it.
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row.value);
    }
  }

  function onTriggerKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (open || disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openWith("");
    } else if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      openWith(e.key);
    }
  }

  const counted = query.trim()
    ? matches.length > shown.length
      ? `The first ${formatInt(shown.length)} of ${formatInt(matches.length)} matches. Type more to narrow them.`
      : `${formatInt(matches.length)} of ${formatInt(options.length)} ${noun}`
    : matches.length > shown.length
      ? `The first ${formatInt(shown.length)} of ${formatInt(options.length)} ${noun}. Type to find the rest.`
      : `${formatInt(options.length)} ${noun}`;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) openWith("");
          else {
            setOpen(false);
            setQuery("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            disabled={disabled}
            onKeyDown={onTriggerKey}
            className={cn(
              "flex w-full min-w-0 min-h-11 items-center justify-between gap-2 border-2 border-input bg-card px-3 py-2 text-left text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:text-muted-foreground",
              className,
              // The chosen name shows whole, wrapping, never cut at the caret.
              "h-auto text-left",
            )}
          >
            <span className={cn("min-w-0 break-words", !value && !emptyLabel && "text-muted-foreground")}>{showing}</span>{" "}
            <CaretDownIcon aria-hidden="true" weight="bold" className="size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchRef.current?.focus();
          }}
          className="w-[var(--radix-popover-trigger-width)] min-w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] border-2 border-foreground p-0"
        >
          <input
            ref={searchRef}
            type="text"
            role="combobox"
            aria-label={`Find ${noun}`}
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={active >= 0 && rows[active] ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            placeholder={`Type to find ${noun}`}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(startRow(e.target.value));
            }}
            onKeyDown={onSearchKey}
            className="block min-h-11 w-full border-b-2 border-border bg-card px-3 text-base outline-none focus-visible:bg-tint"
          />{" "}
          <p role="status" aria-live="polite" className="px-3 pt-1.5 pb-1 text-sm text-soft">
            {counted}
          </p>{" "}
          <ul
            id={listId}
            role="listbox"
            aria-label={noun}
            className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height,24rem)-6rem))] overflow-y-auto overscroll-contain pb-1"
          >
            {rows.map((o, i) => {
              const isChosen = o.value === value;
              return (
                <li
                  key={o.value === "" ? "\u0000empty" : o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    // Keep focus in the search box so the pick lands before anything blurs.
                    e.preventDefault();
                    pick(o.value);
                  }}
                  onMouseMove={() => {
                    if (i !== active) setActive(i);
                  }}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-base",
                    i === active && "bg-sage",
                    isChosen && "font-bold",
                  )}
                >
                  <CheckIcon
                    aria-hidden="true"
                    weight="bold"
                    className={cn("size-4 shrink-0", isChosen ? "text-primary-text" : "invisible")}
                  />{" "}
                  <span className="min-w-0 break-words">
                    {o.label}
                    {isChosen ? <span className="sr-only"> (chosen)</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>{" "}
          {matches.length === 0 ? (
            <p className="px-3 pb-2 text-sm text-soft">No {noun} match that. Try fewer letters.</p>
          ) : null}
        </PopoverContent>
      </Popover>
      {name ? <input type="hidden" name={name} value={value} form={form} /> : null}
    </>
  );
}
