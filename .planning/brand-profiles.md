# Brand profiles to create, ranked (Oct 9 2026)

Search engines decide which pages belong to one company partly from the `sameAs` list in the
site's structured data: other pages around the web that say "this is PERM Tracker at
permtracker.app". "PERM Tracker" is close to a generic name, and a rival uses nearly the same
one, so the more of these exist, the better Google can tell us apart.

**Checked Oct 9 2026:** the structured data is correct. The Organization lists two profiles,
the Medium publication and the Product Hunt page, both brand-owned, and Sabrina's Person node
lists her LinkedIn. The rest (legal name, address, email, logo, founding date, founder) is
filled, and every reference resolves on the homepage, /about, employer pages and articles.
Ruled out: the Senja page (a form for leaving a testimonial) and the Glama MCP listing (a
directory's automatic copy of the MCP Registry entry). The gap is that the brand owns only
two profiles.

Each item below is an account the owner creates. When one exists, its link goes into
`ORGANIZATION_SAME_AS` in `v2/src/lib/constants/about.ts` (brand-owned profiles only;
`structuredData.test.ts` holds that rule).

| # | Profile | Why, and what it needs |
|---|---|---|
| 1 | LinkedIn company page | The strongest single signal for a company. Needs a personal LinkedIn as its admin; admins aren't shown publicly. |
| 2 | X or Bluesky brand account | Also unblocks the social-post scaffold, which is waiting on credentials. |
| 3 | GitHub organization, then move the repo into it | Lets the repo go back into `sameAs` without the persona's handle. The cron dispatch token is scoped to the current repo and must be re-scoped; GitHub redirects the old URL. |
| 4 | Crunchbase profile | Free, and quoted as a source about companies. |
| 5 | Chrome Web Store, npm and PyPI listings | They qualify once published; all wait on the LLC rename, the EIN and the bank account. The rename also changes `LEGAL_NAME`; the brand name stays. |
| 6 | Sabrina's state bar profile and firm bio, on her Person node | The strongest proof she's a real attorney, but both link her to her firm in public. Her call, asked together with the photo question. |

**Skip for now: Wikidata.** It keeps entries about things independent sources have written
about; one made by us without those sources tends to be deleted.
