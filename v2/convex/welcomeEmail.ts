/**
 * Welcome Email Actions
 *
 * Sends the welcome email to a new user after sign-up.
 *
 * INTERNAL ACTIONS:
 * - sendWelcomeEmail: Send welcome email to a single user
 *
 * @module
 */

import { internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { getResend, FROM_EMAIL, sendOrQueue } from "./lib/email";
import { WelcomeEmail } from "../src/emails/WelcomeEmail";
import { createLogger } from "./lib/logging";
import { recordError } from "./lib/errorRecording";

const log = createLogger("WelcomeEmail");

const WELCOME_SUBJECT = "Welcome: let's get your first case tracked";

/** Shared logic for rendering and sending the welcome email. */
async function renderAndSend(
  ctx: ActionCtx,
  to: string,
  userName: string,
  label: string
): Promise<void> {
  const html = await render(WelcomeEmail({ userName }));
  const resend = getResend();

  const { error } = await sendOrQueue(ctx, "welcome", resend, {
    from: FROM_EMAIL,
    to: [to],
    subject: WELCOME_SUBJECT,
    html,
  });

  if (error) {
    log.error(`Failed to send ${label}`, { error: error.message, email: to });
    await recordError(ctx, "action", `welcomeEmail.${label}`, new Error(error.message), { extra: `to: ${to}` });
    throw new Error(`${label} failed: ${error.message}`);
  }

  log.info(`${label} sent`, { email: to });
}

/**
 * Send a welcome email to a single user.
 * Called after signup (post-verification / OAuth completion).
 */
export const sendWelcomeEmail = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    await renderAndSend(ctx, args.to, args.userName, "welcome email");
  },
});

