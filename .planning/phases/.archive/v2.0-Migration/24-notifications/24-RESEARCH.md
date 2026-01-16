# Phase 24: Notifications + Email - Research

**Researched:** 2025-12-30
**Domain:** Convex notifications with real-time updates, scheduled emails, and push notifications
**Confidence:** HIGH

<research_summary>
## Summary

Researched the Convex + Resend + Web Push ecosystem for building a real-time notification system. The standard approach uses:
1. **Convex subscriptions** for instant UI updates (notification badge)
2. **Convex cron jobs** for scheduled deadline reminders
3. **Resend** for transactional emails (direct SDK or `@convex-dev/resend` component)
4. **Web Push API** with `web-push` library for browser push notifications

Key finding: The project already has Resend v6.6.0 installed and used for auth emails. The existing pattern (direct `Resend` SDK in Convex actions) works well for moderate volume. For high-volume or retry guarantees, the `@convex-dev/resend` component adds durable execution.

**Primary recommendation:** Use existing Resend integration pattern (direct SDK in actions), add Convex crons for scheduling, implement `web-push` for browser notifications. Leverage Convex's real-time subscriptions for instant notification badge updates.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | existing | Real-time subscriptions, cron jobs, actions | Already in project, handles scheduling + real-time |
| resend | 6.6.0 | Transactional email API | Already installed, simple API, great deliverability |
| web-push | 3.6.7 | Web Push Protocol implementation | Standard for browser push, VAPID support |
| @react-email/components | 0.0.31 | Email template components | Works with Resend, React-based templates |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @convex-dev/resend | latest | Convex Resend component | High volume, need retry guarantees, batching |
| sonner | existing | Toast notifications | Already in project for in-app toasts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Resend SDK | @convex-dev/resend component | Component adds durable execution + batching but more setup |
| web-push | OneSignal/Firebase | Third-party services add cost + complexity, web-push is sufficient |
| React Email | HTML strings | React Email is more maintainable, type-safe templates |

**Installation:**
```bash
# Required
npm install web-push @react-email/components

# Optional (for durable execution)
npm install @convex-dev/resend
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
v2/
├── convex/
│   ├── crons.ts                    # Scheduled jobs (deadline reminders)
│   ├── notifications.ts            # Notification CRUD mutations/queries
│   ├── notificationActions.ts      # Email sending, push sending (actions)
│   ├── lib/
│   │   ├── notificationHelpers.ts  # Pure functions for notification logic
│   │   └── emailTemplates.ts       # Email HTML generation helpers
│   └── _generated/
├── src/
│   ├── components/
│   │   ├── NotificationBell.tsx    # Header bell with badge
│   │   ├── NotificationDropdown.tsx # Recent notifications dropdown
│   │   └── NotificationList.tsx    # Full notifications page list
│   ├── app/
│   │   └── notifications/
│   │       └── page.tsx            # /notifications route
│   ├── lib/
│   │   └── pushSubscription.ts     # Push subscription client logic
│   └── emails/                     # React Email templates
│       ├── DeadlineReminder.tsx
│       ├── StatusChange.tsx
│       └── RfiAlert.tsx
└── public/
    └── sw.js                       # Service worker for push
```

### Pattern 1: Real-Time Notification Badge
**What:** Use Convex subscription for instant unread count updates
**When to use:** Notification bell in header, always subscribed
**Example:**
```typescript
// convex/notifications.ts
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();
    return unread.length;
  },
});

// Component
function NotificationBell() {
  const count = useQuery(api.notifications.getUnreadCount);
  return (
    <button>
      <BellIcon />
      {count > 0 && <Badge>{count > 99 ? "99+" : count}</Badge>}
    </button>
  );
}
```

