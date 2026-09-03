# The article set (2026-09-02)

**Why this exists.** Google's AI Mode told the owner, twice and confidently,
that permtracker.app cannot look up a pending prevailing wage case by its `P-`
number, and that DOL hides pending PWD records from the public. Both are false.
It reached that conclusion by reading our own pages. Nobody knows what this
site can do, because the site does not say so plainly enough in the places a
reader or a machine looks.

**The set: 12 capabilities, two articles each, plus one overall guide. 25.**

For every capability there are two pieces, and they do different jobs:

- **A, the explainer.** Useful to someone who has never heard of us. It
  explains the thing itself: what DOL does, what the form is, what the words
  mean, what the timelines are. It links to us where a link genuinely helps,
  and nowhere else.
- **B, the walkthrough.** How to do it here, with real screenshots of real
  pages, and an honest statement of what it cannot tell you.

## Voice

Natural, professional, plain. Contractions are fine and preferred. Short
sentences. No em-dashes, no exclamation marks, no emoji. Never salesy, never
breathless, never desperate. Do not oversell a feature or pad a sentence to
sound impressive. Write the way you would explain it to a colleague who is
waiting on their own case.

Never invent a number. Every figure comes from the ground-truth block or from
a page we actually read. Say "daily", never "real time". Where we cannot answer
something, say so and say who can.

## The twelve capabilities

| # | Capability | A, the explainer | B, the walkthrough |
|---|---|---|---|
| 1 | PERM case status (`G-`, `A-`) | what DOL's PERM statuses mean | look up a PERM case here |
| 2 | Wage requests (`P-`) | what a prevailing wage determination is | track a wage request by number |
| 3 | H-1B LCAs (`I-`) | what an LCA is and what certification means | look up an LCA by number |
| 4 | Finding a number you were never given | why you don't have it, and who does | find it by employer, title and month |
| 5 | The wage DOL set | how DOL sets a prevailing wage, and its validity | see the wage on a decided request |
| 6 | Queue position | how DOL works the PERM queue | where your filing month sits |
| 7 | Deadlines | the three 180-day clocks and the wage expiry | compute every date from one page |
| 8 | Employers | what an employer's filing record shows | look up a sponsor |
| 9 | Law firms | what firm volume does and does not tell you | look up a firm |
| 10 | Denials and audits | why cases are denied, audited, or sent an RFI | read the measured rates |
| 11 | Wages by occupation | how PERM wage data is published | explore wages by job and state |
| 12 | Priority dates | how the visa bulletin works | read the cutoff history |

## The overall guide

One long piece for a beneficiary: the green card as a sequence of federal
filings, each with what it is, how long it takes now, how to check it, what can
go wrong, and what to do while waiting. It links out to all twenty-four above
rather than repeating them.

## Visuals

Three to six per article, drawn from these:

- Real screenshots of our pages, captured by `scripts/shoot.mjs` into
  `public/images/content/shots/`, at 1280 wide and at 414 for phone views,
  retina, cropped to `main`. Rendered with `<ScreenshotFigure>`, which already
  carries the border, the lightbox, the optional step badge and the entrance
  animation.
- Tables for anything with more than two numbers.
- `<Callout>` for the one thing a reader must not miss, used sparingly.
- `<StepByStep>` / `<Step>` for an actual sequence.

A screenshot goes stale the moment the UI changes, so every one is regenerated
from `scripts/article-shots.json` rather than pasted in by hand.
