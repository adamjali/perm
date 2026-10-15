import Link from "next/link";
import { Fragment } from "react";

export interface AppBreadcrumbStep {
  href: string;
  label: string;
}

/**
 * The trail above a signed-in page's title: links back up, then where you
 * are. One thin line of plain links, the same on every case page.
 */
export function AppBreadcrumb({ steps, current }: { steps: AppBreadcrumbStep[]; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {steps.map((step) => (
          <Fragment key={step.href}>
            <li className="min-w-0">
              <Link href={step.href} className="link block truncate" title={step.label}>
                {step.label}
              </Link>
            </li>{" "}
            <li aria-hidden="true" className="text-muted-foreground">
              /
            </li>{" "}
          </Fragment>
        ))}
        <li aria-current="page" className="min-w-0 truncate text-muted-foreground">
          {current}
        </li>
      </ol>
    </nav>
  );
}
