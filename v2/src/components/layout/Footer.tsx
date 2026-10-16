"use client";

/**
 * The footer: three columns of links, then one line for the legal pages, the
 * guide's other languages and the colour theme (Oct 14 2026).
 *
 * A quiet sunken band, the page's own text colours, columns that are always
 * open (two side by side on a phone). Every link comes from `lib/siteMap.ts`,
 * so a page is called here what it's called in the header and its own title.
 *
 * The signed-in app gets one line instead: public data, help, the two legal
 * pages and the changelog.
 *
 * Kept as a client component on purpose: in the RSC payload a client
 * component is a small reference, where a server component is its whole
 * rendered tree, on every page.
 */

import { Fragment } from "react";
import Link from "next/link";

import { LinkedinLogoIcon, XLogoIcon } from "@phosphor-icons/react";
import ThemeToggle from "./ThemeToggle";
import { AnalyticsSwitch } from "./AnalyticsSwitch";
import { NOT_LEGAL_SERVICES, LEGAL_NAME } from "@/lib/constants/about";
import { SOCIAL_LINKS } from "@/lib/constants/externalLinks";
import { LOCALES } from "@/lib/i18n/locales";
import { APP_FOOTER, FOOTER_COLUMNS, FOOTER_LEGAL } from "@/lib/siteMap";

const SOCIAL_ICONS = { twitter: XLogoIcon, linkedin: LinkedinLogoIcon } as const;

const LINK = "text-soft transition-colors hover:text-foreground";

export default function Footer({ audience = "public" }: { audience?: "public" | "app" }) {
  const year = new Date().getFullYear();

  if (audience === "app") {
    return (
      <footer className="border-t border-border bg-muted print:hidden">
        <nav aria-label="Footer" className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 px-4 py-4 text-sm sm:px-6">
          {APP_FOOTER.map((p) => (
            <Fragment key={p.href}>
              <Link href={p.href} className={`flex min-h-11 items-center ${LINK}`}>
                <span className="hover-underline">{p.name}</span>
              </Link>{" "}
            </Fragment>
          ))}
          <span className="ml-auto flex items-center gap-3 text-muted-foreground">
            &copy; {year} {LEGAL_NAME}
            <ThemeToggle />
          </span>
        </nav>
        {/* Every page, every audience: see NOT_LEGAL_SERVICES for why. */}
        <p className="mx-auto max-w-[1440px] px-4 pb-4 text-sm text-muted-foreground sm:px-6">{NOT_LEGAL_SERVICES}</p>
      </footer>
    );
  }

  return (
    // Ink, in both themes: the .dark scope gives it the dark tokens.
    <footer className="dark bg-[#141414] text-foreground print:hidden">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            {/* The brand name links home from every page. */}
            <Link href="/" className="logo-link inline-flex min-h-11 items-center font-heading text-xl font-bold text-foreground">
              <span className="hover-underline">
                <span className="text-primary-text">PERM</span> <span className="logo-word">Tracker</span>
              </span>
            </Link>{" "}
            <p className="mt-3 max-w-xs text-base text-soft">
              Live DOL data for the wait, automatic deadlines for the work. Free for applicants and attorneys.
            </p>{" "}
            <div className="mt-4 flex gap-2">
              {SOCIAL_LINKS.map(({ href, label, icon }) => {
                const Icon = SOCIAL_ICONS[icon];
                return (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-11 items-center justify-center text-soft transition-colors hover:text-foreground"
                  >
                    <Icon className="size-5" />
                  </a>
                );
              })}
            </div>
          </div>{" "}
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-heading text-base font-bold text-foreground">{col.title}</p>{" "}
              <ul className="mt-2">
                {col.pages.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} className={`flex min-h-10 items-center text-base ${LINK}`}>
                      <span className="hover-underline">{p.name}</span>
                    </Link>{" "}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 text-sm">
            {FOOTER_LEGAL.map((p) => (
              <Fragment key={p.href}>
                <Link href={p.href} className={`flex min-h-11 items-center ${LINK}`}>
                  <span className="hover-underline">{p.name}</span>
                </Link>{" "}
              </Fragment>
            ))}
          </nav>{" "}
          {/* The guide for the person waiting, in five languages, each named
              in its own language and marked so a screen reader reads it right. */}
          <nav aria-label="The guide in other languages" className="flex flex-wrap items-center gap-x-4 text-sm">
            {LOCALES.map((l) => (
              <Fragment key={l.code}>
                <a href={l.path} lang={l.tag} hrefLang={l.tag} className={`flex min-h-11 items-center ${LINK}`}>
                  {l.endonym}
                </a>{" "}
              </Fragment>
            ))}
            <ThemeToggle />
          </nav>
        </div>{" "}
        <AnalyticsSwitch />

        <p className="mt-6 max-w-3xl text-sm text-muted-foreground">{NOT_LEGAL_SERVICES}</p>{" "}
        <p className="mt-2 text-sm text-muted-foreground">
          &copy; {year} {LEGAL_NAME}
        </p>
      </div>
    </footer>
  );
}