### Pattern 2: Cron Job for Deadline Reminders
**What:** Daily scheduled check for upcoming deadlines
**When to use:** Sending reminder emails at configured intervals
**Example:**
```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 9 AM UTC (4 AM EST / 1 AM PST)
crons.daily(
  "deadline-reminders",
  { hourUTC: 14, minuteUTC: 0 },
  internal.notificationActions.checkDeadlineReminders
);

export default crons;

// convex/notificationActions.ts
export const checkDeadlineReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    // Query cases with upcoming deadlines
    const cases = await ctx.runQuery(internal.notifications.getCasesNeedingReminders);

    for (const caseData of cases) {
      // Create notification record
      await ctx.runMutation(internal.notifications.createReminder, {
        caseId: caseData._id,
        deadlineType: caseData.deadlineType,
        daysUntil: caseData.daysUntil,
      });

      // Send email if enabled
      if (caseData.emailEnabled) {
        await sendDeadlineEmail(caseData);
      }
    }
  },
});
```

### Pattern 3: Email via Resend Action
**What:** Send transactional emails from Convex action
**When to use:** After creating notification, when email is enabled
**Example:**
```typescript
// convex/notificationActions.ts
import { Resend } from "resend";
import { render } from "@react-email/render";
import { DeadlineReminder } from "../src/emails/DeadlineReminder";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

export const sendDeadlineEmail = internalAction({
  args: {
    to: v.string(),
    caseData: v.object({ /* ... */ }),
  },
  handler: async (ctx, { to, caseData }) => {
    const html = await render(DeadlineReminder({ ...caseData }));

    const { error } = await resend.emails.send({
      from: "PERM Tracker <notifications@permtracker.app>",
      to: [to],
      subject: `Deadline Reminder: ${caseData.deadlineType}`,
      html,
    });

    if (error) {
      console.error("Email failed:", error);
      throw new Error(error.message);
    }

    // Mark notification as emailed
    await ctx.runMutation(internal.notifications.markEmailSent, {
      notificationId: caseData.notificationId,
    });
  },
});
```

### Pattern 4: Push Notification Subscription
**What:** Store push subscriptions, send via web-push
**When to use:** Urgent deadlines, real-time alerts
**Example:**
```typescript
// Client: Subscribe to push
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    ),
  });

  // Save to Convex
  await convex.mutation(api.users.savePushSubscription, {
    subscription: JSON.stringify(subscription),
  });
}

// Server: Send push
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:support@permtracker.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export const sendPushNotification = internalAction({
  args: { userId: v.id("users"), payload: v.string() },
  handler: async (ctx, { userId, payload }) => {
    const user = await ctx.runQuery(internal.users.getPushSubscription, { userId });
    if (!user?.pushSubscription) return;

    await webpush.sendNotification(
      JSON.parse(user.pushSubscription),
      payload
    );
  },
});
```

### Anti-Patterns to Avoid
- **Polling for notifications:** Use Convex subscriptions, not setInterval
- **Sending emails in mutations:** Use actions for external API calls
- **Public cron handlers:** Use `internal` functions for scheduled jobs
- **Blocking on email send:** Schedule email as separate action, don't block notification creation
- **Storing VAPID private key in code:** Use environment variables
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP handling | Resend SDK | Deliverability, bounce handling, analytics |
| Email templates | String concatenation | React Email | Type-safe, maintainable, preview-able |
| Push encryption | Custom VAPID/encryption | web-push library | Complex crypto, handles protocol details |
| Notification scheduling | setTimeout/setInterval | Convex crons | Survives restarts, dashboard visibility |
| Real-time updates | WebSocket management | Convex subscriptions | Automatic, handles reconnection |
| Email retry logic | Manual retry loops | @convex-dev/resend | Durable execution, exponential backoff |

**Key insight:** Notifications seem simple but have many edge cases: timezone handling, rate limiting, subscription management, bounce handling, retry logic. The Convex + Resend + web-push stack handles all of these.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Cron Jobs Using Public API
**What goes wrong:** Scheduled jobs exposed to client, security risk
**Why it happens:** Using `api.x.y` instead of `internal.x.y` in crons.ts
**How to avoid:** Always use `internal` for cron handlers
**Warning signs:** Cron function appears in generated client API

