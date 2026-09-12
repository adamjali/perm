# Estimator backtest harness

Rebuilt 2026-09-12 after an audit found the previous analysis unreliable.
Report: `AUDIT.html`.

    node .planning/backtest/pull.mjs      # refresh decided.json + pending.json from Turso
    node .planning/backtest/audit1.mjs    # origins, maturity, censoring  -> origins.json
    node .planning/backtest/run.mjs       # flat window sweep, per origin
    node .planning/backtest/run2.mjs      # nested rolling-origin selection vs frozen benchmark
    node .planning/backtest/run3.mjs      # fixed-config head to head        (BLOCK_SCALE=... )
    node .planning/backtest/run4.mjs      # out-of-sample bias correction
    node .planning/backtest/run5.mjs      # range calibration by PREDICTED horizon
    node .planning/backtest/run6.mjs      # nested range calibration         (BLOCK_SCALE=... )

## Rules this harness enforces, each from a defect in the version it replaces

- **Nested selection.** Parameters for test origin k come only from origins < k.
  The old analysis chose a window on all 18 origins and reported the same 18 as validation.
- **Bin by PREDICTED horizon, never true.** The old `10/14/365/270` schedule was derived
  from buckets of eventual remaining time, which production cannot know.
- **Censoring is measured, not assumed.** A case still pending today was also pending at
  every earlier origin; `blocking()` adds those explicitly, and `audit1` reports the share
  of each origin's queue whose outcome can never be scored. Origins over 25% are dropped.
- **Origins are the unit, not cases.** ~3,000 cases at one origin share one rate
  environment. Score per origin, then summarise. 31 mature origins, not 56,966 samples.
- **Shocks stay in the error.** The Oct 2025 shutdown is excluded from *rate* estimation
  (a collapsed day is not a processing rate) but a forecast issued before it keeps the full
  delay in its test error. Coverage drops to 27-50% there, and that is the honest number.
- **`paceAt` refuses rather than guesses** when the window runs past the start of the data.

## One bug worth remembering

`solve()` binary-searched the wrong way (`if(C[m]<ahead) hi=m` instead of `lo=m+1`).
Every prediction pinned to the horizon cap and every window scored an identical ~1,189
days. It looked like a clean, publishable finding: "window choice does not matter."
Found only by printing five individual predictions beside their truths.
**A flat result across a whole sweep is a reason to check the instrument.**
