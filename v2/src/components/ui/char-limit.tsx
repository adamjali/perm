"use client";

/**
 * Says so when a text field nears or reaches its character limit.
 *
 * A `maxLength` on its own is silent: typing just stops, and a paste longer
 * than the room left is cut without a word. Wrap the field:
 *
 *   <CharLimit max={2000}>
 *     <Textarea value={text} onChange={...} />
 *   </CharLimit>
 *
 * The wrapper sets `maxLength` on the field, reads its length from the field's
 * own `value` (or tracks it when the field is uncontrolled), and renders a line
 * under it that:
 *   - stays empty below 80% of the limit;
 *   - counts "N of M characters" from 80%;
 *   - says the field is full at the limit;
 *   - says a paste was cut, and where, when one was.
 * The line is a polite live region linked to the field, so a screen reader
 * hears it too.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

/** The share of the limit at which the count appears. */
export const CHAR_LIMIT_SHOW_AT = 0.8;

/** The line under the field, or null when it has nothing to say yet. */
export function charLimitMessage(length: number, max: number, pasteCut: boolean): string | null {
  if (pasteCut && length >= max) {
    return `Your paste was cut at ${formatInt(max)} characters, the most this field holds.`;
  }
  if (length >= max) {
    return `${formatInt(length)} of ${formatInt(max)} characters. That's the most this field holds.`;
  }
  if (length >= Math.ceil(max * CHAR_LIMIT_SHOW_AT)) {
    return `${formatInt(length)} of ${formatInt(max)} characters`;
  }
  return null;
}

type FieldEl = HTMLInputElement | HTMLTextAreaElement;
type FieldProps = {
  value?: unknown;
  defaultValue?: unknown;
  onPaste?: React.ClipboardEventHandler<FieldEl>;
  onInput?: React.FormEventHandler<FieldEl>;
  "aria-describedby"?: string;
  maxLength?: number;
};

/**
 * The same behaviour for a field whose line has to sit somewhere the wrapper
 * can't put it (a field inside a flex row with its send button, say): spread
 * `fieldProps` on the field and render `<CharLimitNote {...limit} />` where
 * the line belongs.
 */
export function useCharLimit(max: number, value: string) {
  const id = React.useId();
  const [pasteCut, setPasteCut] = React.useState(false);
  const message = charLimitMessage(value.length, max, pasteCut);
  const onPaste: React.ClipboardEventHandler<FieldEl> = (e) => {
    const el = e.currentTarget;
    const pasted = e.clipboardData?.getData("text") ?? "";
    const selected = (el.selectionEnd ?? el.value.length) - (el.selectionStart ?? el.value.length);
    setPasteCut(el.value.length - Math.max(0, selected) + pasted.length > max);
  };
  return {
    id,
    message,
    full: value.length >= max,
    fieldProps: {
      maxLength: max,
      onPaste,
      "aria-describedby": message ? id : undefined,
    },
  };
}

/** The line itself; a polite live region, empty (and hidden) until it has something to say. */
export function CharLimitNote({
  id,
  message,
  full,
  className,
}: {
  id: string;
  message: string | null;
  full: boolean;
  className?: string;
}) {
  return (
    <p
      id={id}
      aria-live="polite"
      data-char-limit=""
      className={cn(
        "text-sm tabular-nums",
        message ? "mt-1" : "sr-only",
        full ? "font-semibold text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {message}
    </p>
  );
}

export function CharLimit({
  max,
  children,
  className,
  ...aria
}: {
  max: number;
  children: React.ReactElement<FieldProps>;
  className?: string;
} & React.AriaAttributes) {
  // A parent that clones its child to add aria attributes (FormField does)
  // reaches this wrapper, not the field, so they are passed on to the field.
  const child = React.Children.only(children);
  const controlled = typeof child.props.value === "string";
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    typeof child.props.defaultValue === "string" ? child.props.defaultValue : ""
  );
  const limit = useCharLimit(max, controlled ? (child.props.value as string) : uncontrolledValue);

  const onPaste: React.ClipboardEventHandler<FieldEl> = (e) => {
    child.props.onPaste?.(e);
    limit.fieldProps.onPaste(e);
  };
  const onInput: React.FormEventHandler<FieldEl> = (e) => {
    child.props.onInput?.(e);
    if (!controlled) setUncontrolledValue(e.currentTarget.value);
  };

  const describedBy = [
    aria["aria-describedby"],
    child.props["aria-describedby"],
    limit.fieldProps["aria-describedby"],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {React.cloneElement(child, {
        ...aria,
        maxLength: max,
        onPaste,
        onInput,
        "aria-describedby": describedBy || undefined,
      })}
      <CharLimitNote id={limit.id} message={limit.message} full={limit.full} className={className} />
    </>
  );
}
