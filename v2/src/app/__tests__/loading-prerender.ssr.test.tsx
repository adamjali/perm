/**
 * @vitest-environment node
 *
 * Next prerenders every loading.tsx at BUILD time, where there is no URL. A
 * loading state that reads the query string outside a Suspense boundary fails
 * the production build ("useSearchParams() should be wrapped in a suspense
 * boundary"), and nothing before the build notices: the Sep 30 2026 deploy
 * failed exactly so on /perm-case-status. The mock throws the way Next's
 * bailout does, so a loading state that reaches it outside a boundary fails
 * here, in seconds, instead of in the deploy.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToReadableStream } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    throw new Error("BAILOUT_TO_CLIENT_SIDE_RENDERING: useSearchParams()");
  },
  usePathname: () => "/",
  useParams: () => ({}),
  useRouter: () => ({ push() {}, replace() {}, back() {}, prefetch() {}, refresh() {} }),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
  redirect: () => {},
  notFound: () => {},
}));

// Next renders a loading state inside its layouts, so the (authenticated)
// layout's auth context is there at build time. Stand it in, idle.
vi.mock("@/lib/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuthContext: () => ({
    authState: "idle",
    isSigningOut: false,
    beginSignOut() {},
    completeSignOut() {},
    cancelSignOut() {},
  }),
}));

// And its Convex provider, where every query is still loading at build time.
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuery: () => undefined,
  useQueries: () => ({}),
  useMutation: () => async () => null,
  useAction: () => async () => null,
  useConvex: () => ({}),
  useConvexAuth: () => ({ isLoading: true, isAuthenticated: false }),
  usePaginatedQuery: () => ({ results: [], status: "LoadingFirstPage", isLoading: true, loadMore() {} }),
}));

const loaders = import.meta.glob<{ default: ComponentType }>("../**/loading.tsx");

describe("loading.tsx files prerender without a URL", () => {
  it("found the loading files", () => {
    expect(Object.keys(loaders).length).toBeGreaterThanOrEqual(8);
  });

  it.each(Object.keys(loaders))("%s", { timeout: 60_000 }, async (path) => {
    const mod = await loaders[path]!();
    // A throw outside every Suspense boundary rejects the shell, which is
    // what fails the build; one inside a boundary only renders its fallback.
    const stream = await renderToReadableStream(createElement(mod.default), { onError: () => {} });
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html.length).toBeGreaterThan(0);
  });
});
