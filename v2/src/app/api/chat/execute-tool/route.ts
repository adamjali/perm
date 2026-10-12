/**
 * Execute Tool API Route
 *
 * Runs a change the person approved on a confirmation card.
 *
 * POST /api/chat/execute-tool
 * Body: { toolCallId: string } (other fields are ignored)
 * Returns: what was saved, read back from the data
 *
 * The card's change was recorded on the server when the card was shown
 * (convex/chatConfirmations.ts). This route claims that record by the card's
 * id and runs the stored change, once. It never runs a tool name or arguments
 * the browser sends: before Oct 12 2026 it did, kept no record of the cards it
 * had issued, and ran an approval as many times as it arrived, so two cards for
 * one change both ran and a card could be approved again from another tab.
 */

import { NextResponse } from 'next/server';
import { captureError } from '@/lib/sentry';
import { isAuthenticatedNextjs, convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchMutation } from 'convex/nextjs';
import { rateLimitedToolResult } from '@/lib/ai/limits';
import { runAction } from '@/lib/ai/caseActions';
import { api } from '@convex/_generated/api';

const TOOL_CALL_ID = /^[\w.:-]{1,200}$/;

export async function POST(request: Request) {
  const startTime = Date.now();

  const isAuthenticated = await isAuthenticatedNextjs();
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: 'No auth token' }, { status: 401 });
  }

  let toolCallId: string;
  try {
    const body = (await request.json()) as { toolCallId?: unknown };
    if (typeof body.toolCallId !== 'string' || !TOOL_CALL_ID.test(body.toolCallId)) {
      return NextResponse.json({ error: 'Missing or malformed card id.' }, { status: 400 });
    }
    toolCallId = body.toolCallId;
  } catch {
    return NextResponse.json({ error: 'Bad request body.' }, { status: 400 });
  }

  let claimed: Awaited<ReturnType<typeof fetchMutation<typeof api.chatConfirmations.claim>>>;
  try {
    claimed = await fetchMutation(api.chatConfirmations.claim, { toolCallId }, { token });
  } catch (error) {
    const limited = rateLimitedToolResult(error);
    if (limited) {
      return NextResponse.json(limited, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    }
    captureError(error);
    return NextResponse.json({ error: "The approval couldn't be checked. Try again." }, { status: 500 });
  }

  if (!claimed.ok) {
    // Already made, cancelled, expired, or the case changed: say which, and
    // never run anything. 409: the card's state, not a server fault.
    return NextResponse.json(
      {
        error: claimed.message,
        refused: claimed.reason,
        ...('result' in claimed && claimed.result ? { previousResult: claimed.result } : {}),
        toolCallId,
      },
      { status: 409 },
    );
  }

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(claimed.args) as Record<string, unknown>;
  } catch (error) {
    captureError(error);
    await fetchMutation(api.chatConfirmations.finish, { toolCallId, ok: false, result: 'The stored change could not be read.' }, { token }).catch(() => {});
    return NextResponse.json({ error: 'The stored change could not be read.' }, { status: 500 });
  }

  try {
    const outcome = await runAction(claimed.toolName, args, token);
    await fetchMutation(api.chatConfirmations.finish, { toolCallId, ok: outcome.ok, result: outcome.summary }, { token }).catch((e) =>
      captureError(e),
    );
    const duration = Date.now() - startTime;
    return NextResponse.json({
      ...outcome.result,
      toolCallId,
      toolName: claimed.toolName,
      executedAt: Date.now(),
      duration,
    });
  } catch (error) {
    // The change failed before it was made (a rule, a limit): the card can be
    // approved again once the cause is fixed.
    const limited = rateLimitedToolResult(error);
    const message = limited ? limited.error : error instanceof Error ? error.message : 'The change failed.';
    await fetchMutation(api.chatConfirmations.finish, { toolCallId, ok: false, result: String(message).slice(0, 500) }, { token }).catch(
      (e) => captureError(e),
    );
    if (limited) {
      return NextResponse.json(limited, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
    }
    captureError(error);
    return NextResponse.json(
      {
        error: message,
        suggestion: "Nothing was changed. Fix what the message says, or ask the assistant to check the case again.",
        toolCallId,
      },
      { status: 500 },
    );
  }
}
