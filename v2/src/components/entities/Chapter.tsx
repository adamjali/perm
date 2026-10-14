import type { ReactNode } from "react";

import { PageSection } from "@/components/data/PageSection";

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
    <PageSection id={id} title={title} lede={dek} className={className}>
      {children}
    </PageSection>
  );
}
