import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CalculatorIcon,
  CalendarIcon,
  ClockIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
} from "@phosphor-icons/react/ssr";

import { NotFoundSuggestions } from "@/components/search/NotFoundSuggestions";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";

const DOORS = [
  { href: "/", label: "Home", Icon: HouseIcon },
  { href: "/for-attorneys", label: "For attorneys", Icon: BriefcaseIcon },
  { href: "/case-search", label: "Search every filing", Icon: MagnifyingGlassIcon },
  { href: "/perm-processing-times", label: "Processing times", Icon: ClockIcon },
  { href: "/perm-employers", label: "Find an employer", Icon: BuildingsIcon },
  { href: "/visa-bulletin", label: "The visa bulletin", Icon: CalendarIcon },
  { href: "/calculators", label: "Calculators", Icon: CalculatorIcon },
  { href: "/guides", label: "Guides", Icon: NewspaperIcon },
] as const;

/**
 * What every 404 says: the case-number box, a "did you mean" read from the
 * address that missed, and the places people most often mean. Shared by the
 * root 404 (which draws the site's header and footer itself) and the site's
 * own 404 (which sits inside them).
 */
export function NotFoundBody() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <p className="text-sm text-muted-foreground">Error 404</p>{" "}
      <h1 className="mt-2 font-heading text-3xl font-bold">Page not found</h1>{" "}
      <p className="mt-3 max-w-xl text-base leading-relaxed text-soft">
        This page doesn&apos;t exist or has moved. If you were after a case, put its number here.
      </p>{" "}
      <div className="object mt-6 p-5 sm:p-6">
        <CaseLookupForm className="max-w-xl" label="Case number" compact source="not-found" help={null} />{" "}
        <NotFoundSuggestions />
      </div>{" "}

      <h2 className="mt-12 font-heading text-xl font-bold">Or go to</h2>{" "}
      <ul className="mt-4 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-2">
        {DOORS.map((d) => (
          <Fragment key={d.href}>
            <li>
              <Link
                href={d.href}
                className="lift flex min-h-[56px] items-center gap-3 border-2 border-border bg-card px-4 font-semibold shadow-hard-sm hover:bg-accent"
              >
                <d.Icon aria-hidden="true" className="size-5 shrink-0 text-primary-text" />{" "}
                <span className="flex-1">{d.label}</span>{" "}
                <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>{" "}
          </Fragment>
        ))}
      </ul>
    </div>
  );
}
