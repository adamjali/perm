# permtracker

The [PERM Tracker](https://permtracker.app) API for Node and the command line.

- DOL case status for PERM, wage requests, H-1B LCAs, H-2A, H-2B and CW-1
- When a pending PERM case is likely to be decided
- DOL's queue and the visa bulletin
- Employer, law firm and job records
- Exports, live DOL lookups and signed webhooks

## Get a key

Make a free key at [permtracker.app/settings](https://permtracker.app/settings), under API keys. Paid features are free until billing opens. A `pt_test_` key returns sample data for tests.

## Command line

```sh
npx permtracker login
npx permtracker case G-100-26045-123456
npx permtracker estimate --filed 2026-02-15
npx permtracker bulletin 2026-10
```

Add `--json` for the raw answer. Every command: `npx permtracker --help`.

## In code

Node 18 or later.

```ts
import { PermTracker } from "permtracker";

const pt = new PermTracker({ apiKey: process.env.PERMTRACKER_API_KEY });
const { data } = await pt.case("G-100-26045-123456");
console.log(data.status);
```

Check a webhook delivery with the raw request body:

```ts
import { verifyWebhook } from "permtracker";

const ok = await verifyWebhook(secret, request.headers, rawBody);
```

## If it breaks

- **No key found:** the CLI reads `--key`, then `PERMTRACKER_API_KEY`, then the key `login` saved.
- **A refused call** throws `PermTrackerError` with the API's `code`. On a rate limit, wait `retryAfter` seconds.

Full reference: [permtracker.app/developers](https://permtracker.app/developers). Terms: [permtracker.app/api-terms](https://permtracker.app/api-terms).
