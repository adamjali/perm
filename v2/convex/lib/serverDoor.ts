/**
 * Functions that only the site's own server may call. The server sends
 * API_SERVER_SECRET (set on this deployment and on the server) with each call;
 * a stranger calling Convex directly can't. Unset means shut, never open.
 * Compared in time that doesn't depend on where the strings differ.
 */
export function serverDoorOpen(given: string | undefined): boolean {
  const want = process.env.API_SERVER_SECRET ?? "";
  const got = given ?? "";
  if (want.length < 16 || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
