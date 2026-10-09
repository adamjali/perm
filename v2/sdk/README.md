# permtracker

The [PERM Tracker](https://permtracker.app) API from Node and the command line: the Department of Labor's live status for any PERM, prevailing wage, H-1B LCA, H-2A, H-2B or CW-1 case, when a pending PERM case is likely to be decided, DOL's queue, visa bulletins, and employer, law firm and occupation records.

The data is DOL's and the State Department's. Make a key at [permtracker.app/settings](https://permtracker.app/settings), under API keys. Paid features (exports, live DOL lookups, webhooks, the higher limits) are free for every account until billing opens. A `pt_test_` sandbox key answers fixed sample data and isn't counted, for tests and CI.

## Command line

```sh
npx permtracker login                     # paste your key once
npx permtracker case G-100-26045-123456
npx permtracker estimate --filed 2026-02-15
npx permtracker employers "acme"
npx permtracker bulletin 2026-10 --json
npx permtracker case G-100-26045-123456 --live      # ask DOL now if we don't hold it yet
npx permtracker export cases q=acme state=CA > acme.csv
npx permtracker webhooks add https://example.com/hooks case.status_changed
npx permtracker watch G-100-26045-123456
```

`--json` prints the API's own answer. The key comes from `--key`, then `PERMTRACKER_API_KEY`, then the file `login` saves (`~/.config/permtracker/config.json`, readable only by you).

## In code

```ts
import { PermTracker, PermTrackerError } from "permtracker";

const pt = new PermTracker({ apiKey: process.env.PERMTRACKER_API_KEY });

const { data, meta, usage } = await pt.case("G-100-26045-123456");
console.log(data.status, meta.asOf, `${usage.today}/${usage.perDay} today`);

try {
  await pt.estimate({ filed: "2026-02-15" });
} catch (err) {
  if (err instanceof PermTrackerError && err.retryAfter) {
    // a rate limit: wait err.retryAfter seconds
  }
}
```

Exports, webhooks and checking a delivery:

```ts
const { csv, truncated } = await pt.exportCsv("cases", { q: "acme", state: "CA" });

const { data: hook } = await pt.createWebhook({ url: "https://example.com/hooks", events: ["case.status_changed"] });
// hook.secret is shown once: store it
await pt.watch({ caseNumber: "G-100-26045-123456" });

import { verifyWebhook } from "permtracker";
// in your handler, with the raw request body:
if (!(await verifyWebhook(process.env.PERM_WEBHOOK_SECRET!, request.headers, rawBody))) {
  return new Response("bad signature", { status: 400 });
}
```

Every method returns `{ data, meta, usage }`. A refusal throws `PermTrackerError` with the API's `code`, its message, and `retryAfter` when waiting fixes it. No dependencies; Node 18 or later.

Full reference: [permtracker.app/developers](https://permtracker.app/developers). Terms: [permtracker.app/api-terms](https://permtracker.app/api-terms).
