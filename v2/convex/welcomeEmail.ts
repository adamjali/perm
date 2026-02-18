/**
 * Welcome Email Actions
 *
 * Handles sending the welcome email to new users (post-signup)
 * and one-off blast to existing users.
 *
 * INTERNAL ACTIONS:
 * - sendWelcomeEmail: Send welcome email to a single user
 * - sendWelcomeBlast: Send welcome email to all existing users
 *
 * INTERNAL ACTIONS:
 * - sendTestWelcomeEmail: Send test email to a specific address
 *
 * @module
 */

import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { internal } from "./_generated/api";
import { getResend, FROM_EMAIL } from "./lib/email";
import { WelcomeEmail } from "../src/emails/WelcomeEmail";

/**
 * Send a welcome email to a single user.
 * Called after signup (post-verification / OAuth completion).
 */
export const sendWelcomeEmail = internalAction({
  args: {
    to: v.string(),
    userName: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();

    const html = await render(
      WelcomeEmail({
        userName: args.userName,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [args.to],
      subject: "Welcome — let's get your first case tracked",
      html,
    });

    if (error) {
      console.error("Failed to send welcome email", {
        error: error.message,
        to: args.to,
      });
      throw new Error(`Welcome email failed: ${error.message}`);
    }

    console.log("Welcome email sent", { to: args.to });
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
  handler: async (_ctx, args) => {
    const resend = getResend();

    const html = await render(
      WelcomeEmail({
        userName: args.userName ?? "Test User",
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [args.to],
      subject: "Welcome — let's get your first case tracked",
      html,
    });

    if (error) {
      throw new Error(`Test welcome email failed: ${error.message}`);
    }

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

    // Schedule individual emails with 800ms stagger to stay under 2 req/sec
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (!user) continue;
      const delayMs = i * 800;
      await ctx.scheduler.runAfter(
        delayMs,
        internal.welcomeEmail.sendWelcomeEmail,
        { to: user.email, userName: user.displayName }
      );
    }

    console.log(`Welcome blast: scheduled ${users.length} emails`);
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
    console.log(`Welcome blast scheduled for ${scheduledFor}`);
    return { scheduledFor };
  },
});
