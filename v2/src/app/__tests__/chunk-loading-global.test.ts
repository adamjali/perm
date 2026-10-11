import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Each deployment's client chunks register in a list of their own, so files
 * from an older build loaded into a page (from stored navigation data) can't
 * replace or hide the live build's modules. See chunkLoadingGlobal in
 * next.config.ts and Sentry 4Y and 53.
 */

vi.mock("@sentry/nextjs", () => ({ withSentryConfig: (c: unknown) => c }));
vi.mock("@serwist/next", () => ({ default: () => (c: unknown) => c }));
vi.mock("@next/bundle-analyzer", () => ({ default: () => (c: unknown) => c }));

type Hook = (config: { output: Record<string, unknown>; optimization: Record<string, unknown> }, ctx: { isServer: boolean }) => {
  output: Record<string, unknown>;
};

async function run(isServer: boolean) {
  const config = (await import("../../../next.config")).default as { webpack: Hook };
  return config.webpack({ output: {}, optimization: {} }, { isServer }).output.chunkLoadingGlobal;
}

describe("the client chunk list is named for the deployment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the deployment id, made safe as a name", async () => {
    vi.stubEnv("DEPLOYMENT_ID", "9c8ea9c0bee3114e9bb3dfc144033d794d34612e-100");
    expect(await run(false)).toBe("webpackChunk_N_E_9c8ea9c0bee3114e9bb3dfc144033d794d34612e_100");
  });

  it("differs between two deployments of the same commit", async () => {
    vi.stubEnv("DEPLOYMENT_ID", "9c8ea9c0bee3-100");
    const first = await run(false);
    vi.stubEnv("DEPLOYMENT_ID", "9c8ea9c0bee3-101");
    expect(await run(false)).not.toBe(first);
  });

  it("keeps webpack's default without a deployment id (dev and tests)", async () => {
    vi.stubEnv("DEPLOYMENT_ID", "");
    expect(await run(false)).toBe("webpackChunk_N_E");
  });

  it("leaves the server build alone", async () => {
    vi.stubEnv("DEPLOYMENT_ID", "9c8ea9c0bee3-100");
    expect(await run(true)).toBeUndefined();
  });
});
