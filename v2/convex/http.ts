import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

// ============================================================================
// Resend Inbound Email Webhook
// ============================================================================

http.route({
  path: "/resend-inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      // Resend sends email.received events
      if (body.type !== "email.received") {
        return new Response(JSON.stringify({ ignored: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = body.data;
      if (!data?.email_id) {
        return new Response(JSON.stringify({ error: "Missing email_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Parse sender — format: "Name <email>" or just "email"
      let fromEmail = data.from || "";
      let fromName: string | undefined;
      const nameMatch = fromEmail.match(/^(.+?)\s*<(.+?)>$/);
      if (nameMatch) {
        fromName = nameMatch[1].trim();
        fromEmail = nameMatch[2].trim();
      }

      // Schedule async processing (fetch full content, store, notify)
      await ctx.runAction(internal.supportEmail.processInboundEmail, {
        resendEmailId: data.email_id,
        fromEmail,
        fromName,
        toEmails: Array.isArray(data.to) ? data.to : [data.to],
        subject: data.subject || "(No subject)",
        messageId: data.message_id || data.email_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Resend inbound webhook error:", error);
      // Return 200 to prevent Resend from retrying on our errors
      return new Response(
        JSON.stringify({
          error: "Processing error",
          message: error instanceof Error ? error.message : "Unknown",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
