"use client";

import { useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";

import { OnetCredit } from "@/components/reference/OnetCredit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSocProfile } from "@/hooks/useSocProfile";
import { buildSocDescription, placeDescription, SHOWN_TASKS, type PlaceHow, type SocProfile } from "@/lib/socProfile";
import { toast } from "@/lib/toast";

/**
 * A job description to start from, drawn from the case's SOC code (Sabrina, Nov 1 2026: "for job description
 * suggest the description and they choose if they want it or no", "based on SOC code"). O*NET's description
 * of the job and its core tasks, the first SHOWN_TASKS ticked and the rest folded, unticked, so nothing goes in
 * unseen. The person keeps the tasks that fit and adds them, or puts them in place of what's there, which asks
 * first. Either way Undo puts the old words back, and the text is ordinary text to edit afterwards.
 *
 * Nothing about requirements is written: the employer's minimum requirements are its own. The Job Zone shows
 * beside the text as information only. "Not now" folds the panel to one line; it starts folded whenever the
 * case already has a description.
 */
export function SocDescriptionSuggestion({
  socCode,
  description,
  onDescriptionChange,
  disabled = false,
}: {
  socCode: string | null | undefined;
  description: string;
  onDescriptionChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { data } = useSocProfile(socCode);
  if (!data || (!data.description && !data.tasks.length)) return null;
  // A new code is a new suggestion: the key resets what was ticked and whether it's open.
  return (
    <Suggestion
      key={data.soc}
      profile={data}
      description={description}
      onDescriptionChange={onDescriptionChange}
      disabled={disabled}
    />
  );
}

function Suggestion({
  profile,
  description,
  onDescriptionChange,
  disabled,
}: {
  profile: SocProfile;
  description: string;
  onDescriptionChange: (value: string) => void;
  disabled: boolean;
}) {
  const hasWords = Boolean(description.trim());
  const [open, setOpen] = useState(!hasWords);
  // The tasks on show start ticked; any past SHOWN_TASKS wait folded and unticked, so nothing goes in unseen.
  const [picked, setPicked] = useState<boolean[]>(() => profile.tasks.map((_, i) => i < SHOWN_TASKS));
  const [allTasks, setAllTasks] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const chosen = profile.tasks.filter((_, i) => picked[i]);
  const text = buildSocDescription(profile.description, chosen);
  const label = `SOC ${profile.soc}, ${profile.title}`;
  const tasksShown = allTasks ? profile.tasks : profile.tasks.slice(0, SHOWN_TASKS);
  const moreTasks = profile.tasks.length - SHOWN_TASKS;

  function place(how: PlaceHow) {
    const before = description;
    onDescriptionChange(placeDescription(before, text, how));
    setOpen(false);
    toast.success(how === "replace" && before.trim() ? `Description replaced from ${label}` : `Description added from ${label}`, {
      action: { label: "Undo", onClick: () => onDescriptionChange(before) },
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-text hover:underline disabled:opacity-50"
      >
        Show the description from SOC {profile.soc}
        <CaretDownIcon className="size-4 shrink-0" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section aria-label={`Suggested description from ${label}`} className="space-y-3 border-l-2 border-primary pl-4">
      <h3 className="text-sm font-semibold">Suggested from {label}</h3>{" "}
      {profile.description ? <p className="text-base leading-relaxed">{profile.description}</p> : null}{" "}
      {profile.tasks.length ? (
        <fieldset>
          <legend className="text-sm text-soft">Tasks to include, most important first</legend>{" "}
          <ul className="mt-1">
            {tasksShown.map((task) => {
              const i = profile.tasks.indexOf(task);
              return (
                <li key={task}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-base leading-snug">
                    <Checkbox
                      className="mt-0.5"
                      checked={picked[i] ?? false}
                      onCheckedChange={(v) => setPicked((p) => p.map((x, j) => (j === i ? v === true : x)))}
                      disabled={disabled}
                    />{" "}
                    <span>{task}</span>
                  </label>
                </li>
              );
            })}
          </ul>{" "}
          {moreTasks > 0 && !allTasks ? (
            <button type="button" onClick={() => setAllTasks(true)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text hover:underline">
              {moreTasks} more {moreTasks === 1 ? "task" : "tasks"}
              <CaretDownIcon className="size-4 shrink-0" aria-hidden="true" />
            </button>
          ) : null}
        </fieldset>
      ) : null}{" "}
      <p className="text-sm leading-relaxed text-soft">
        A starting point. The filing states the employer&apos;s own duties and minimum requirements.
        {profile.zoneLabel ? ` O*NET puts this job in Job Zone ${profile.zoneLabel}${profile.zoneName ? `: ${profile.zoneName.toLowerCase()}` : ""}.` : ""}
      </p>{" "}
      <div className="flex flex-wrap items-center gap-2">
        {hasWords ? (
          <>
            <Button type="button" onClick={() => place("append")} disabled={disabled || !text}>
              Add to the end
            </Button>{" "}
            <Button type="button" variant="outline" onClick={() => setConfirmReplace(true)} disabled={disabled || !text}>
              Replace the description
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => place("append")} disabled={disabled || !text}>
            Use this description
          </Button>
        )}{" "}
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>{" "}
      <OnetCredit compact version={profile.onetVersion} note="offered as a starting job description" />
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the job description?</AlertDialogTitle>
            <AlertDialogDescription>
              The words in the description now give way to the suggestion. Undo puts them back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep mine</AlertDialogCancel>
            <AlertDialogAction onClick={() => place("replace")}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
