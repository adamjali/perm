/**
 * The name a support reply greets: the sender's first name from their mail
 * client's display name, else a name read from the address, else "there".
 * The address's whole local part ("jane.doe") reads as a username, not a
 * greeting.
 */
const WORD = /^[\p{L}][\p{L}'’-]*$/u;

function tidy(word: string): string | null {
  const w = word.replace(/^["'(]+|["'),]+$/g, "");
  if (w.length < 2 || !WORD.test(w)) return null;
  // Keep a name typed in mixed case ("McKenna"); fix one typed all in one case.
  if (w === w.toLowerCase() || w === w.toUpperCase()) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }
  return w;
}

export function replyGreetingName(fromName: string | null | undefined, fromEmail: string): string {
  const display = (fromName || "").trim();
  // "Doe, Jane" puts the first name second.
  const parts = display.includes(",") ? display.split(",").slice(1).join(" ").trim().split(/\s+/) : display.split(/\s+/);
  for (const p of parts) {
    const name = tidy(p);
    if (name) return name;
  }
  const local = (fromEmail.split("@")[0] || "").split(/[._+\-0-9]+/)[0] || "";
  return tidy(local) || "there";
}
