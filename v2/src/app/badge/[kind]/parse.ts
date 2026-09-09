import { BADGE_THEMES, badgeDef, type BadgeStyle, type BadgeTheme } from "@/lib/badge";

/**
 * IN ITS OWN MODULE BECAUSE A `route.ts` MAY NOT EXPORT ANYTHING ELSE. Next
 * generates a type for every route file constraining its exports to the known
 * handler names, so an extra `export function parseBadgePath` fails the build
 * with "Property 'parseBadgePath' is incompatible with index signature ... not
 * assignable to type 'never'". That is a TYPE-GENERATION error: it does not
 * appear in `pnpm typecheck` or in `next dev`, only in `next build`, after a
 * full compile. Colocated the same way `api/revalidate-dol/paths.ts` is.
 */

/** Splits `kind[.style][.theme]` with the canonical defaults, or null. */
export function parseBadgePath(raw: string): { kind: string; style: BadgeStyle; theme: BadgeTheme } | null {
  const [kind, a, b] = raw.replace(/\.svg$/, "").split(".");
  if (!kind) return null;
  const def = badgeDef(kind);
  if (!def) return null;

  const style = (a ?? def.styles[0]) as BadgeStyle;
  const theme = (b ?? "dark") as BadgeTheme;

  // A style the figure does not support is a 404, not a fallback. Silently
  // serving a shield where a bar was asked for would leave the requester
  // believing they had embedded something they had not.
  if (!def.styles.includes(style)) return null;
  if (!BADGE_THEMES.includes(theme)) return null;
  return { kind, style, theme };
}
