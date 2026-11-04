/**
 * The installed app opens /start (src/app/manifest.ts): a signed-in attorney goes to the dashboard, anyone else
 * to the homepage. It had opened /dashboard for everyone, so an iPhone reader who added a page to the home
 * screen for its notifications met the sign-in page.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const signedIn = { value: true };
vi.mock("convex/nextjs", () => ({ fetchMutation: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsMiddleware:
    (handler: (r: NextRequest, ctx: unknown) => Promise<Response | undefined>) => async (request: NextRequest) =>
      (await handler(request, { convexAuth: { isAuthenticated: async () => signedIn.value } })) ?? NextResponse.next(),
  createRouteMatcher: (paths: string[]) => (request: NextRequest) => paths.includes(new URL(request.url).pathname),
  nextjsMiddlewareRedirect: (request: NextRequest, route: string) => {
    const url = request.nextUrl.clone();
    url.pathname = new URL(route, "http://dummy").pathname;
    url.search = "";
    return NextResponse.redirect(url);
  },
}));
vi.mock("@/lib/sentry", () => ({ addBreadcrumb: vi.fn() }));

import handler, { config } from "@/proxy";
import manifest from "@/app/manifest";

const go = async (path: string) => (await handler(new NextRequest(`https://permtracker.app${path}`), {} as never))?.headers.get("location");

describe("the installed app's opening page", () => {
  it("opens /start, which the proxy runs on", () => {
    expect(manifest().start_url).toBe("/start");
    expect(config.matcher).toContain("/start");
  });

  it("sends a signed-in attorney to the dashboard and anyone else to the homepage", async () => {
    signedIn.value = true;
    expect(await go("/start")).toBe("https://permtracker.app/dashboard");
    signedIn.value = false;
    expect(await go("/start")).toBe("https://permtracker.app/");
  });
});
