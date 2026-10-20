/**
 * A signed-in visitor who chose "Save as a case" under the deadline calculator
 * reaches /signup or /login with the dates in the address. The proxy sends them
 * straight to the new-case form with those dates, and everyone else signed in
 * to the dashboard as before. Drives src/proxy.ts with a stand-in for Convex
 * Auth's middleware that calls the proxy's handler, signed in.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("convex/nextjs", () => ({ fetchMutation: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsMiddleware:
    (handler: (r: NextRequest, ctx: unknown) => Promise<Response | undefined>) => async (request: NextRequest) =>
      (await handler(request, { convexAuth: { isAuthenticated: async () => true } })) ?? NextResponse.next(),
  createRouteMatcher: (paths: string[]) => (request: NextRequest) => paths.includes(new URL(request.url).pathname),
  // The real helper: the route's own path and query replace the request's.
  nextjsMiddlewareRedirect: (request: NextRequest, route: string) => {
    const url = request.nextUrl.clone();
    const parsed = new URL(route, "http://dummy");
    url.pathname = parsed.pathname;
    url.search = parsed.search;
    return NextResponse.redirect(url);
  },
}));
vi.mock("@/lib/sentry", () => ({ addBreadcrumb: vi.fn() }));

import handler from "@/proxy";

const go = async (path: string) => {
  const res = await handler(new NextRequest(`https://permtracker.app${path}`), {} as never);
  return res?.headers.get("location");
};

describe("a signed-in visitor on the sign-up or sign-in page", () => {
  it("goes to the new-case form with the calculator's dates", async () => {
    expect(await go("/signup?calc=2026-01-15_2026-02-01")).toBe("https://permtracker.app/cases/new?calc=2026-01-15_2026-02-01");
    expect(await go("/login?calc=2026-01-15")).toBe("https://permtracker.app/cases/new?calc=2026-01-15");
  });

  it("goes to the dashboard otherwise, junk dates included", async () => {
    expect(await go("/signup")).toBe("https://permtracker.app/dashboard");
    expect(await go("/login?calc=%2F%2Fevil.example")).toBe("https://permtracker.app/dashboard");
  });
});
