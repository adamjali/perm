# Translated data pages (owner's call, Oct 28 2026)

Owner, Wed Oct 28 2026, 4:22 PM EDT: "translating do in the most proper way least work easiest etc industry
standard best practices and test e2e and qa". Its own release after the Oct 28 catch-up release (his 4:1x PM
answer: "Its own release, next"). Branch `i18n/data-pages`; nothing reaches main before his review.

## What readers need (PostHog, 30 days to Oct 28 2026)
People by browser language: English 92,273; Chinese 3,504; Spanish 2,048; Portuguese 1,115; Vietnamese 670;
Korean 229 (about 7.5% of readers for the five). Pages those five open: employer pages 4,176 people, law firm
pages 1,470, case status 746, employer list 440, homepage 398, case search 333; everything else under 225.
Order of work: case status (their own case, the highest stakes), homepage, the employer page frame.

## Structure (Next.js App Router's own i18n pattern; no new package)
- **Addresses:** English stays at the root. A translation lives under the language: `/es/perm-case-status`,
  `/zh/...`, `/pt-br/...`, `/ko/...`, `/vi/...`. One `[lang]` segment per page (`src/app/(site)/(public)/[lang]/
  <page>/page.tsx`), `generateStaticParams` over `LOCALES`, `dynamicParams = false`. The static `/es` guide
  pages keep their own folders.
- **Words:** one typed message module per page or part (`*.messages.ts`): `Record<Lang, Messages>` with
  `satisfies`, so a language missing a string fails the typecheck. English lives in the same module, so the
  English page reads the same keys and can't drift from the translations.
- **Which language:** server components take a `lang` prop (default `"en"`), passed down from the `[lang]`
  page; client components read `useLang()` from `LangProvider`, which the `[lang]` layout sets. (A
  request-scoped store was the first plan; an explicit prop was chosen because a store set by the page isn't
  reliably set before a shared layout renders.) **A client component receives the language, never message
  functions:** a server component can't pass a function to a client one, and doing so (DataProvenance to
  CiteThis, fixed Oct 28 2026) turned every translated case page into the error screen. The browser flow
  "the case page answers in <lang>" catches it.
- **Formatting:** dates and numbers through `Intl` in the locale's `intl` tag; never hand-built strings.
- **What stays as printed:** DOL's and State's own words (statuses, form names, case numbers, cutoffs), each
  glossed in the reader's language the first time. Employer, firm and job names stay as DOL prints them.
- **Search engines:** hreflang both ways for each translated page (`alternates.languages`), x-default English;
  the sitemap lists the alternates. `lang` on the content and on `<html>` (`PageLanguage`).
- **Switcher:** the footer's language links go to the same page in that language when it exists, else that
  language's guide.
- **Honesty:** every translated page says it was machine-translated and not reviewed by a native speaker, and
  links the English page as the authority.

## Done means, per page
Typecheck (all five languages complete), a render test per language, a Playwright flow (look a case up in
Spanish), axe at 390 and 1440 in both themes, the phone sweep, glued text, headings, screenshots read at full
size, hreflang reciprocal (test), sitemap entries, the switcher.

## Before any translated page goes live (blockers)

- **The lookup's protections must cover the translated addresses.** Cloudflare's rule 1 (Meta) and rule 4
  (the browser check and 20 a minute per address) and nginx's lookup cap (`pt_lookup_conn`, 24 of the app's 64
  slots, and the scraper label's 30 a minute) match `/perm-case-status` exactly, so `/es/perm-case-status?case=`
  and the four others would ask DOL live with none of them. Before shipping: widen each rule to
  `/(es|zh|pt-br|ko|vi)/perm-case-status`, extend `test_nginx_conf.py` with a probe per language, and read each
  rule back live (Oct 28 2026, found writing the browser flows).
- **The owner's review**: screenshots of each language, light and dark, desktop and phone.
