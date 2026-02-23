/**
 * Welcome Email Actions
 *
 * Handles sending the welcome email to new users (post-signup)
 * and one-off blast to existing users.
 *
 * INTERNAL ACTIONS:
 * - sendWelcomeEmail: Send welcome email to a single user
 * - sendWelcomeBlast: Send welcome email to all existing users
 * - sendTestWelcomeEmail: Send test email to a specific address
 *
 * @module
 */

import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { internal } from "./_generated/api";
import { getResend, FROM_EMAIL, sendEmailWithRetry } from "./lib/email";
import { WelcomeEmail } from "../src/emails/WelcomeEmail";
import { createLogger } from "./lib/logging";
import { recordError } from "./lib/errorRecording";

const log = createLogger("WelcomeEmail");

const WELCOME_SUBJECT = "Welcome — let's get your first case tracked";

/** Shared logic for rendering and sending the welcome email. */
async function renderAndSend(
  ctx: Parameters<typeof recordError>[0],
  to: string,
  userName: string,
  label: string
): Promise<void> {
  const html = await render(WelcomeEmail({ userName }));
  const resend = getResend();

  const { error } = await sendEmailWithRetry(resend, {
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

/**
 * Send a test welcome email to a specific address.
 * For testing the template before blast.
 */
export const sendTestWelcomeEmail = internalAction({
  args: {
    to: v.string(),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await renderAndSend(ctx, args.to, args.userName ?? "Test User", "test welcome email");
    return { success: true, to: args.to };
  },
});

/**
 * Send the welcome email to all existing users.
 * One-off blast — queries all users with email addresses
 * and schedules individual emails with staggered delays to respect
 * Resend's 2 req/sec rate limit.
 */
export const sendWelcomeBlast = internalAction({
  args: {},
  handler: async (ctx): Promise<{ scheduled: number; total: number }> => {
    // Get all users with their profiles
    const users: { email: string; displayName: string }[] = await ctx.runQuery(
      internal.welcomeEmailHelpers.getAllUsersForBlast
    );

    // Schedule individual emails with 1000ms stagger to stay under 2 req/sec
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (!user) continue;
      const delayMs = i * 1000;
      await ctx.scheduler.runAfter(
        delayMs,
        internal.welcomeEmail.sendWelcomeEmail,
        { to: user.email, userName: user.displayName }
      );
    }

    log.info("Welcome blast scheduled", { count: users.length });
    return { scheduled: users.length, total: users.length };
  },
});

/**
 * Schedule the welcome blast for a specific time.
 * One-off use — schedules sendWelcomeBlast to run at the given timestamp.
 */
export const scheduleWelcomeBlast = internalMutation({
  args: {
    /** Unix timestamp (ms) for when to send */
    scheduledTime: v.number(),
  },
  handler: async (ctx, args): Promise<{ scheduledFor: string }> => {
    await ctx.scheduler.runAt(
      args.scheduledTime,
      internal.welcomeEmail.sendWelcomeBlast,
      {}
    );
    const scheduledFor = new Date(args.scheduledTime).toISOString();
    log.info("Welcome blast timed", { scheduledFor });
    return { scheduledFor };
  },
});
