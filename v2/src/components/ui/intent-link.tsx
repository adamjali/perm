"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A link in the page's frame (header, footer, data rail, breadcrumbs) that
 * pre-loads its page once a reader shows intent: the pointer over it, a touch,
 * or keyboard focus. A plain `<Link>` pre-loads the moment it scrolls into
 * view, and the frame shows dozens of links on every page: on Oct 21 2026 one
 * employer page view pre-loaded 20 to 40 of them, and pre-loads were 29% of
 * everything the server answered. Next has no hover-only setting
 * (`prefetch={false}` turns hover off too), so this is the pattern its docs
 * give: pre-loading stays off until the first sign of intent, then it's the
 * default again. Links in a page's own content keep the default.
 */
export function IntentLink({ prefetch, onMouseEnter, onTouchStart, onFocus, ...rest }: ComponentProps<typeof Link>) {
  const [armed, setArmed] = useState(false);
  return (
    <Link
      {...rest}
      prefetch={armed ? (prefetch ?? null) : false}
      onMouseEnter={(e) => {
        setArmed(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setArmed(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setArmed(true);
        onFocus?.(e);
      }}
    />
  );
}
