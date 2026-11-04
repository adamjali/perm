/**
 * The proxy's half of coming back to the page that asked for sign-in (src/lib/auth/returnTo.ts): a signed-out
 * visitor on an app page is sent to sign-in with that page in `?next=`, and a signed-in one on the sign-in page
 * goes to that page. An email link to /admin#reviews had ended on the dashboard (Nov 4 2026). Drives
 * src/proxy.ts with a stand-in for Convex Auth's middleware, as proxyCarried.test.ts does.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

let signedIn = false;

vi.mock("convex/nextjs", () => ({ fetchMutation: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsMiddleware:
    (handler: (r: NextRequest, ctx: unknown) => Promise<Response | undefined>) => async (request: NextRequest) =>
      (await handler(request, { convexAuth: { isAuthenticated: async () => signedIn } })) ?? NextResponse.next(),
  createRouteMatcher: (paths: string[]) => (request: NextRequest) => {
    const path = new URL(request.url).pathname;
    return paths.some((p) => (p.endsWith("(.*)") ? path.startsWith(p.slice(0, -4)) : path === p));
  },
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
  return res?.headers.get("location") ?? null;
};

beforeEach(() => {
  signedIn = false;
});

describe("a signed-out visitor on an app page", () => {
  it("is sent to sign-in with the page and its query to come back to", async () => {
    expect(await go("/admin")).toBe("https://permtracker.app/login?next=%2Fadmin");
    expect(await go("/cases/abc123?tab=timeline")).toBe("https://permtracker.app/login?next=%2Fcases%2Fabc123%3Ftab%3Dtimeline");
    expect(await go("/settings?tab=notifications")).toBe("https://permtracker.app/login?next=%2Fsettings%3Ftab%3Dnotifications");
  });

  it("gets plain sign-in from a protected API route", async () => {
    expect(await go("/api/chat")).toBe("https://permtracker.app/login");
  });
});

describe("a signed-in visitor on the sign-in page", () => {
  it("goes to the page that asked, else the dashboard", async () => {
    signedIn = true;
    expect(await go("/login?next=%2Fadmin")).toBe("https://permtracker.app/admin");
    expect(await go("/login?next=%2F%2Fevil.example")).toBe("https://permtracker.app/dashboard");
    expect(await go("/login")).toBe("https://permtracker.app/dashboard");
  });
});
