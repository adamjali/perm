/**
 * The evening newsworthy email, to the owner only.
 *
 * `newsworthy.yml` runs `scripts/newsworthy.py` at about 8:30 PM Eastern and,
 * only when something moved since the morning report, calls `send` with the
 * lines. The mail goes through `sendOwnerMail` (the free mail Worker, Resend's
 * high-priority room as the fallback), never Resend's list budget, and to the
 * admin address alone.
 *
 * Returns only a boolean: the GitHub log prints what this returns, and that
 * log is public.
 */
import { render } from "@react-email/render";
import { v } from "convex/values";

import { AdminEmail } from "../src/emails/AdminEmail";
import { internalAction } from "./_generated/server";
import { getSecurityAlertEmail } from "./lib/admin";
import { getResend } from "./lib/email";
import { createLogger } from "./lib/logging";
import { newsBody, newsSubject, readNews } from "./lib/newsworthyEmail";
import { sendOwnerMail } from "./lib/ownerMail";

const log = createLogger("newsworthy");

export const send = internalAction({
  args: { news: v.any() },
  returns: v.object({ emailed: v.boolean() }),
  handler: async (ctx, args) => {
    const news = readNews(args.news);
    if (!news) throw new Error("newsworthy: unreadable input");
    if (news.lines.length === 0) return { emailed: false };
    const to = getSecurityAlertEmail();
    if (!to) {
      log.error("newsworthy: no admin address configured");
      return { emailed: false };
    }
    const subject = newsSubject(news);
    const body = newsBody(news);
    const html = await render(AdminEmail({ recipientName: "Admin", subject, body, kind: "notice" }));
    const { error } = await sendOwnerMail(ctx, "newsworthy", getResend(), { to, subject, html, text: body });
    if (error) {
      log.error("newsworthy: send failed", { error: error.message });
      return { emailed: false };
    }
    return { emailed: true };
  },
});