### Pitfall 2: Email Sending Blocks Notification Creation
**What goes wrong:** Slow email API delays in-app notification appearance
**Why it happens:** Awaiting email send in same mutation as notification insert
**How to avoid:** Create notification first, schedule email action separately
**Warning signs:** Notifications appear after 2-3 second delay
```typescript
// GOOD: Separate concerns
await ctx.db.insert("notifications", { ... });
await ctx.scheduler.runAfter(0, internal.notificationActions.sendEmail, { ... });
```

### Pitfall 3: Push Subscription Stale After Permission Revoke
**What goes wrong:** Sending push to revoked subscription causes 410 error
**Why it happens:** Not handling push service error responses
**How to avoid:** Catch 410/404 errors, delete stale subscriptions
**Warning signs:** Log full of "push failed" errors
```typescript
try {
  await webpush.sendNotification(subscription, payload);
} catch (error) {
  if (error.statusCode === 410 || error.statusCode === 404) {
    // Subscription expired, remove from database
    await ctx.runMutation(internal.users.removePushSubscription, { userId });
  }
}
```

### Pitfall 4: Timezone Confusion in Cron Schedules
**What goes wrong:** Emails sent at wrong time for users
**Why it happens:** Convex crons use UTC, user expects local time
**How to avoid:** Document clearly that hourUTC is UTC; for user-local times, store preference and adjust
**Warning signs:** Users complain about 3 AM emails

### Pitfall 5: Duplicate Notifications on Re-runs
**What goes wrong:** Same deadline reminder sent multiple times
**Why it happens:** Cron re-runs after failure, no idempotency check
**How to avoid:** Check if notification already exists for this deadline+interval
**Warning signs:** Users get 5 "7 days until deadline" emails
```typescript
// Check before creating
const existing = await ctx.db
  .query("notifications")
  .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
  .filter((q) =>
    q.and(
      q.eq(q.field("deadlineType"), deadlineType),
      q.eq(q.field("daysUntilDeadline"), daysUntil)
    )
  )
  .first();

if (existing) return; // Already notified
```

### Pitfall 6: Service Worker Not Updating
**What goes wrong:** Push notifications don't work after code changes
**Why it happens:** Browser caches old service worker
**How to avoid:** Use cache-busting headers, version your SW
**Warning signs:** Push works on new devices but not existing
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Convex Cron Setup
```typescript
// convex/crons.ts
// Source: Convex docs
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at 9 AM EST (14:00 UTC)
crons.daily(
  "deadline-reminders",
  { hourUTC: 14, minuteUTC: 0 },
  internal.notificationActions.checkDeadlineReminders
);

// Hourly cleanup of old notifications
crons.hourly(
  "notification-cleanup",
  { minuteUTC: 0 },
  internal.notificationActions.cleanupOldNotifications
);

export default crons;
```

### Notification Query with Subscription
```typescript
// convex/notifications.ts
// Source: Convex real-time patterns
export const getRecentNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 5 }) => {
    const userId = await getCurrentUserId(ctx);

    return await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});
```

### Resend Email Action
```typescript
// convex/notificationActions.ts
// Source: Resend + Convex integration
import { Resend } from "resend";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

export const sendNotificationEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { to, subject, html, notificationId }) => {
    const { error } = await resend.emails.send({
      from: "PERM Tracker <notifications@permtracker.app>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      throw new Error(`Email failed: ${error.message}`);
    }

    // Update notification record
    await ctx.runMutation(internal.notifications.markEmailSent, {
      notificationId,
    });
  },
});
```

