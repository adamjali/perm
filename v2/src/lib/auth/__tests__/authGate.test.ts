/**
 * The sign-in limits run before Convex Auth's middleware. Its middleware
 * answers /api/auth itself before calling the proxy's own handler, so the
 * per-IP check that used to sit inside that handler never ran (production held
 * no per-IP sign-in row, Oct 10 2026). These drive src/proxy.ts with a stand-in
 * for that middleware which answers /api/auth the same way.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const fetchMutation = vi.fn();
const innerAuth = vi.fn();
vi.mock("convex/nextjs", () => ({ fetchMutation: (...a: unknown[]) => fetchMutation(...a) }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  // Like the real one: /api/auth is answered here, and the handler is never called for it.
  convexAuthNextjsMiddleware: () => async (request: NextRequest) => {
    innerAuth(await request.json().catch(() => "unreadable"));
    return NextResponse.json({ tokens: null });
  },
  createRouteMatcher: (paths: string[]) => (request: NextRequest) => paths.includes(new URL(request.url).pathname),
  nextjsMiddlewareRedirect: vi.fn(),
}));
vi.mock("@/lib/sentry", () => ({ addBreadcrumb: vi.fn() }));

import { authAttemptFromBody, isTokenRefresh } from "../authAttempt";
import { authRateLimitText, emailLimitText } from "../rateLimitText";
import handler from "@/proxy";

const post = (body: unknown) =>
  new NextRequest("https://permtracker.app/api/auth", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-real-ip": "203.0.113.7" },
  });
const signIn = (email = "Person@Example.com", flow = "signIn") => ({
  action: "auth:signIn",
  args: { provider: "password", params: { email, password: "hunter2", flow } },
});
const event = {} as never;
const allowed = { allowed: true, remaining: 10, retryAfterMs: 0 };

beforeEach(() => {
  vi.stubEnv("API_SERVER_SECRET", "server-secret-for-tests-0123456789");
  fetchMutation.mockReset().mockResolvedValue(allowed);
  innerAuth.mockReset();
});

describe("what a sign-in POST counts against", () => {
  it("maps each form's flow to its limit, with the address normalised", () => {
    expect(authAttemptFromBody(signIn())).toEqual({ email: "person@example.com", action: "login" });
    expect(authAttemptFromBody(signIn("a@b.co", "signUp"))?.action).toBe("signup");
    expect(authAttemptFromBody(signIn("a@b.co", "email-verification"))?.action).toBe("otp_verify");
    expect(authAttemptFromBody(signIn("a@b.co", "reset"))?.action).toBe("password_reset");
    expect(authAttemptFromBody(signIn("a@b.co", "reset-verification"))?.action).toBe("otp_verify");
  });

  it("counts nothing for a token refresh, a Google sign-in, a sign-out or junk", () => {
    const refresh = { action: "auth:signIn", args: { refreshToken: "rt" } };
    expect(isTokenRefresh(refresh)).toBe(true);
    expect(authAttemptFromBody(refresh)).toBeNull();
    expect(authAttemptFromBody({ action: "auth:signIn", args: { provider: "google" } })).toBeNull();
    expect(authAttemptFromBody({ action: "auth:signOut", args: {} })).toBeNull();
    expect(authAttemptFromBody(signIn("a@b.co", "made-up"))).toBeNull();
    expect(authAttemptFromBody(null)).toBeNull();
    expect(authAttemptFromBody("x")).toBeNull();
  });
});

describe("the proxy, before Convex Auth", () => {
  it("counts a sign-in by IP and by address, with the server secret, then hands the same body on", async () => {
    const res = await handler(post(signIn()), event);
    expect(res?.status).toBe(200);
    const calls = fetchMutation.mock.calls.map((c) => c[1] as Record<string, unknown>);
    expect(calls[0]).toMatchObject({ ip: "203.0.113.7", action: "ip_auth", serverSecret: "server-secret-for-tests-0123456789" });
    expect(calls[1]).toMatchObject({ email: "person@example.com", action: "login", serverSecret: "server-secret-for-tests-0123456789" });
    expect(innerAuth).toHaveBeenCalledWith(signIn());
  });

  it("refuses an address over its limit before Convex Auth sees the attempt", async () => {
    fetchMutation.mockResolvedValueOnce(allowed).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 4 * 60_000 });
    const res = await handler(post(signIn()), event);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("240");
    const body = (await res!.json()) as { error: string };
    expect(body.error).toBe(emailLimitText(4 * 60_000));
    // The form shows that sentence as it is.
    expect(authRateLimitText(body.error)).toBe(body.error);
    expect(innerAuth).not.toHaveBeenCalled();
  });

  it("refuses an address over the IP limit, and never asks the per-address limit", async () => {
    fetchMutation.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 60_000, message: "Too many requests from your IP." });
    const res = await handler(post(signIn()), event);
    expect(res?.status).toBe(429);
    expect(fetchMutation).toHaveBeenCalledTimes(1);
    expect(innerAuth).not.toHaveBeenCalled();
  });

  it("lets a token refresh straight through, counted by neither", async () => {
    const res = await handler(post({ action: "auth:signIn", args: { refreshToken: "rt" } }), event);
    expect(res?.status).toBe(200);
    expect(fetchMutation).not.toHaveBeenCalled();
    expect(innerAuth).toHaveBeenCalled();
  });

  it("fails open when the counts can't be made", async () => {
    fetchMutation.mockRejectedValue(new Error("convex down"));
    const res = await handler(post(signIn()), event);
    expect(res?.status).toBe(200);
    expect(innerAuth).toHaveBeenCalled();
  });
});
