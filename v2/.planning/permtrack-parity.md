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
| better | 10 |
| equal | 7 |
| missing, and we could build it | 1 |
| missing, deliberately, with reason | 4 |

**Revised 2026-08-26 after two rows were re-checked against the running site
rather than against the source.** The wage choropleth was graded missing and
is in fact shipped and reachable (see its row), which moves it to better on
freshness. The I-485 gap below is now built from USCIS directly. Both
mistakes had the same shape: a component or an API was read, and the thing a
visitor actually gets was not.

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
| `/map` US wage choropleth | **Shipped. Verified live 2026-08-26.** | This was graded a gap in error. `/perm-by-state` renders `StateExplorer` with a five-way metric selector - Filings, Approval rate, Denial rate, Median days, **Median wage** - and all 55 states carry `medianAnnualWage` in `disclosure_stats`. Confirmed on the deployed page as a real control, not prose. The lesson is the same one that corrected the freshness claim below: the component was read, the rendered page was not. |

## Missing, deliberately, with reason

These four all come from the same place. Their live pending backlog is built by
scanning individual case numbers on `flag.dol.gov`, and that search posts to
`/recaptcha/caseStatus`; a bare POST returns **401**. It is CAPTCHA-gated, and
defeating a federal agency's bot protection is not something we will do.

| their visual | what it needs | what we already answer |
|---|---|---|
| `/backlog` live FLAG pending backlog (~121k across 28 filing months) | per-case FLAG scanning, for the PERM analyst stage | **DOL's own PWD backlog by receipt month**, charted on `/perm-processing-times` via `PwdBacklogChart` - 50,300 pending requests across 7 months, published, not modelled |
| `watchlist/months`, per-month pending/decided split | same | same chart; the split exists for the PWD stage |
| "cases ahead of you" / `your_position_in_month` | same, for the PERM stage | **shipped for two of the three queues.** `/tools/pwd-calculator` answers "15,193 requests are ahead of yours" from DOL's published count, and `/tools/i485-queue-position` answers the adjustment stage from USCIS's inventory |
| `rfi-funnel`, `letter-dist`, per-case `analyst_review` / `audit_response` states | per-case FLAG scanning | nothing, and nothing is derivable: the disclosure files carry no RFI or audit field at all, so this is unavailable to anyone working from public files |

**Re-scoped 2026-08-26. Calling these four "gaps" overstated the position.**
A PERM applicant waits in three queues, and queue position is the question
each of them raises:

| queue | do we answer it | source |
|---|---|---|
| Prevailing wage determination | **yes** | DOL's published per-month backlog |
| PERM analyst review | **no, and neither do they honestly** | needs per-case scanning; DOL publishes only the frontier month |
| I-485 adjustment | **yes** | USCIS inventory, as-of 2026-08-05 against their 2026-05-01 |

So we answer two of the three from published counts; they answer one, three
months staler, and as a point estimate rather than a range. What is genuinely
missing is the PERM analyst stage specifically, and the reason is worth
stating exactly: DOL's disclosure files contain **no pending rows at all**,
every record carries a decision date, so pending cannot be counted from them.
It is not a gap we are choosing to leave - it is not derivable from public
data, and the alternative is a modelled number wearing a measured number's
clothes.

**This is their real moat, and it is worth being precise about what it is.**
Everything else they ship runs off the same quarterly OFLC disclosure files we
already ingest — which is why the rest of this table closed as fast as it did.
The gap is one access route, not one insight.

Two honest consequences:

1. **Corrected 2026-08-26 by measurement: their public data is NOT live
   either.** The natural assumption is that per-case scanning makes their
   decision data fresher than our quarterly ingest. It does not, in anything
   they expose. Sorting `/api/cases` by decision date descending returns
   `2026-03-31` — exactly their stated OFLC window boundary — so they hold
   **zero** cases decided after the quarterly file, and their
   `decisions-per-day` series ends there too with its feature flag off.
   Their `/api/stats/timeline-data` publishes a live flag per dataset and only
   `pwd` is `true`; the `flag_checked` timestamp that refreshes every few
   minutes is them polling `flag.dol.gov/processingtimes`, the same public
   page we ingest daily and parse more richly. So on published data ours is
   both fresher (through 2026-06-30 against their 2026-03-31) and larger.
   Whatever their scanning feeds, it is not visible in the public API.
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
