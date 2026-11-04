/**
 * The sign-up form's server checks, reached through the Password provider's own options. Production masks
 * a plain Error as "Server Error", which the sign-up page reads as "this email already has an account", so
 * every refusal here must be a ConvexError that keeps its words (Nov 4 2026: a refused name said the
 * wrong thing).
 */
import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";

const captured: { options?: Record<string, (...a: never[]) => unknown> } = {};

vi.mock("@convex-dev/auth/providers/Password", () => ({
  Password: (options: Record<string, (...a: never[]) => unknown>) => {
    captured.options = options;
    return { id: "password" };
  },
}));
vi.mock("@convex-dev/auth/server", () => ({
  convexAuth: () => ({ auth: {}, signIn: {}, signOut: {}, store: {}, isAuthenticated: {} }),
}));
vi.mock("@auth/core/providers/google", () => ({ default: { id: "google" } }));
vi.mock("../ResendOTP", () => ({ ResendOTP: {} }));
vi.mock("../ResendPasswordReset", () => ({ ResendPasswordReset: {} }));

await import("../auth");

const profile = (params: Record<string, unknown>) =>
  (captured.options!.profile as unknown as (p: Record<string, unknown>) => Record<string, unknown>)(params);
const passwordRules = (password: string | undefined) =>
  (captured.options!.validatePasswordRequirements as unknown as (p: string | undefined) => void)(password);

describe("the sign-up form's server checks", () => {
  it("refuses a name the rules don't allow with a ConvexError that keeps its reason", () => {
    let thrown: unknown;
    try {
      profile({ email: "a@example.test", name: "Visit https://spam.example now" });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConvexError);
    expect(String((thrown as ConvexError<string>).data)).not.toBe("");
  });

  it("accepts a real name and lowercases the address", () => {
    expect(profile({ email: " Jane@Example.TEST ", name: "Jane Doe" })).toMatchObject({
      email: "jane@example.test",
      name: "Jane Doe",
    });
  });

  it("refuses a short password with a ConvexError too", () => {
    expect(() => passwordRules("short")).toThrow(ConvexError);
    expect(() => passwordRules(undefined)).not.toThrow();
  });
});