### React Email Template
```tsx
// src/emails/DeadlineReminder.tsx
// Source: React Email docs
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface DeadlineReminderProps {
  employerName: string;
  beneficiaryName: string;
  deadlineType: string;
  deadlineDate: string;
  daysUntil: number;
  caseUrl: string;
}

export function DeadlineReminder({
  employerName,
  beneficiaryName,
  deadlineType,
  deadlineDate,
  daysUntil,
  caseUrl,
}: DeadlineReminderProps) {
  const urgencyColor = daysUntil <= 7 ? "#dc2626" : daysUntil <= 14 ? "#f97316" : "#2563eb";

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "system-ui, sans-serif", padding: "20px" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Heading style={{ color: urgencyColor }}>
            {daysUntil === 0 ? "Deadline Today!" : `${daysUntil} Days Until Deadline`}
          </Heading>

          <Text>
            <strong>{employerName}</strong> - {beneficiaryName}
          </Text>

          <Text>
            <strong>{deadlineType}</strong> is due on {deadlineDate}.
          </Text>

          <Button
            href={caseUrl}
            style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "12px 24px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            View Case
          </Button>

          <Hr style={{ margin: "24px 0" }} />

          <Text style={{ color: "#666", fontSize: "12px" }}>
            Manage notification preferences in Settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DeadlineReminder;
```

### Push Notification Service Worker
```javascript
// public/sw.js
// Source: web-push + MDN docs
self.addEventListener("push", function (event) {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "default",
    data: { url: data.url },
    vibrate: [100, 50, 100],
    actions: [
      { action: "view", title: "View Case" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-pwa package | Native Next.js PWA support | Fall 2024 | No external dependency needed |
| Manual Resend retries | @convex-dev/resend component | 2024 | Durable execution, automatic batching |
| HTML string templates | React Email 5.0 | Nov 2025 | Tailwind 4, dark mode preview, Resend CLI |
| Individual email sends | Resend batch endpoint | 2024 | Single API call for 100+ emails |

**New tools/patterns to consider:**
- **React Email 5.0:** Tailwind 4 support, dark mode preview, template upload to Resend
- **Convex Crons component:** Runtime cron registration (vs static crons.ts)
- **Resend Audiences:** For marketing emails (not needed for transactional)

**Deprecated/outdated:**
- **next-pwa:** Use native Next.js PWA instead
- **nodemailer:** Use Resend for simpler API and better deliverability
- **Firebase Cloud Messaging:** web-push is sufficient for browser push
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Quiet Hours Implementation**
   - What we know: userProfiles has quietHoursEnabled, quietHoursStart, quietHoursEnd, timezone fields
   - What's unclear: Whether to skip sending entirely or queue for later
   - Recommendation: For Phase 24, skip sending during quiet hours. Phase 25 can add queuing if needed.

2. **Daily Digest Batching**
   - What we know: Option exists for daily digest emails
   - What's unclear: How to aggregate multiple deadlines into single email
   - Recommendation: Create separate email template for digest, aggregate in cron job

3. **Push Notification Permission UX**
   - What we know: Need VAPID keys, service worker, subscription storage
   - What's unclear: Best UX for requesting permission (when, where)
   - Recommendation: Request after first login, from settings page, or on specific trigger (not on page load)
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- /llmstxt/convex_dev_llms-full_txt - Crons, actions, subscriptions, internal functions
- /resend/resend-node - Email sending API
- /resend/react-email - Email template components
- /web-push-libs/web-push - Push notification protocol

### Secondary (MEDIUM confidence)
- Convex Stack articles on cron jobs and Resend integration - verified against docs
- React Email 5.0 release notes - verified patterns work
- Next.js PWA documentation - native support confirmed

### Tertiary (LOW confidence - needs validation)
- Quiet hours implementation details - no official pattern found
- Daily digest batching - community pattern, verify during implementation
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Convex (crons, actions, subscriptions)
- Ecosystem: Resend, React Email, web-push
- Patterns: Real-time subscriptions, scheduled jobs, transactional email, push notifications
- Pitfalls: Idempotency, timezone handling, stale subscriptions, blocking patterns

**Confidence breakdown:**
- Standard stack: HIGH - verified with Context7, current versions confirmed
- Architecture: HIGH - from official docs and project patterns
- Pitfalls: HIGH - documented in Convex best practices
- Code examples: HIGH - from Context7/official sources

**Research date:** 2025-12-30
**Valid until:** 2026-01-30 (30 days - ecosystem stable)
</metadata>

---

*Phase: 24-notifications*
*Research completed: 2025-12-30*
*Ready for planning: yes*
