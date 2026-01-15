# Push Notifications Documentation

> **Module:** Push notification system for deadline alerts
> **Last Updated:** 2026-01-03

This document describes the Web Push notification system in PERM Tracker v2 for real-time deadline alerts.

---

## Overview

Push notifications allow users to receive deadline alerts even when they're not actively using the app. The system uses the Web Push API with VAPID authentication.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Service Worker | `public/sw-push.js` | Handles push events client-side |
| Server Actions | `convex/pushNotifications.ts` | Sends notifications via `web-push` |
| Subscriptions | `convex/pushSubscriptions.ts` | Manages user subscriptions |

---

## 1. VAPID Key Setup

VAPID (Voluntary Application Server Identification) is required for Web Push.

### Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

**Output example:**
```
Public Key:
BHDl.....................................................mQ0

Private Key:
sGwh.....................................................Xbc
```

### Environment Configuration

| Variable | Location | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local` + Convex | Client-side subscription |
| `VAPID_PRIVATE_KEY` | Convex only | Server-side signing (NEVER expose) |

**Convex Dashboard Setup:**

1. Go to Dashboard → Your Project → Settings → Environment Variables
2. Add `VAPID_PRIVATE_KEY` (keep this secret!)
3. Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

**Local .env.local:**
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHDl...mQ0
```

---

## 2. Subscription Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER ENABLES PUSH                            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Request Notification Permission                            │
│     Notification.requestPermission()                           │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Register Service Worker                                    │
│     navigator.serviceWorker.register('/sw-push.js')            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Subscribe to Push Manager                                  │
│     registration.pushManager.subscribe({                       │
│       userVisibleOnly: true,                                   │
│       applicationServerKey: urlBase64ToUint8Array(VAPID_KEY)   │
│     })                                                         │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Save Subscription to Convex                                │
│     savePushSubscription({ subscription: JSON.stringify(...) })│
└─────────────────────────────────────────────────────────────────┘
```

### Client-Side Subscription Code

```typescript
// Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe to push notifications
async function subscribeToPush(): Promise<PushSubscription | null> {
  // 1. Check permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return null;
  }

  // 2. Get service worker registration
  const registration = await navigator.serviceWorker.ready;

  // 3. Subscribe to push manager
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    ),
  });

  // 4. Send subscription to server
  await updateProfile({
    pushSubscription: JSON.stringify(subscription),
    pushNotificationsEnabled: true,
  });

  return subscription;
}
```

---

## 3. Sending Notifications

### From Scheduled Jobs

```typescript
import { internal } from "./_generated/api";

// Inside a scheduled job handler
await ctx.runAction(internal.pushNotifications.sendPushNotification, {
  userId,
  title: "Deadline Approaching",
  body: "PWD expiration in 7 days for Smith Case",
  url: `/cases/${caseId}`,
  tag: `deadline-${caseId}`, // Groups notifications
});
```

### Payload Format

```typescript
interface PushPayload {
  title: string;        // Notification title
  body: string;         // Notification body
  url?: string;         // Click destination (default: /dashboard)
  tag?: string;         // Notification grouping (default: perm-tracker)
  icon?: string;        // Icon path
  badge?: string;       // Badge icon path
}
```

---

## 4. Service Worker Events

### Push Event

Triggered when server sends a push message:

```javascript
self.addEventListener("push", function (event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag,
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
```

### Notification Click

Handles user tapping the notification:

```javascript
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(url)) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});
```

---

## 5. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `VAPID keys not configured` | Missing env vars | Add keys to Convex dashboard |
| `Push subscription expired` | User revoked permission | Re-request notification permission |
| Notifications not showing | Service worker not registered | Check SW registration in DevTools |
| Blocked by browser | User denied permission | Can't override - explain in UI |
| 410 status code | Subscription expired | Clear and re-subscribe |

### Debugging Steps

1. **Check Service Worker Registration**
   ```
   Chrome DevTools → Application → Service Workers
   ```

2. **Check Push Subscription**
   ```
   Chrome DevTools → Application → Service Workers → Push
   ```

3. **Test Push Manually**
   - Go to Settings → Notifications → Send Test Notification

4. **Check Server Logs**
   - Convex Dashboard → Logs → Filter by `[Push]`

### Browser Compatibility

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | Yes | Yes |
| Firefox | Yes | Yes |
| Safari | Yes (16.4+) | Yes (16.4+) |
| Edge | Yes | Yes |
| Opera | Yes | Yes |

**Note:** iOS Safari requires iOS 16.4+ and the app must be added to Home Screen.

---

## 6. Testing

### Manual Testing

1. Enable push notifications in Settings
2. Click "Send Test Notification"
3. Verify notification appears

### Test Action

```typescript
// From settings page
const result = await sendTestPush({});
if (result.success) {
  console.log("Test notification sent!");
}
```

---

## 7. Security Considerations

1. **Private Key Protection** - Never expose `VAPID_PRIVATE_KEY` to client
2. **Subscription Validation** - Always validate subscription JSON before parsing
3. **User Consent** - Only send to users who explicitly enabled notifications
4. **Rate Limiting** - Don't spam users; respect notification frequency preferences
5. **Payload Size** - Keep payloads under 4KB (browser limit)

---

## 8. API Reference

### Convex Actions

```typescript
// Internal action - send notification to a user
internal.pushNotifications.sendPushNotification({
  userId: Id<"users">,
  title: string,
  body: string,
  url?: string,
  tag?: string,
})

// Public action - send test notification to self
api.pushNotifications.sendTestPush({})
```

### Convex Queries/Mutations

```typescript
// Get current user's push profile
api.pushSubscriptions.getCurrentUserPushProfile({})
// Returns: { userId, pushSubscription, pushNotificationsEnabled } | null

// Clear subscription (internal)
internal.pushSubscriptions.clearPushSubscription({ userId })
```

---

## References

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web-push npm](https://www.npmjs.com/package/web-push)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Push Event](https://developer.mozilla.org/en-US/docs/Web/API/PushEvent)
