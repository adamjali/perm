"use client";

import { EnvelopeSimpleIcon, RobotIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { cn } from "@/lib/utils";

interface ValuePreviewStepProps {
  onNext: () => void;
}

/**
 * What the app does next, shown as the things it produces (a deadline, a
 * reminder, a calendar day, an answer) in miniature, each with one line.
 */
export function ValuePreviewStep({ onNext }: ValuePreviewStepProps) {
  const eta = STAGE_VISUALS.eta9089;
  return (
    <div className="flex flex-col items-center px-2">
      <h2 className="mb-1 text-center font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Here&apos;s what happens next
      </h2>{" "}
      <p className="mb-6 text-center text-sm text-muted-foreground">Your case is in. From here it runs itself.</p>

      <ul className="mb-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <Preview caption="Every deadline worked out">
          <div className="flex items-center justify-between gap-3 border-2 border-border bg-card px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate font-heading text-sm font-bold">Acme Technology Inc.</span>{" "}
              <span className="block truncate text-sm text-muted-foreground">9089 window opens</span>
            </span>{" "}
            <span className="shrink-0 font-mono text-lg font-bold text-data-warn-ink">24d</span>
          </div>
        </Preview>

        <Preview caption="A reminder before each one">
          <div className="flex items-center gap-3 border-2 border-border bg-card px-3 py-2">
            <span className="grid size-9 shrink-0 place-items-center border-2 border-border bg-primary text-primary-foreground">
              <EnvelopeSimpleIcon className="size-5" weight="bold" aria-hidden="true" />
            </span>{" "}
            <span className="min-w-0">
              <span className="block truncate font-heading text-sm font-bold">7 days left</span>{" "}
              <span className="block truncate text-sm text-muted-foreground">Filing window closes Feb 15</span>
            </span>
          </div>
        </Preview>

        <Preview caption="On your calendar">
          <div className="flex items-stretch gap-3">
            <span className="flex w-14 shrink-0 flex-col items-center border-2 border-border bg-card">
              <span className="w-full bg-foreground py-0.5 text-center font-mono text-sm font-bold text-background">Oct</span>{" "}
              <span className="py-1 font-heading text-2xl font-black leading-none">22</span>
            </span>{" "}
            <span className={cn("flex flex-1 items-center border-2 border-border px-3 font-heading text-sm font-bold", eta.fill, eta.onFill)}>
              Filing window opens
            </span>
          </div>
        </Preview>

        <Preview caption="Ask about any case">
          <div className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] border-2 border-border bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              When does my window close?
            </p>{" "}
            <p className="flex w-fit max-w-[90%] items-start gap-2 border-2 border-border bg-card px-3 py-1.5 text-sm">
              <RobotIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Feb 15, 2027, 140 days from today.
            </p>
          </div>
        </Preview>
      </ul>

      <Button onClick={onNext} size="lg" className="w-full max-w-sm">
        Continue
      </Button>
    </div>
  );
}

function Preview({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 border-2 border-border bg-muted/40 p-3 shadow-hard-sm">
      <div aria-hidden="true" className="flex flex-1 flex-col justify-center">{children}</div>
      <p className="font-heading text-sm font-bold">{caption}</p>
    </li>
  );
}
