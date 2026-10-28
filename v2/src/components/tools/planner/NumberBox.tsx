"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { FIELD } from "./CaseInputs";

/**
 * A number the reader types, kept as typed while they type ("3." stays "3.") and handed on
 * only when it reads as a number in range. Empty hands on null: back to today's figure.
 */
export function NumberBox({
  id,
  label,
  value,
  placeholder,
  onChange,
  min = 0,
  max,
  step = "any",
  prefix,
  labelClassName,
}: {
  id: string;
  label: string;
  value: number | null;
  placeholder?: string;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  /** Drawn inside the box before the number: "$". */
  prefix?: string;
  labelClassName?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));
  return (
    <div>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>{" "}
      <div className={cn(FIELD, "flex items-center gap-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary")}>
        {prefix ? (
          <span aria-hidden="true" className="text-soft">
            {prefix}
          </span>
        ) : null}{" "}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={shown}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            if (raw === "") return onChange(null);
            const n = Number(raw);
            if (Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n);
          }}
          onBlur={() => setDraft(null)}
          className="-my-0.5 min-h-11 w-full min-w-0 bg-transparent tabular-nums outline-none"
        />
      </div>
    </div>
  );
}
