import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading boundary for the sign-in / sign-up / reset-password group.
 *
 * THIS IS THE HEADER FLASH. `(public)` has had a `loading.tsx` since it was
 * built and `(auth)` never did. Without one, a client navigation to /signup
 * has nothing to render until the whole RSC payload for the new route lands,
 * so Next keeps the PREVIOUS tree painted for that entire round-trip. On the
 * homepage that previous tree is `AuthHeader` in its `isHomePage` branch:
 * section anchors, a Tools link, and BOTH auth buttons. It is then replaced
 * by `AuthHeader` in its other branch: Home, Data, Learn, and Sign In alone.
 *
 * Same component, visibly different header, and the gap between them is
 * exactly one network round-trip. That is why it is intermittent ("sometimes")
 * and why it shows up on sign-up and sign-in specifically.
 *
 * With this file, the router paints the `(auth)` layout the moment navigation
 * starts, so the correct header is up immediately and the page streams into
 * the space below it.
 *
 * The shape below mirrors the real card: heading, lede, four fields, the
 * submit button, the divider, the Google button. It sits inside the layout's
 * own `max-w-md` column, so it needs no width of its own.
 */
export default function AuthLoading() {
  return (
    <div className="w-full border-2 border-border bg-card p-6 shadow-hard">
      {/* Heading + lede */}
      <Skeleton variant="line" className="h-9 w-40" />
      <Skeleton variant="line" className="mt-4 h-5 w-full" />
      <Skeleton variant="line" className="mt-2 h-5 w-4/5" />

      {/* Fields */}
      <div className="mt-8 space-y-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton variant="line" className="h-3 w-28" />
            <Skeleton variant="block" className="h-11" />
          </div>
        ))}
      </div>

      {/* Submit */}
      <Skeleton variant="block" className="mt-6 h-11" />

      {/* Divider + federated button */}
      <Skeleton variant="line" className="mx-auto mt-8 h-3 w-36" />
      <Skeleton variant="block" className="mt-4 h-11" />

      {/* Footer link */}
      <Skeleton variant="line" className="mx-auto mt-8 h-4 w-52" />

      <span className="sr-only">Loading</span>
    </div>
  );
}
