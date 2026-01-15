/**
 * Push Notification Service Worker
 *
 * Handles push notifications for PERM Tracker deadline alerts.
 * Registered separately from main service worker to isolate push functionality.
 *
 * Features:
 * - Push event handling with notification display
 * - Click handling with tab focus/open logic
 * - Action support (View Case, Dismiss)
 * - Vibration pattern for mobile devices
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

// Push event handler - receives push messages from server
self.addEventListener("push", function (event) {
  // Ignore if no data payload
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (error) {
    console.error("[sw-push] Failed to parse push data:", error);
    return;
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "perm-tracker",
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

// Notification click handler - handles user interaction with notification
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  // If dismiss action, do nothing further
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing tab if one is open with the target URL
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new tab if no existing tab found
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close handler (optional - for analytics)
self.addEventListener("notificationclose", function (event) {
  // Could be used for analytics tracking
  console.log("[sw-push] Notification closed:", event.notification.tag);
});
