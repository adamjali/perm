# Visual parity against permtrack.app

Adam's directive: *"look at every single visual they have and all data, their
charts, graphs, make sure we have matching if not better, EVERY single one, if
not lmk why not."*

Built from the 2026-06-19 teardown (`DETAILED-permtrack.md`, 33 routes and the
full API catalog) plus the 2026-08-24 live delta. Every row is one thing a
visitor can see on their site.

Verdicts are deliberately unkind to us where they should be: **better** means we
show something they cannot, **equal** means a reader would not prefer either,
**missing** means they have it and we do not.

---

## The scoreboard

| | count |
|---|---:|
| better | 9 |
| equal | 7 |
| missing, and we could build it | 2 |
| missing, deliberately, with reason | 4 |

---

## Where we are better

| their visual | ours | why ours wins |
|---|---|---|
| `/timeline` green-card timeline, EB-2/EB-3 by country | `/tools/green-card-timeline` | Drawn to scale, so the imbalance is the first thing you see rather than five equal bullets. The I-140 stage carries USCIS's published time for **every** subtype inline, and the visa-number stage carries this month's cutoffs. Theirs links out. |
| `/visa-bulletin` cutoffs + wait-months history | `/tools/priority-date-calculator` | 36 months of bulletins against their shorter series, and **`C` and `U` are drawn as different colours, not two opacities of one**. Treating `U` as a very old date tells someone they are nearly there in the month their category shut. |
| `/perm-processing-time` monthly avg/median/min/max | `/perm-processing-times` | Three visuals where they have one: the queue position drawn as a **step** (a queue position is a step function; a sloped line claims movement nobody observed), decisions by month, and the PWD backlog. Plus the archive table — DOL overwrites its own page and keeps nothing, so those readings exist here and nowhere else. |
| `stats/decisions-per-day` | `/perm-cases`, weekly decisions chart | **947 days against their 88**, and their own `/api/flags` shows `daily_decisions: false` — the feature is built and switched off in their production. Ours aggregates to weeks so all 947 days stay legible. |
| `/api/stats/data-freshness`, one endpoint | `<DataProvenance>` on all 15 data views | Theirs is a JSON field a developer can fetch. Ours is a sentence on the page: source, data-through date, cadence. Adam's requirement was that a reader "doesn't have to search hunt find it". |
| Decision Date Predictor: one estimated date | `/tools/perm-timeline-calculator` | Ours publishes the **envelope** across every model plus the span in months, with each model listed on its own basis. Their single confident number hides that the public estimators disagree by roughly nine months. The spread is the honest part. |
| `/api/estimate`: a blended A–D letter grade | `/perm-denial-risk` | We publish the measured rates per factor and **refuse the blend**, on the page, above the bars. Their factors are not independent, so one letter reads as precision the data cannot support. |
| `/risks/flags` coefficients, exposed via API | `/perm-denial-risk` | Same numbers, rendered as a visual with the caveat attached rather than left in a JSON response. |
| data recency | — | Ours runs through **2026-06-30**; their `oflc_through` is **2026-03-31**. A full quarter fresher. |

## Where we are equal

| their visual | ours |
|---|---|
| `/cases` searchable browser over the raw DOL corpus | `/perm-cases` CaseBrowser |
| `/salary` wage percentiles by SOC/state/FY | `/perm-wages` |
| `wage-distribution` histogram | `FieldPosition` on the wage pages |
| `/employers` employer profiles | `/perm-employers` + per-employer pages |
| `/attorneys` firm leaderboard | `/perm-attorneys` + per-firm pages |
| `/states` state-level approval and volume | `/perm-by-state` |
| `/occupations` SOC-level approval and volume | `/perm-wages/[slug]`, one page per SOC |

## Missing, and we could build it

| their visual | what it takes | note |
|---|---|---|
| `/i485` queue position by EB + country + priority date, with snapshots and a trend | USCIS's I-485 inventory data, ingested and stored as periodic snapshots | The only substantive page we have no answer to. Worth noting their own `applications_ahead` is **constant across priority-date months**, so their version is coarse — a correct one would beat it, not just match it. |
| `/map` US wage choropleth | `USStateMap` already exists and already carries sentence tooltips | Not wired to a wage-per-state view yet. Small piece of work; listed as missing because a visitor cannot see it today. |

## Missing, deliberately, with reason

These four all come from the same place. Their live pending backlog is built by
scanning individual case numbers on `flag.dol.gov`, and that search posts to
`/recaptcha/caseStatus`; a bare POST returns **401**. It is CAPTCHA-gated, and
defeating a federal agency's bot protection is not something we will do.

| their visual | what it needs |
|---|---|
| `/backlog` live FLAG pending backlog (~121k pending across 28 filing months) | per-case FLAG scanning |
| `watchlist/months`, per-month pending/decided split | per-case FLAG scanning |
| "cases ahead of you" / `your_position_in_month` | per-case FLAG scanning |
| `rfi-funnel`, `letter-dist`, `analyst_review` / `audit_response` per-case states | per-case FLAG scanning |

**This is their real moat, and it is worth being precise about what it is.**
Everything else they ship runs off the same quarterly OFLC disclosure files we
already ingest — which is why the rest of this table closed as fast as it did.
The gap is one access route, not one insight.

Two honest consequences:

1. Our decision data is **quarterly-published and complete**; theirs is
   **daily-scraped and live**. For "has DOL decided my case", theirs is closer
   to now. For "what has DOL actually done", ours is the whole record and
   theirs is a 28-month window.
2. A reader who wants their position in the queue today cannot get it from us,
   and saying so plainly is better than approximating it. An estimate of
   "cases ahead of you" built from disclosure files would be a modelled number
   wearing a measured number's clothes, which is the thing this product exists
   not to do.

---

## Two things of theirs we will not copy

Not gaps. Choices.

- **The A–D risk grade.** One letter over factors that are not independent.
  We publish the rates and say why we do not blend them.
- **A single predicted decision date.** Their `/api/watchlist/predict` returns
  one `estimated_date`. Four public estimators disagree by about nine months on
  an identical filing date, and a confident date is wrong in exactly the way
  that loses someone the month their case runs past it.

## Their hygiene, for the record

Their whole API answers unauthenticated — every stat, the 321,725-row case
browser, the risk estimator, and the PRO decision predictor. `/api/flags` leaks
internal feature toggles and maintenance copy. None of that is a visual, but it
is the reason this table could be built at all.
