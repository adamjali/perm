/**
 * What a POST to Convex Auth's `/api/auth` is, read from its body, so the
 * site's server can count sign-in attempts per email address before the
 * request reaches Convex.
 *
 * The browser's auth client posts `{ action, args }` (node_modules/@convex-dev/
 * auth/dist/nextjs/client.js): `action` is "auth:signIn" or "auth:signOut", and
 * a password sign-in's `args.params` is the form's fields (email, password or
 * code, flow). A token refresh is "auth:signIn" with `args.refreshToken` and no
 * email; it proves nothing about anyone's password, so it's never counted.
 *
 * Plain module (no server imports), so the proxy and the tests share it.
 */

export type AuthAttemptAction = "login" | "signup" | "otp_verify" | "password_reset";

/** Each Password-provider flow the forms send, and the per-email limit it counts against. */
const FLOW_ACTION: Record<string, AuthAttemptAction> = {
  signIn: "login",
  signUp: "signup",
  "email-verification": "otp_verify",
  reset: "password_reset",
  "reset-verification": "otp_verify",
};

interface AuthBody {
  action?: unknown;
  args?: { refreshToken?: unknown; params?: { email?: unknown; flow?: unknown } | null } | null;
}

/** A token refresh: counted by neither limit. */
export function isTokenRefresh(body: unknown): boolean {
  const b = body as AuthBody | null;
  return !!b && b.action === "auth:signIn" && b.args?.refreshToken !== undefined && b.args?.refreshToken !== null;
}

/** The email and the limit a sign-in, sign-up, code or reset attempt counts against, or null. */
export function authAttemptFromBody(body: unknown): { email: string; action: AuthAttemptAction } | null {
  if (!body || typeof body !== "object" || isTokenRefresh(body)) return null;
  const b = body as AuthBody;
  if (b.action !== "auth:signIn") return null;
  const params = b.args?.params;
  if (!params || typeof params.email !== "string" || typeof params.flow !== "string") return null;
  const action = FLOW_ACTION[params.flow];
  const email = params.email.trim().toLowerCase();
  if (!action || !email || email.length > 254) return null;
  return { email, action };
}
