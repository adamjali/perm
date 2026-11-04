import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BulletinPushAlert } from "../BulletinPushAlert";
import { CasePushAlert } from "../CasePushAlert";

/**
 * The browser-notification box, for a case and for a bulletin line: one component. On an iPhone not yet
 * installed to the home screen (where iOS delivers no site notifications), it says how instead of hiding.
 */

const ua = (s: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(s);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-key");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("BrowserPushAlert", () => {
  it("tells an iPhone reader to add the site to the home screen first", async () => {
    ua("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1");
    render(<BulletinPushAlert category="EB2" country="india" />);
    expect(await screen.findByText(/add PERM Tracker to your home screen first/)).toBeTruthy();
    expect(screen.getByText("Or a browser notification each new bulletin")).toBeTruthy();
  });

  it("says nothing about the home screen elsewhere, and the case box keeps its own words", async () => {
    ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0 Safari/537.36");
    // A desktop browser with the push API: a service worker container and PushManager.
    Object.defineProperty(window, "PushManager", { value: function PushManager() {}, configurable: true });
    if (!("serviceWorker" in navigator)) Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
    render(<CasePushAlert caseNumber="G-100-26020-571111" />);
    expect(await screen.findByText("Or a browser notification")).toBeTruthy();
    expect(screen.queryByText(/home screen first/)).toBeNull();
  });
});
