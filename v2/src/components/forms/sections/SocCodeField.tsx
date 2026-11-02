"use client";

import { useEffect, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { SocProfileState } from "@/components/soc/SocCodeSummary";
import { SocPicker } from "@/components/soc/SocPicker";
import { useSocProfile } from "@/hooks/useSocProfile";
import { isSocCode, socGroup } from "@/lib/socCode";

/**
 * The case's SOC code, under its position title (Sabrina, Nov 1 2026: "where we have job position, we can
 * have other entry for SOC code"). Focused while empty it offers the codes employers filed the position
 * title under in DOL's files; a code typed whole works too. The case stores the seven-character code and its
 * title; text that isn't a code yet stores nothing, and the field says so.
 *
 * Under it, the code's brief (`SocCodeBrief`): the job's median offered wage, how often DOL certifies it and
 * how other employers title it, with a link to the code's own page.
 */
export function SocCodeField({
  positionTitle,
  socCode,
  socTitle,
  error,
  onChange,
}: {
  positionTitle: string;
  socCode: string | undefined;
  socTitle: string | undefined;
  error?: string;
  onChange: (field: "socCode" | "socTitle", value: string) => void;
}) {
  const stored = socCode ?? "";
  // The box's own text: a code, or words being typed that aren't one yet.
  const [text, setText] = useState(stored);
  const [seen, setSeen] = useState(stored);
  if (stored !== seen) {
    // The stored code changed from outside the box (an import, a reset): show it.
    setSeen(stored);
    if (socGroup(text) !== socGroup(stored)) setText(stored);
  }
  const profile = useSocProfile(stored);

  // A code typed whole gets its title from the profile once that loads.
  const loadedTitle = profile.data && profile.data.soc === socGroup(stored) ? profile.data.title : null;
  useEffect(() => {
    if (loadedTitle && loadedTitle !== socTitle) onChange("socTitle", loadedTitle);
  }, [loadedTitle, socTitle, onChange]);

  function type(next: string) {
    setText(next);
    const code = isSocCode(next) ? socGroup(next) : null;
    if (code) {
      if (code !== stored) {
        onChange("socCode", code);
        onChange("socTitle", "");
      }
    } else if (stored) {
      onChange("socCode", "");
      onChange("socTitle", "");
    }
  }

  const pending = Boolean(text.trim()) && !isSocCode(text);
  return (
    <div className="space-y-3 md:col-span-2">
      <FormField
        label="SOC code"
        name="socCode"
        error={error}
        hint={
          pending
            ? "Pick a code from the list, or type one such as 15-1252. Words alone aren't saved."
            : "Type the code, or pick from the codes employers filed this position title under."
        }
      >
        <SocPicker
          id="socCode"
          name="socCode"
          value={text}
          onChange={type}
          onPick={(o) => {
            setText(o.soc);
            onChange("socCode", o.soc);
            onChange("socTitle", o.title);
          }}
          suggestFrom={positionTitle}
          showPicked={false}
          placeholder={positionTitle.trim() ? `Codes for ${positionTitle.trim()}, or 15-1252` : "Software developers, or 15-1252"}
          className="flex h-11 w-full min-w-0 border-2 border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </FormField>{" "}
      {stored ? <SocProfileState result={profile} brief /> : null}
    </div>
  );
}
