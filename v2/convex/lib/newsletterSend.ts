/**
 * The digest's send loop, as a pure function over injected effects.
 *
 * Extracted from `newsletter.sendBatch` so the retry and cursor rules can be
 * tested without a deployment. The action supplies the real batch reader,
 * budget charge, Resend call and clock; the tests supply fakes.
 *
 * ## The rules this encodes
 *
 * - **Charge before every attempt.** The budget guards a shared Resend quota,
 *   and a retry is a second request to Resend. A refused charge stops the run
 *   and leaves the cursor BEHIND the address it refused, so tomorrow's batch
 *   starts with that address rather than skipping it.
 * - **One retry, after a delay.** Resend answers `{ error }` for a dropped
 *   socket and a 429 alike (`sendEmailWithRetry` already backs off on the
 *   429). One more attempt a few seconds later catches the transient class;
 *   anything that fails twice is recorded as a failure and the loop moves on,
 *   so one dead address cannot stall the whole list.
 * - **Advance the cursor only after an address is handled** - sent, or failed
 *   twice - never after a single failure. That was the defect: a transient
 *   error advanced the cursor and the subscriber missed the issue for good.
 *
 * @module convex/lib/newsletterSend
 */

export interface SendLoopDeps {
  /** Confirmed addresses after `after`, in email order, at most `limit`. */
  nextBatch: (after: string | undefined, limit: number) => Promise<string[]>;
  /** Charge one send against the daily cap. Called before EVERY attempt. */
  charge: () => Promise<{ allowed: boolean }>;
  /** One attempt. Resend's shape: `{ error }` on failure, nothing on success. */
  send: (email: string) => Promise<{ error?: unknown }>;
  /** Sleep. Injected so tests do not. */
  wait: (ms: number) => Promise<void>;
  /** Attempt 1 is a warning; attempt 2 is the recorded failure. */
  onFailure: (email: string, error: unknown, attempt: 1 | 2) => Promise<void>;
}

export interface SendLoopOptions {
  /** The last address already handled by a previous run, if any. */
  cursor?: string;
  /** Addresses per read. */
  batch: number;
  /** Pause before the single retry. */
  retryDelayMs: number;
}

export interface SendLoopResult {
  sent: number;
  /** Addresses that failed twice and were skipped, each recorded. */
  failed: number;
  /** The last address handled; undefined when nothing was. */
  cursor: string | undefined;
  /** True when the budget refused a charge and the run stopped early. */
  budgetHit: boolean;
}

/** Three seconds: long enough for a dropped connection, short enough that thirty of them fit an action. */
export const RETRY_DELAY_MS = 3000;

export async function runSendLoop(deps: SendLoopDeps, opts: SendLoopOptions): Promise<SendLoopResult> {
  let cursor = opts.cursor;
  let sent = 0;
  let failed = 0;
  let budgetHit = false;

  outer: while (true) {
    const batch = await deps.nextBatch(cursor, opts.batch);
    if (batch.length === 0) break;
    for (const email of batch) {
      if (!(await deps.charge()).allowed) {
        budgetHit = true;
        break outer;
      }
      const first = await deps.send(email);
      if (!first.error) {
        sent += 1;
        cursor = email;
        continue;
      }
      await deps.onFailure(email, first.error, 1);
      await deps.wait(opts.retryDelayMs);
      // A retry is another request to Resend, so it is charged like one. If
      // the budget refuses it, this address is NOT handled: leave the cursor
      // where it was and let tomorrow's run start here.
      if (!(await deps.charge()).allowed) {
        budgetHit = true;
        break outer;
      }
      const second = await deps.send(email);
      if (second.error) {
        await deps.onFailure(email, second.error, 2);
        failed += 1;
      } else {
        sent += 1;
      }
      cursor = email;
    }
    if (batch.length < opts.batch) break;
  }

  return { sent, failed, cursor, budgetHit };
}
