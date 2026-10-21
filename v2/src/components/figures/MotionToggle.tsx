"use client";

/**
 * The pause control every self-running figure carries. Motion that starts by itself and runs
 * past five seconds needs a way to stop it (WCAG 2.1 SC 2.2.2). Under reduced motion the figure
 * already holds still, so the control is hidden there. Dragging and scrolling still move a
 * paused figure: those are the reader's own actions.
 */

import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function MotionToggle({ paused, onToggle, what }: { paused: boolean; onToggle: () => void; what: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-label={paused ? `Play the ${what}` : `Pause the ${what}`}
      className="size-11 md:size-11 motion-reduce:hidden"
    >
      {paused ? <PlayIcon weight="bold" aria-hidden /> : <PauseIcon weight="bold" aria-hidden />}
    </Button>
  );
}
