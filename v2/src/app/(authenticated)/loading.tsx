import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading boundary for the whole authenticated group.
 *
 * THE OTHER HALF OF THE HEADER FLASH, and the one every single user hits.
 * Sign-in and sign-up both finish with `router.push("/dashboard")` — a CLIENT
 * navigation across the `(auth)` -> `(authenticated)` layout boundary. Neither
 * group had a boundary here, so the router held the `(auth)` tree painted for
 * the entire RSC round-trip: the black `AuthHeader` with Home / Data / Learn /
 * Sign In stayed on screen, then was replaced by the authenticated `Header`
 * with Dashboard / Cases / Calendar / Timeline and the user menu.
 *
 * Two different headers, one after the other, on the single most-travelled
 * transition in the product.
 *
 * This fallback renders INSIDE the authenticated layout, so the correct header
 * and footer paint immediately and only `<main>` shows placeholder. The
 * per-route `loading.tsx` files (dashboard, cases, calendar, timeline,
 * notifications) still handle navigation BETWEEN authenticated pages, where
 * this layout does not re-render; the two do not compete.
 *
 * The shape matches the PageHeading rhythm every authenticated page now opens
 * with — eyebrow, display title, lede — so the header does not jump when the
 * real page arrives.
 */
export default function AuthenticatedLoading() {
  return (
    <div className="space-y-6">
      {/* Page heading: eyebrow, title, lede */}
      <div className="min-w-0">
        <Skeleton variant="line" className="mb-2 h-4 w-32" />
        <Skeleton variant="line" className="h-10 w-64" />
        <Skeleton variant="line" className="mt-3 h-5 w-full max-w-[52ch]" />
      </div>

      {/* First content block */}
      <Skeleton variant="block" className="h-48" />

      {/* A two-up row, mobile track declared so the items cannot be sized by
          their own content on WebKit. */}
      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-2">
        <Skeleton variant="block" className="h-64" />
        <Skeleton variant="block" className="h-64" />
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}
