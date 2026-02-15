"use client";

import dynamic from "next/dynamic";

const ScrollToTop = dynamic(
  () =>
    import("./scroll-to-top").then((m) => ({ default: m.ScrollToTop })),
  { ssr: false },
);

export function LazyScrollToTop() {
  return <ScrollToTop />;
}
