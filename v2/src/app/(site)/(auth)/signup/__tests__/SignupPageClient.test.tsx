import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * A refused sign-up says nothing about whether the address has an account (Nov 4 2026).
 *
 * In production Convex masks Convex Auth's "Account <email> already exists" as a bare "[Request ID: ...] Server
 * Error", the same words every other server failure gets. The page used to answer any masked error with "This
 * email already has an account", which told anyone typing an address whether it held one, and was wrong for every
 * other failure. Both now get one neutral sentence with the ways in for someone who has an account, each keeping
 * the page to come back to; a rate limit or a dropped connection still gets its own words, checked first; and a
 * refusal is one PostHog event and a breadcrumb, never a Sentry issue per press.
 */

const { signIn, capture, captureError, toastError } = vi.hoisted(() => ({
  signIn: vi.fn(),
  capture: vi.fn(),
  captureError: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn }) }));
vi.mock("convex/react", () => ({
  useAction: () => vi.fn().mockResolvedValue({ success: true, pass: "one-time-pass" }),
  useMutation: () => vi.fn().mockResolvedValue(null),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/signup" }));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: toastError, warning: vi.fn() },
  updateToastAuthState: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ analytics: { capture } }));
vi.mock("@/lib/sentry", () => ({ captureError, addBreadcrumb: vi.fn() }));
// The real widget loads Cloudflare's script; this one passes the check as soon as it mounts.
vi.mock("@/components/auth/AuthTurnstile", () => ({
  AuthTurnstile: ({ onVerify }: { onVerify: (token: string) => void }) => {
    useEffect(() => onVerify("turnstile-token"), [onVerify]);
    return null;
  },
}));

import { SignupPageClient } from "../SignupPageClient";

const MASKED = "[CONVEX A(auth:signIn)] [Request ID: 51c34f59011c0f6b] Server Error";

async function submitWith(error: Error) {
  signIn.mockRejectedValueOnce(error);
  render(<SignupPageClient />);
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText(/^Password/, { selector: "input" }), {
    target: { value: "a-long-password" },
  });
  const button = await screen.findByRole("button", { name: "Create account" });
  fireEvent.click(button);
  await waitFor(() => expect(signIn).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/signup?next=%2Fcases%2Fabc");
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("a refused sign-up", () => {
  it.each([
    ["a masked server error", new Error(MASKED), "masked"],
    ["Convex Auth's own 'already exists'", new Error("Account person@example.com already exists"), "exists"],
  ])("answers %s with the neutral sentence and the ways in", async (_label, error, kind) => {
    await submitWith(error);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "We couldn't create that account. If you already have one, sign in or reset your password.",
    );
    expect(alert.textContent).not.toMatch(/already has an account/i);
    const signInLink = screen.getByRole("link", { name: "sign in" });
    const resetLink = screen.getByRole("link", { name: "reset your password" });
    expect(signInLink.getAttribute("href")).toBe("/login?next=%2Fcases%2Fabc");
    expect(resetLink.getAttribute("href")).toBe("/reset-password?next=%2Fcases%2Fabc");

    expect(capture).toHaveBeenCalledWith("signup_refused", { kind });
    expect(capture.mock.calls.filter(([name]) => name === "signup_refused")).toHaveLength(1);
    expect(captureError).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("keeps a rate limit's own words, checked before the refusal", async () => {
    await submitWith(new Error("Too many attempts. Try again in 10 minutes."));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(capture).not.toHaveBeenCalledWith("signup_refused", expect.anything());
  });

  it("keeps a dropped connection's own words", async () => {
    await submitWith(new TypeError("Failed to fetch"));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Network error/)));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
