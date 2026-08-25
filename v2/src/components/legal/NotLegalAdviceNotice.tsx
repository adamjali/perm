/**
 * NotLegalAdviceNotice
 *
 * A quiet, persistent "not legal advice / not a law firm" footnote.
 * Designed to read as an understated, reassuring footnote, muted secondary
 * text with a small info icon, not an alarming warning banner.
 *
 * Two contexts via the `variant` prop:
 *  - "chat":     compact single line for the AI assistant surface (narrow panel).
 *  - "deadline": full-width footnote for calculated PERM dates/deadlines.
 *
 * Neobrutalist tokens: muted-foreground text, hard top border separator,
 * font-mono on the deadline variant to match adjacent metadata rows.
 * Animation (when enabled) uses the project's snappy springConfig and is
 * gated on useReducedMotion(), no pulse/glow.
 */

"use client";

import { motion } from "motion/react";
import { Info } from "@phosphor-icons/react/ssr";
import { springConfig, useReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

export interface NotLegalAdviceNoticeProps {
  /** Which surface the notice is rendered on — drives copy and spacing. */
  variant: "chat" | "deadline";
  /** Optional extra classes for the wrapper. */
  className?: string;
}

const COPY: Record<NotLegalAdviceNoticeProps["variant"], string> = {
  chat: "AI-generated information, not legal advice. PERM Tracker isn’t a law firm; verify with a licensed attorney.",
  deadline:
    "Calculated estimate, verify all dates with official DOL/USCIS sources and a licensed attorney.",
};

export function NotLegalAdviceNotice({
  variant,
  className,
}: NotLegalAdviceNoticeProps) {
  const reducedMotion = useReducedMotion();

  const isChat = variant === "chat";

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springConfig}
      role="note"
      className={cn(
        "flex items-start gap-2 text-muted-foreground",
        isChat
          ? "border-t border-border bg-muted/40 px-3 py-2 text-[11px] leading-snug"
          : "border-t border-border pt-4 text-xs leading-snug",
        className,
      )}
    >
      <Info
        className={cn(
          "shrink-0",
          isChat ? "mt-px h-3 w-3" : "mt-0.5 h-3.5 w-3.5",
        )}
        aria-hidden="true"
      />
      <p className={cn(!isChat && "font-mono")}>{COPY[variant]}</p>
    </motion.div>
  );
}

export default NotLegalAdviceNotice;
