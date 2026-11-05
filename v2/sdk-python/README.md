# permtracker

The [PERM Tracker](https://permtracker.app) API for Python and the command line.

- DOL case status for PERM, wage requests, H-1B LCAs, H-2A, H-2B and CW-1
- When a pending PERM case is likely to be decided
- DOL's queue and the visa bulletin
- Employer, law firm and job records
- Exports, live DOL lookups and signed webhooks

## Install

Python 3.9 or later.

```sh
pip install permtracker
```

Make a free key at [permtracker.app/settings](https://permtracker.app/settings), under API keys. Paid features are free until billing opens. A `pt_test_` key returns sample data for tests.

## Command line

```sh
permtracker login
permtracker case G-100-26045-123456
permtracker estimate --filed 2026-02-15
permtracker bulletin 2026-10
```

Add `--json` for the raw answer. Every command: `permtracker --help`.

## In code

```python
from permtracker import PermTracker

pt = PermTracker()    # reads PERMTRACKER_API_KEY
answer = pt.case("G-100-26045-123456")
print(answer.data["status"])
```

Check a webhook delivery with the raw request body:

```python
from permtracker import verify_webhook

ok = verify_webhook(secret, request.headers, raw_body)
```

## If it breaks

- **No key found:** the CLI reads `--key`, then `PERMTRACKER_API_KEY`, then the key `login` saved.
- **A refused call** raises `PermTrackerError` with the API's `code`. On a rate limit, wait `retry_after` seconds.

Full reference: [permtracker.app/developers](https://permtracker.app/developers). Terms: [permtracker.app/api-terms](https://permtracker.app/api-terms).
