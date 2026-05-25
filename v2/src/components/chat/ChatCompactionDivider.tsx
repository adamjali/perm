'use client';

/**
 * ChatCompactionDivider
 *
 * Editorial/scholarly marker inline in the chat thread at the point where
 * earlier messages have been archived into a summary + facts. Visible to the
 * user but unobtrusive — recedes when scanning, readable when reading.
 *
 * Design:
 *   - Typography: `--font-heading` small-caps with 0.12em letter-spacing
 *     for the label; `--font-body` serif for prose; `--font-mono` for facts grid
 *   - Hairline rules (0.5px) flanking the centered label
 *   - Muted-foreground @ 65% opacity — present without shouting
 *   - Chevron rotates 180° on expand, spring { stiffness: 600, damping: 30 }
 *   - Expand via CSS grid-template-rows 0fr → 1fr — no layout jank
 *   - Full width at 375px, dark-mode tested
 *   - Zero decoration (no pulse, no glow)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CompactionFactsSchema,
  parseFacts as parseFactsJson,
  type CompactionFacts,
} from '@/lib/ai/compaction';

interface ChatCompactionDividerProps {
  /** How many earlier messages this divider archives. */
  messageCount: number;
  /** Prose summary (bounded ~1000 tokens). May be empty if only facts were extracted. */
  summary: string;
  /** Structured facts (JSON string from Convex, or already-parsed object). */
  facts?: string | CompactionFacts | null;
  /** Optional additional class names. */
  className?: string;
}

/**
 * Normalize the facts prop to the canonical shape. Routes BOTH the JSON-string
 * form (Convex) and a pre-parsed object through the single canonical schema /
 * parser in compaction.ts — no second facts contract lives here.
 */
function parseFacts(
  raw: string | CompactionFacts | null | undefined,
): CompactionFacts | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return parseFactsJson(raw);
  const result = CompactionFactsSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

function formatCase(c: { id: string; status?: string }): string {
  return c.status ? `${c.id} (${c.status})` : c.id;
}

function hasAnyFacts(facts: CompactionFacts | undefined): boolean {
  if (!facts) return false;
  return Boolean(
    (facts.cases && facts.cases.length > 0) ||
      (facts.people && facts.people.length > 0) ||
      (facts.dates && Object.keys(facts.dates).length > 0) ||
      (facts.preferences && facts.preferences.length > 0) ||
      (facts.openActions && facts.openActions.length > 0),
  );
}

export function ChatCompactionDivider({
  messageCount,
  summary,
  facts: factsInput,
  className,
}: ChatCompactionDividerProps) {
  const [expanded, setExpanded] = useState(false);
  const facts = parseFacts(factsInput);
  const expandable = summary.trim().length > 0 || hasAnyFacts(facts);

  return (
    <div
      className={cn('my-6 w-full select-none', className)}
      role="separator"
      aria-label={`Earlier ${messageCount} messages archived`}
      data-testid="chat-compaction-divider"
    >
      <button
        type="button"
        disabled={!expandable}
        onClick={() => expandable && setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="chat-compaction-summary"
        className={cn(
          'flex w-full items-center gap-3 text-[color-mix(in_oklch,var(--muted-foreground)_65%,transparent)]',
          'hover:text-[color-mix(in_oklch,var(--muted-foreground)_85%,transparent)] transition-colors',
          !expandable && 'cursor-default hover:text-[color-mix(in_oklch,var(--muted-foreground)_65%,transparent)]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color-mix(in_oklch,var(--muted-foreground)_40%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
        )}
      >
        <span
          className="h-px flex-1"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--border) 70%, transparent)',
          }}
          aria-hidden
        />
        <span
          className="shrink-0 whitespace-nowrap text-[0.66rem] uppercase"
          style={{
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.12em',
            fontWeight: 500,
          }}
        >
          <span>Earlier context archived</span>
          <span
            className="mx-1.5 opacity-50"
            aria-hidden
          >
            ·
          </span>
          <span>
            {messageCount} {messageCount === 1 ? 'message' : 'messages'}
          </span>
        </span>
        <span
          className="h-px flex-1"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--border) 70%, transparent)',
          }}
          aria-hidden
        />
        {expandable && (
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 30 }}
            className="shrink-0"
            aria-hidden
          >
            <ChevronDown className="size-3.5" />
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && expandable && (
          <motion.div
            id="chat-compaction-summary"
            key="summary-grid"
            initial={{ gridTemplateRows: '0fr', opacity: 0 }}
            animate={{ gridTemplateRows: '1fr', opacity: 1 }}
            exit={{ gridTemplateRows: '0fr', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 30, opacity: { duration: 0.18 } }}
            className="mt-4 grid"
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className="rounded-md px-4 py-3.5 text-[color-mix(in_oklch,var(--foreground)_75%,transparent)]"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--muted) 50%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--border) 60%, transparent)',
                }}
              >
                {summary.trim().length > 0 && (
                  <p
                    className="whitespace-pre-wrap text-[0.85rem] leading-relaxed"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {summary}
                  </p>
                )}

                {hasAnyFacts(facts) && (
                  <div
                    className={cn(
                      'grid gap-x-4 gap-y-1.5 text-[0.72rem]',
                      'grid-cols-[auto_1fr]',
                      summary.trim().length > 0 && 'mt-4 pt-4',
                    )}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      ...(summary.trim().length > 0 && {
                        borderTop: '1px solid color-mix(in oklch, var(--border) 40%, transparent)',
                      }),
                    }}
                  >
                    <div
                      className="col-span-2 text-[0.62rem] uppercase"
                      style={{
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.12em',
                        fontWeight: 500,
                        color: 'color-mix(in oklch, var(--muted-foreground) 75%, transparent)',
                      }}
                    >
                      Key facts
                    </div>

                    {facts?.cases && facts.cases.length > 0 && (
                      <>
                        <span className="opacity-60">Cases</span>
                        <span className="break-words">{facts.cases.map(formatCase).join(' · ')}</span>
                      </>
                    )}

                    {facts?.people && facts.people.length > 0 && (
                      <>
                        <span className="opacity-60">People</span>
                        <span className="break-words">
                          {facts.people
                            .map((p) => (p.role ? `${p.name} (${p.role})` : p.name))
                            .join(' · ')}
                        </span>
                      </>
                    )}

                    {facts?.dates && Object.keys(facts.dates).length > 0 && (
                      <>
                        <span className="opacity-60">Dates</span>
                        <span className="break-words">
                          {Object.entries(facts.dates)
                            .map(([k, v]) => `${k} ${v}`)
                            .join(' · ')}
                        </span>
                      </>
                    )}

                    {facts?.preferences && facts.preferences.length > 0 && (
                      <>
                        <span className="opacity-60">Prefs</span>
                        <span className="break-words">{facts.preferences.join(' · ')}</span>
                      </>
                    )}

                    {facts?.openActions && facts.openActions.length > 0 && (
                      <>
                        <span className="opacity-60">Open</span>
                        <span className="break-words">{facts.openActions.join(' · ')}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
