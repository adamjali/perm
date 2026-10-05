# Employer names that differ only by spacing (plan, Oct 5 2026; built the same day)

## The defect

`entity_key` turns punctuation into spaces, so DOL's spellings of one company land on
different keys when the gaps differ:

| keys today | filings (PERM + LCA + PWD) |
|---|---|
| `wal mart associates` / `walmart associates` | 29,097 / 417 |
| `jpmorgan chase` / `jp morgan chase` | 23,693 / 423 |
| `t mobile usa` / `tmobile usa` | 3,882 / 76 |
| `at t services` / `att services` | 3,886 / 74 |
| `lowe s companies` / `lowes companies` | 2,783 / 100 |
| `moody s analytics` / `moodys analytics` | 1,217 / 19 |
| `bristol myers squibb` / `bristolmyers squibb` | 1,806 / few |

Measured over the 279,746 keys in `employer_page_map`: **2,526 groups** whose keys are
identical once spaces are removed. A random 45 were all one company; the shortest (5
letters or fewer, 76 groups) are mostly real pairs ("wd 40"/"wd40", "five 9"/"five9") and
a few are too small to judge ("in fo"/"info").

## Why no punctuation tweak fixes it

Measured over 340,459 distinct DOL employer names, deleting a punctuation mark inside a
word instead of splitting on it JOINS about as many keys as it SPLITS:

| treat as part of the word | joins | splits (today's merges broken) |
|---|---|---|
| `'` | 378 | 237 (St. Jude, Brigham and Women's, Moody's) |
| `-` | 338 | 484 (Bristol-Myers Squibb, Cigna-Evernorth, 7-Eleven) |
| `&` | 24 | 44 |

People write "Children's", "Childrens" and "Children s" interchangeably, so moving the
boundary fixes one spelling and breaks another. Only equality that ignores spaces joins
without splitting anything: two keys equal with spaces are equal without them.

## Why the keys keep their spaces

Four readers depend on the words:
- `nameVariants` (`src/lib/turso/entityDetail.ts`) ranges over `merge_key` from its first
  word (`[root, root + "!")`, served by `idx_pe_merge`).
- `typo_aliases` (law firms) aligns keys token by token.
- `isPossibleMatch` (`src/lib/employerNameMatch.ts`) matches whole words, which is what
  keeps "Meta" off Metamorphosis Labs.
- `employerSlugs.ts` falls back to a prefix range on `merge_key`.

So the rule is an ALIAS, like the law-firm typo rules: a key whose space-free form equals
a busier key's moves under that key. Deterministic, never inference (no letter differs).

## Where it has to apply

Every place a name's key is matched against an entity's key:
`ingest_perm_disclosure.py` (the entity merge, beside `typo_aliases`), `turso_migrate.py`
(case rows to slugs), `build_entity_detail.py`, `ingest_perm_history.py`,
`ingest_warn.py`, `build_employer_map.py`, `build_firm_domains.py`, and on the site
`employerLookup.ts`. The cleanest shape is one alias map written by the entity build
(`perm_docs['key_aliases']`, variant key -> canonical key) that every later step reads,
plus `spacing_aliases(totals)` in `entity_identity.py` beside `typo_aliases`, held by the
shared fixture in both languages.

## Shipping it

1. `spacing_aliases` + fixture rows (DOL's own spellings), red then green.
2. Apply in the entity build; the sticky-slug plan already aliases a slug nobody keeps to
   the busiest holder of its key, and a merged spelling's page already redirects
   (`redirectSpelling`).
3. Apply in the consumers above; the employer map writes each spelling's own key so the
   lookup's exact step still finds "Walmart Associates".
4. The lookup's possible-match step also reads `employer_page_map.key` by word prefix, so
   "Walmart" still finds Wal-Mart Associates after its entity merges.
5. Full suite, push, dispatch the PERM disclosure reload (entity rebuild), then the
   nightly map; check Walmart, JPMorgan and T-Mobile pages and the extension.
