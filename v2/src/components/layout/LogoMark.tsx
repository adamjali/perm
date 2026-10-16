"use client";

import { useLinkStatus } from "next/link";
import { CircleNotchIcon, FileTextIcon } from "@phosphor-icons/react";

/**
 * The logo's mark, inside the logo's `<Link>` (it reads `useLinkStatus`).
 * While the page it opens loads, the mark becomes a spinner the same size, so
 * nothing beside it moves (owner, Oct 15 2026: a rule under the logo read as
 * a stray underline). Pointed at, the mark tips. Reduced motion holds both still.
 */
export function LogoMark() {
  const { pending } = useLinkStatus();
  return pending ? (
    <CircleNotchIcon
      aria-label="Loading"
      weight="bold"
      className="size-6 shrink-0 animate-spin text-primary-text motion-reduce:animate-none"
    />
  ) : (
    <FileTextIcon
      aria-hidden="true"
      className="size-6 shrink-0 text-primary-text transition-transform duration-200 ease-out motion-safe:group-hover/logo:-rotate-12 motion-safe:group-hover/logo:scale-110"
    />
  );
}
