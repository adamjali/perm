import type { ReactNode } from "react";

import { PageSection } from "@/components/data/PageSection";
import { cn } from "@/lib/utils";

/**
 * One named part of a long entity page: a page section whose id the "On this
 * page" row links to.
 */
export function Chapter({
  id,
  title,
  dek,
  children,
  className,
}: {
  id: string;
  title: string;
  dek?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // html already pads anchors by the header; this adds the sticky part bar (about 52px).
    <PageSection id={id} title={title} lede={dek} className={cn("scroll-mt-14", className)}>
      {children}
    </PageSection>
  );
}
